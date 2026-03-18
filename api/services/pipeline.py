"""
pipeline.py
-----------

Coordinates: fetch news (by briefing mode) -> script -> TTS.
"""

import asyncio
import logging
from typing import Dict, Any, List, AsyncIterator, Tuple, Optional

from ..models import GenerateEpisodeResponse, EpisodeSource
from .news import fetch_full_daily_briefing_articles, fetch_news_for_category_key
from .script import generate_podcast_script
from .tts import synthesize_audio, get_chunks, synthesize_one_chunk, bytes_to_data_url

TTS_CONCURRENT_CHUNKS = 2
logger = logging.getLogger(__name__)

MAX_ARTICLES_BY_LENGTH = {"short": 6, "medium": 8, "long": 10}

# Full briefing needs more headroom across 8 sections
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
    """Strip internal keys before persisting sources."""
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


async def generate_episode_stream(
    length: str = "short",
    briefing_mode: str = "category",
    category: Optional[str] = None,
) -> AsyncIterator[Tuple[int, str, Optional[Dict[str, Any]]]]:
    yield 10, "Fetching news…", None
    articles, topic_display = await _gather_articles(briefing_mode, category, length)
    yield 25, "Generating script…", None
    transcript = await generate_podcast_script(
        topic=topic_display,
        articles=articles,
        length=length,
        briefing_mode=briefing_mode,
        category_key=(category or "").strip().lower() if briefing_mode == "category" else None,
    )
    yield 55, "Generating audio…", None
    chunks = get_chunks(transcript)
    n_chunks = len(chunks)
    audio_parts: List[bytes] = []
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

    response = GenerateEpisodeResponse(
        audio_url=audio_url,
        transcript=transcript,
        sources=sources,
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
    audio_url = await synthesize_audio(script=transcript)
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
    response = GenerateEpisodeResponse(
        audio_url=audio_url,
        transcript=transcript,
        sources=sources,
    )
    return response.model_dump(mode="json")
