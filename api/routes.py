import logging
import traceback

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .services.pipeline import generate_episode
from .services.trending import get_trending_topics

logger = logging.getLogger(__name__)


router = APIRouter()

# In-memory cache: (normalized_topic, length) -> episode response dict.
# Reusing the same topic + length returns the cached episode to save OpenAI tokens.
_episode_cache: dict = {}
MAX_EPISODE_CACHE = 50


def _cache_key(topic: str, length: str) -> tuple:
    return (topic.strip().lower(), length.strip().lower())


class GenerateRequest(BaseModel):
    topic: str
    length: str = "short"


@router.post("/generate")
async def generate_endpoint(payload: GenerateRequest):
    """
    POC endpoint:
    - accepts { "topic": str, "length": str }
    - returns { "audio_url": str, "transcript": str, "sources": [...] }
    - same topic + length returns cached episode to save tokens.
    """
    key = _cache_key(payload.topic, payload.length)
    if key in _episode_cache:
        return _episode_cache[key]

    try:
        result = await generate_episode(topic=payload.topic, length=payload.length)
        # Evict oldest entries if at capacity (dict insertion order)
        while len(_episode_cache) >= MAX_EPISODE_CACHE:
            _episode_cache.pop(next(iter(_episode_cache)))
        _episode_cache[key] = result
        return result
    except Exception as e:
        logger.exception("Generate episode failed")
        traceback.print_exc()  # so it shows in the uvicorn terminal
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {str(e)}")


@router.get("/trending-topics")
async def trending_topics_endpoint():
    """
    Returns 5–10 trending news topics for discovery (based on recent headline volume).
    """
    try:
        topics = await get_trending_topics()
        return {"topics": topics}
    except Exception as e:
        logger.exception("Trending topics failed")
        raise HTTPException(status_code=500, detail=str(e))

