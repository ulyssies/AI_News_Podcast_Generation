"""
pipeline.py
-----------

Coordinates: fetch news -> stream script (Claude) -> pipeline TTS in parallel.
TTS chunks fire as Claude streams text, so audio synthesis overlaps with generation.
"""

import asyncio
import logging
import time
from typing import Any, AsyncIterator, Dict, List, Optional, Tuple

from api.models import GenerateEpisodeResponse, EpisodeSource
from api.services.news import fetch_full_daily_briefing_articles, fetch_news_for_category_key
from api.services.script import (
    count_script_words,
    generate_podcast_script,
    generate_script_extension,
    minimum_word_count,
    stream_podcast_script,
)
from api.services.tts import (
    TTS_MAX_CHARS,
    bytes_to_data_url,
    ensure_tts_configured,
    synthesize_one_chunk_result,
)

logger = logging.getLogger(__name__)

MAX_ARTICLES_BY_LENGTH = {"short": 6, "medium": 12, "long": 16}
MAX_ARTICLES_FULL_DAILY = {"short": 24, "medium": 32, "long": 40}

CATEGORY_LABELS = {
    "current_events": "Current Events",
    "financial_report": "Financial Report",
    "science": "Latest in Science",
    "tech_ai": "Tech & AI",
    "health_wellness": "Health & Wellness",
    "sports": "Sports",
    "entertainment": "Entertainment",
    "politics": "Politics",
}


def _article_for_sources(a: Dict) -> Dict:
    return {k: v for k, v in a.items() if not str(k).startswith("_")}


async def _gather_articles(
    briefing_mode: str, category: Optional[str], length: str
) -> Tuple[List[Dict], str]:
    if briefing_mode == "full_daily":
        cap = MAX_ARTICLES_FULL_DAILY.get(length, 32)
        articles = await fetch_full_daily_briefing_articles(cap)
        return articles, "Today's Full Briefing"
    key = (category or "current_events").strip().lower()
    max_articles = MAX_ARTICLES_BY_LENGTH.get(length, 8)
    articles = await fetch_news_for_category_key(key, max_articles=max_articles)
    return articles, CATEGORY_LABELS.get(key, category or key)


def _find_chunk_boundary(text: str, target: int = TTS_MAX_CHARS) -> int:
    """
    Find a clean split point at or before target chars.
    Prefers sentence boundaries, falls back to word boundaries.
    Returns len(text) if there isn't enough text for a full chunk.
    """
    if len(text) < target:
        return len(text)
    segment = text[:target]
    for sep in (". ", "! ", "? ", ".\n", "!\n", "?\n"):
        idx = segment.rfind(sep)
        if idx > target // 2:
            return idx + len(sep)
    idx = segment.rfind(" ")
    if idx > target // 2:
        return idx + 1
    return target


def _build_sources(articles: List[Dict]) -> List[EpisodeSource]:
    sources: List[EpisodeSource] = []
    for a in articles:
        clean = _article_for_sources(a)
        url = clean.get("url")
        if not url:
            continue
        try:
            sources.append(
                EpisodeSource(
                    title=clean.get("title", "Untitled"),
                    url=url,
                    publisher=clean.get("publisher"),
                )
            )
        except Exception:
            pass
    return sources


