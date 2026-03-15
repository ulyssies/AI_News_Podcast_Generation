"""
pipeline.py
-----------

Coordinates the full episode generation pipeline:
    fetch_news -> generate_podcast_script -> synthesize_audio

Exports:
    async def generate_episode(topic: str, length: str) -> dict
    async def generate_episode_stream(topic: str, length: str) -> AsyncIterator[tuple]
"""

import asyncio
import logging
from typing import Dict, Any, List, AsyncIterator, Tuple, Optional

from ..models import GenerateEpisodeResponse, EpisodeSource
from .news import fetch_news
from .script import generate_podcast_script
from .tts import synthesize_audio, get_chunks, synthesize_one_chunk, bytes_to_data_url

# How many TTS chunks to request in parallel (2–3 is a good balance; more can hit rate limits)
TTS_CONCURRENT_CHUNKS = 2

logger = logging.getLogger(__name__)

# Cap articles by length to keep runtime and token usage reasonable
MAX_ARTICLES_BY_LENGTH = {"short": 6, "medium": 8, "long": 10}


async def generate_episode_stream(
    topic: str, length: str = "short"
) -> AsyncIterator[Tuple[int, str, Optional[Dict[str, Any]]]]:
    """
    Same as generate_episode but yields (percent, message, result_or_none) for progress.
    Last yield is (100, "Done", result_dict).
    """
    yield 10, "Fetching news…", None
    max_articles = MAX_ARTICLES_BY_LENGTH.get(length, 8)
    articles = await fetch_news(topic, max_articles=max_articles)
    yield 25, "Generating script…", None
    transcript = await generate_podcast_script(topic=topic, articles=articles, length=length)
    yield 55, "Generating audio…", None
    chunks = get_chunks(transcript)
    n_chunks = len(chunks)
    audio_parts: List[bytes] = []
    # Process chunks in parallel batches for much faster total time
    batch_size = min(TTS_CONCURRENT_CHUNKS, n_chunks) if n_chunks else 1
    i = 0
    while i < n_chunks:
        batch = chunks[i : i + batch_size]
        pct_start = 55 + int(35 * i / n_chunks) if n_chunks else 55
        yield min(pct_start, 89), f"Synthesizing chunk {i + 1}–{i + len(batch)} of {n_chunks}…", None
        results = await asyncio.gather(
            *[synthesize_one_chunk(c, voice=None) for c in batch],
            return_exceptions=False,
        )
        for j, part in enumerate(results):
            if part:
                audio_parts.append(part)
            elif batch[j].strip():
                logger.warning(
                    "TTS returned no audio for chunk %d/%d (%d chars)",
                    i + j + 1,
                    n_chunks,
                    len(batch[j]),
                )
        i += len(batch)
        pct = 55 + int(35 * min(i, n_chunks) / n_chunks) if n_chunks else 90
        yield min(pct, 90), "Generating audio…", None

    if n_chunks and len(audio_parts) < n_chunks:
        raise RuntimeError(
            f"Only {len(audio_parts)} of {n_chunks} audio segments were generated. "
            "Check server logs for TTS timeouts or API errors (e.g. rate limit)."
        )
    audio_url = bytes_to_data_url(b"".join(audio_parts)) if audio_parts else ""
    yield 90, "Finalizing…", None

    sources: List[EpisodeSource] = []
    for a in articles:
        url = a.get("url")
        if not url:
            continue
        try:
            sources.append(EpisodeSource(
                title=a.get("title", "Untitled"),
                url=url,
                publisher=a.get("publisher"),
            ))
        except Exception:
            pass

    response = GenerateEpisodeResponse(
        audio_url=audio_url,
        transcript=transcript,
        sources=sources,
    )
    yield 100, "Done", response.model_dump(mode="json")


async def generate_episode(topic: str, length: str = "short") -> Dict[str, Any]:
    """
    High-level POC pipeline function.

    For now, this stitches together placeholder implementations so the
    API contract is in place even before real integrations are added.
    """
    max_articles = MAX_ARTICLES_BY_LENGTH.get(length, 8)
    articles = await fetch_news(topic, max_articles=max_articles)

    transcript = await generate_podcast_script(topic=topic, articles=articles, length=length)

    audio_url = await synthesize_audio(script=transcript)

    sources: List[EpisodeSource] = []
    for a in articles:
        url = a.get("url")
        if not url:
            continue
        try:
            sources.append(EpisodeSource(
                title=a.get("title", "Untitled"),
                url=url,
                publisher=a.get("publisher"),
            ))
        except Exception:
            pass  # Skip invalid URLs

    response = GenerateEpisodeResponse(
        audio_url=audio_url,
        transcript=transcript,
        sources=sources,
    )

    return response.model_dump(mode="json")

