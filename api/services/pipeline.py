"""
pipeline.py
-----------

Coordinates the full episode generation pipeline:
    fetch_news -> generate_podcast_script -> synthesize_audio

Exports a single high-level function:
    async def generate_episode(topic: str, length: str) -> dict
that returns:
    {
        "audio_url": str,
        "transcript": str,
        "sources": [...],
    }
"""

from typing import Dict, Any, List

from ..models import GenerateEpisodeResponse, EpisodeSource
from .news import fetch_news
from .script import generate_podcast_script
from .tts import synthesize_audio


async def generate_episode(topic: str, length: str = "short") -> Dict[str, Any]:
    """
    High-level POC pipeline function.

    For now, this stitches together placeholder implementations so the
    API contract is in place even before real integrations are added.
    """
    articles = await fetch_news(topic)

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

    return response.model_dump()