async def generate_episode_stream(
    length: str = "short",
    briefing_mode: str = "category",
    category: Optional[str] = None,
) -> AsyncIterator[Tuple[int, str, Optional[Dict[str, Any]]]]:
    """
    Stream progress events while generating the episode.
    Pipelines Claude streaming + TTS: audio chunks fire as Claude generates text,
    so synthesis overlaps with generation rather than happening after.
    """
    started_at = time.perf_counter()
    metrics: Dict[str, Optional[int]] = {
        "news_fetch_ms": None,
        "first_claude_token_ms": None,
        "script_done_ms": None,
        "first_tts_done_ms": None,
        "all_tts_done_ms": None,
        "base64_ms": None,
        "response_bytes": None,
    }

    ensure_tts_configured()

    yield 10, "Fetching news…", None
    articles, topic_display = await _gather_articles(briefing_mode, category, length)
    metrics["news_fetch_ms"] = int((time.perf_counter() - started_at) * 1000)
    yield 16, "Sources ready…", {
        "event": "sources",
        "sources": [source.model_dump(mode="json") for source in _build_sources(articles)],
    }
    yield 18, "Generating script…", None

    transcript_parts: List[str] = []
    event_queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue()
    tts_tasks: List[asyncio.Task] = []
    audio_by_index: Dict[int, bytes] = {}
    tts_errors: List[str] = []
    tts_chunks_started = 0

    def fire_tts_chunk(chunk_text: str) -> None:
        nonlocal tts_chunks_started
        index = tts_chunks_started
        tts_chunks_started += 1
        task = asyncio.create_task(synthesize_one_chunk_result(chunk_text))
        tts_tasks.append(task)

        def on_done(done_task: asyncio.Task, chunk_index: int = index) -> None:
            try:
                part, error = done_task.result()
            except Exception as exc:
                logger.warning("TTS chunk %d failed: %s", chunk_index, exc, exc_info=True)
                part = b""
                error = str(exc) or type(exc).__name__
            event_queue.put_nowait(
                {
                    "type": "audio_chunk",
                    "index": chunk_index,
                    "audio": part,
                    "error": error,
                    "text": chunk_text,
                    "chars": len(chunk_text),
                }
            )

        task.add_done_callback(on_done)
        pct = min(72, 20 + tts_chunks_started * 5)
        event_queue.put_nowait({"type": "progress", "percent": pct, "message": "Synthesizing audio…"})

    def fire_text_for_tts(text: str) -> None:
        accumulated_text = (text or "").strip()
        while len(accumulated_text) >= TTS_MAX_CHARS:
            boundary = _find_chunk_boundary(accumulated_text)
            chunk_text = accumulated_text[:boundary].strip()
            accumulated_text = accumulated_text[boundary:].strip()
            if chunk_text:
                fire_tts_chunk(chunk_text)
        if accumulated_text:
            fire_tts_chunk(accumulated_text)

    async def produce_script_and_tts() -> None:
        accumulated = ""
        try:
            async for text_delta in stream_podcast_script(
                topic=topic_display,
                articles=articles,
                length=length,
                briefing_mode=briefing_mode,
                category_key=(category or "").strip().lower()
                if briefing_mode == "category"
                else None,
            ):
                if text_delta and metrics["first_claude_token_ms"] is None:
                    metrics["first_claude_token_ms"] = int(
                        (time.perf_counter() - started_at) * 1000
                    )
                accumulated += text_delta
                transcript_parts.append(text_delta)

                # Fire TTS as soon as a sentence-safe chunk is ready.
                while len(accumulated) >= TTS_MAX_CHARS:
                    boundary = _find_chunk_boundary(accumulated)
                    chunk_text = accumulated[:boundary].strip()
                    accumulated = accumulated[boundary:]
                    if chunk_text:
                        fire_tts_chunk(chunk_text)

            remaining = accumulated.strip()
            if remaining:
                fire_tts_chunk(remaining)

            min_words = minimum_word_count(length, briefing_mode)
            repair_attempts = 0
            while count_script_words("".join(transcript_parts)) < min_words and repair_attempts < 2:
                repair_attempts += 1
                current_script = "".join(transcript_parts).strip()
                missing_words = min_words - count_script_words(current_script)
                await event_queue.put(
                    {
                        "type": "progress",
                        "percent": min(82, 58 + repair_attempts * 6),
                        "message": "Deepening coverage…",
                    }
                )
                extension = await generate_script_extension(
                    topic=topic_display,
                    articles=articles,
                    existing_script=current_script,
                    missing_words=missing_words,
                    length=length,
                    briefing_mode=briefing_mode,
                    category_key=(category or "").strip().lower()
                    if briefing_mode == "category"
                    else None,
                )
                if not extension or count_script_words(extension) < 80:
                    logger.warning(
                        "script_extension_too_short mode=%s category=%s length=%s missing_words=%d extension_words=%d",
                        briefing_mode,
                        category,
                        length,
                        missing_words,
                        count_script_words(extension or ""),
                    )
                    break
                transcript_parts.append("\n\n" + extension)
                fire_text_for_tts(extension)

            final_word_count = count_script_words("".join(transcript_parts))
            if final_word_count < min_words:
                raise RuntimeError(
                    f"Generated script undershot the {min_words}-word target "
                    f"after repair attempts ({final_word_count} words)."
                )

            metrics["script_done_ms"] = int((time.perf_counter() - started_at) * 1000)
            if not tts_tasks:
                raise RuntimeError(
                    "No audio was generated — the script may have been empty. "
                    "Check your API keys and news sources."
                )
            await asyncio.gather(*tts_tasks, return_exceptions=True)
            metrics["all_tts_done_ms"] = int((time.perf_counter() - started_at) * 1000)
            await event_queue.put({"type": "producer_done"})
        except Exception as exc:
            await event_queue.put({"type": "error", "error": exc})

    producer_task = asyncio.create_task(produce_script_and_tts())

    while True:
        event = await event_queue.get()
        kind = event.get("type")
        if kind == "progress":
            yield int(event["percent"]), str(event["message"]), None
        elif kind == "audio_chunk":
            index = int(event["index"])
            part = event.get("audio") or b""
            error = str(event.get("error") or "")
            if part:
                audio_by_index[index] = part
                if metrics["first_tts_done_ms"] is None:
                    metrics["first_tts_done_ms"] = int(
                        (time.perf_counter() - started_at) * 1000
                    )
                pct = min(84, 30 + len(audio_by_index) * 5)
                yield pct, "Audio ready…", {
                    "event": "audio_chunk",
                    "index": index,
                    "audio_url": bytes_to_data_url(part),
                    "text": str(event.get("text") or ""),
                    "chars": int(event.get("chars") or 0),
                }
            elif error:
                tts_errors.append(error)
        elif kind == "producer_done":
            break
        elif kind == "error":
            raise event["error"]

    await producer_task

    yield 85, "Finishing audio…", None

    transcript = "".join(transcript_parts).strip()
    missing_indexes = [index for index in range(tts_chunks_started) if index not in audio_by_index]
    if missing_indexes or tts_errors:
        error_bits = []
        if missing_indexes:
            error_bits.append(f"missing chunks: {missing_indexes}")
        if tts_errors:
            error_bits.append(f"errors: {'; '.join(tts_errors[:3])}")
        raise RuntimeError(
            "TTS did not complete every audio chunk after retries. "
            + " ".join(error_bits)
        )

    audio_parts = [audio_by_index[i] for i in range(tts_chunks_started)]
    transcript_word_count = count_script_words(transcript)

    if not audio_parts:
        detail = tts_errors[0] if tts_errors else "No TTS chunks returned audio."
        raise RuntimeError(
            f"TTS produced no audio: {detail}"
        )

    audio_chunk_urls = [bytes_to_data_url(part) for part in audio_parts]
    metrics["base64_ms"] = 0
    yield 90, "Finalizing…", None

    response = GenerateEpisodeResponse(
        audio_url="",
        transcript=transcript,
        sources=_build_sources(articles),
        total_chunks=len(audio_parts),
        audio_chunks=audio_chunk_urls,
    )
    response_payload = response.model_dump(mode="json")
    metrics["response_bytes"] = len(str(response_payload).encode("utf-8"))
    logger.info(
        "episode_generation_timing mode=%s category=%s length=%s articles=%d words=%d chunks=%d "
        "news_fetch_ms=%s first_claude_token_ms=%s script_done_ms=%s "
        "first_tts_done_ms=%s all_tts_done_ms=%s base64_ms=%s response_bytes=%s",
        briefing_mode,
        category,
        length,
        len(articles),
        transcript_word_count,
        len(audio_parts),
        metrics["news_fetch_ms"],
        metrics["first_claude_token_ms"],
        metrics["script_done_ms"],
        metrics["first_tts_done_ms"],
        metrics["all_tts_done_ms"],
        metrics["base64_ms"],
        metrics["response_bytes"],
    )
    yield 100, "Done", response_payload


