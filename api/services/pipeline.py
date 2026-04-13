"""
pipeline.py
-----------

Coordinates: fetch news -> stream script (Claude) -> pipeline TTS in parallel.
TTS chunks fire as Claude streams text, so audio synthesis overlaps with generation.
"""

import asyncio
import logging
from typing import Any, AsyncIterator, Dict, List, Optional, Tuple

from api.models import GenerateEpisodeResponse, EpisodeSource
from api.services.news import fetch_full_daily_briefing_articles, fetch_news_for_category_key
from api.services.script import stream_podcast_script, generate_podcast_script
from api.services.tts import TTS_MAX_CHARS, synthesize_one_chunk, bytes_to_data_url

logger = logging.getLogger(__name__)

MAX_ARTICLES_BY_LENGTH = {"short": 6, "medium": 8, "long": 10}
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
    yield 10, "Fetching news…", None
    articles, topic_display = await _gather_articles(briefing_mode, category, length)
    yield 18, "Generating script…", None

    tts_tasks: List[asyncio.Task] = []
    accumulated = ""
    transcript_parts: List[str] = []
    n_chunks_fired = 0

    async for text_delta in stream_podcast_script(
        topic=topic_display,
        articles=articles,
        length=length,
        briefing_mode=briefing_mode,
        category_key=(category or "").strip().lower() if briefing_mode == "category" else None,
    ):
        accumulated += text_delta
        transcript_parts.append(text_delta)

        # Fire a TTS task as soon as we have a full chunk ready
        while len(accumulated) >= TTS_MAX_CHARS:
            boundary = _find_chunk_boundary(accumulated)
            chunk_text = accumulated[:boundary].strip()
            accumulated = accumulated[boundary:]
            if chunk_text:
                task = asyncio.create_task(synthesize_one_chunk(chunk_text))
                tts_tasks.append(task)
                n_chunks_fired += 1
                # Progress 18–70% during the script+TTS pipeline phase
                pct = min(70, 18 + n_chunks_fired * 7)
                yield pct, "Synthesizing audio…", None

    # Fire TTS for any remaining text after Claude finishes
    remaining = accumulated.strip()
    if remaining:
        task = asyncio.create_task(synthesize_one_chunk(remaining))
        tts_tasks.append(task)

    if not tts_tasks:
        raise RuntimeError(
            "No audio was generated — the script may have been empty. "
            "Check your API keys and news sources."
        )

    yield 75, "Finishing audio…", None

    transcript = "".join(transcript_parts).strip()

    # Collect TTS results in order (tasks may already be done)
    audio_parts: List[bytes] = []
    for task in tts_tasks:
        part = await task
        if part:
            audio_parts.append(part)

    if not audio_parts:
        raise RuntimeError(
            "TTS produced no audio. Check your OPENAI_API_KEY and TTS configuration."
        )

    audio_url = bytes_to_data_url(b"".join(audio_parts))
    yield 90, "Finalizing…", None

    response = GenerateEpisodeResponse(
        audio_url=audio_url,
        transcript=transcript,
        sources=_build_sources(articles),
    )
    yield 100, "Done", response.model_dump(mode="json")


async def generate_episode(
    length: str = "short",
    briefing_mode: str = "category",
    category: Optional[str] = None,
) -> Dict[str, Any]:
    articles, topic_display = await _gather_articles(briefing_mode, category, length)
    transcript = await generate_podcast_script(
        topic=topic_display,
        articles=articles,
        length=length,
        briefing_mode=briefing_mode,
        category_key=(category or "").strip().lower() if briefing_mode == "category" else None,
    )
    from api.services.tts import get_chunks
    chunks = get_chunks(transcript)
    results = await asyncio.gather(*[synthesize_one_chunk(c, voice=None) for c in chunks])
    audio_bytes = b"".join(part for part in results if part)
    audio_url = bytes_to_data_url(audio_bytes)
    response = GenerateEpisodeResponse(
        audio_url=audio_url,
        transcript=transcript,
        sources=_build_sources(articles),
    )
    return response.model_dump(mode="json")
