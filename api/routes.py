import json
import logging
import traceback

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .services.pipeline import generate_episode, generate_episode_stream
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


@router.post("/generate/stream")
async def generate_stream_endpoint(payload: GenerateRequest):
    """
    Same as POST /generate but streams Server-Sent Events with real progress.
    Events: data: {"percent": 10, "message": "..."} then ... data: {"percent": 100, "result": {...}}
    """
    key = _cache_key(payload.topic, payload.length)
    if key in _episode_cache:
        async def cached_stream():
            yield f"data: {json.dumps({'percent': 100, 'result': _episode_cache[key]})}\n\n"
        return StreamingResponse(
            cached_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    async def event_stream():
        try:
            async for percent, message, result in generate_episode_stream(
                topic=payload.topic, length=payload.length
            ):
                if result is not None:
                    while len(_episode_cache) >= MAX_EPISODE_CACHE:
                        _episode_cache.pop(next(iter(_episode_cache)))
                    _episode_cache[key] = result
                    yield f"data: {json.dumps({'percent': percent, 'result': result})}\n\n"
                else:
                    yield f"data: {json.dumps({'percent': percent, 'message': message})}\n\n"
        except Exception as e:
            logger.exception("Generate stream failed")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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