async def generate_episode(
    length: str = "short",
    briefing_mode: str = "category",
    category: Optional[str] = None,
) -> Dict[str, Any]:
    ensure_tts_configured()
    articles, topic_display = await _gather_articles(briefing_mode, category, length)
    transcript = await generate_podcast_script(
        topic=topic_display,
        articles=articles,
        length=length,
        briefing_mode=briefing_mode,
        category_key=(category or "").strip().lower() if briefing_mode == "category" else None,
    )
    min_words = minimum_word_count(length, briefing_mode)
    repair_attempts = 0
    while count_script_words(transcript) < min_words and repair_attempts < 2:
        repair_attempts += 1
        extension = await generate_script_extension(
            topic=topic_display,
            articles=articles,
            existing_script=transcript,
            missing_words=min_words - count_script_words(transcript),
            length=length,
            briefing_mode=briefing_mode,
            category_key=(category or "").strip().lower() if briefing_mode == "category" else None,
        )
        if not extension or count_script_words(extension) < 80:
            break
        transcript = f"{transcript.strip()}\n\n{extension.strip()}"
    if count_script_words(transcript) < min_words:
        raise RuntimeError(
            f"Generated script undershot the {min_words}-word target "
            f"after repair attempts ({count_script_words(transcript)} words)."
        )
    from api.services.tts import get_chunks, synthesize_one_chunk_result
    chunks = get_chunks(transcript)
    results = await asyncio.gather(
        *[synthesize_one_chunk_result(c, voice=None) for c in chunks]
    )
    failed_chunks = [
        f"{index}: {error or 'empty audio'}"
        for index, (part, error) in enumerate(results)
        if error or not part
    ]
    if failed_chunks:
        raise RuntimeError(
            "TTS did not complete every audio chunk after retries. "
            + "; ".join(failed_chunks[:3])
        )
    audio_parts = [part for part, _ in results]
    audio_bytes = b"".join(audio_parts)
    audio_chunk_urls = [bytes_to_data_url(part) for part in audio_parts]
    audio_url = bytes_to_data_url(audio_bytes)
    response = GenerateEpisodeResponse(
        audio_url=audio_url,
        transcript=transcript,
        sources=_build_sources(articles),
        total_chunks=len(audio_parts),
        audio_chunks=audio_chunk_urls,
    )
    return response.model_dump(mode="json")
