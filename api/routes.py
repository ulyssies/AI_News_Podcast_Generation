import asyncio
import json
import logging
import traceback
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator
from slowapi import Limiter
from slowapi.util import get_remote_address

from api.services.pipeline import generate_episode, generate_episode_stream
from api.services.trending import get_trending_topics

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()

_episode_cache: dict = {}
_inflight_episode_results: dict = {}
MAX_EPISODE_CACHE = 50


def _cache_key(briefing_mode: str, category: Optional[str], length: str) -> tuple:
    length_n = length.strip().lower()
    if briefing_mode == "full_daily":
        return ("full_daily", length_n)
    return ("category", (category or "").strip().lower(), length_n)


class GenerateRequest(BaseModel):
    length: str = Field(default="short", description="short | medium | long")
    briefing_mode: str = Field(
        default="category",
        description="full_daily (hero) or category (single card)",
    )
    category: Optional[str] = Field(
        default=None,
        description="Category key e.g. current_events, financial_report",
    )

    @model_validator(mode="after")
    def validate_category(self):
        if self.briefing_mode == "category":
            if not (self.category or "").strip():
                raise ValueError("category is required when briefing_mode is category")
        return self


@router.post("/generate")
@limiter.limit("5/day")
async def generate_endpoint(request: Request, payload: GenerateRequest):
    key = _cache_key(payload.briefing_mode, payload.category, payload.length)
    if key in _episode_cache:
        return _episode_cache[key]
    if key in _inflight_episode_results:
        return await _inflight_episode_results[key]
    try:
        task = asyncio.create_task(
            generate_episode(
                length=payload.length,
                briefing_mode=payload.briefing_mode,
                category=payload.category,
            )
        )
        _inflight_episode_results[key] = task
        result = await task
        while len(_episode_cache) >= MAX_EPISODE_CACHE:
            _episode_cache.pop(next(iter(_episode_cache)))
        _episode_cache[key] = result
        return result
    except Exception as e:
        logger.exception("Generate episode failed")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {str(e)}")
    finally:
        _inflight_episode_results.pop(key, None)


@router.post("/generate/stream")
async def generate_stream_endpoint(payload: GenerateRequest):
    key = _cache_key(payload.briefing_mode, payload.category, payload.length)
    if key in _episode_cache:

        async def cached_stream():
            yield f"data: {json.dumps({'percent': 100, 'result': _episode_cache[key]})}\n\n"

        return StreamingResponse(
            cached_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    if key in _inflight_episode_results:

        async def inflight_stream():
            yield f"data: {json.dumps({'percent': 1, 'message': 'Joining existing generation…'})}\n\n"
            try:
                result = await _inflight_episode_results[key]
                yield f"data: {json.dumps({'percent': 100, 'result': result})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(
            inflight_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    loop = asyncio.get_running_loop()
    result_future = loop.create_future()
    _inflight_episode_results[key] = result_future

    async def event_stream():
        sent_audio_chunks = False
        # Flush a 1% event immediately so any buffering proxy releases the connection.
        # Without this, the first real event (10%) may be held in nginx's buffer for
        # 20-30 s until enough bytes accumulate to trigger an automatic flush.
        yield f"data: {json.dumps({'percent': 1, 'message': 'Connecting…'})}\n\n"
        try:
            async for percent, message, result in generate_episode_stream(
                length=payload.length,
                briefing_mode=payload.briefing_mode,
                category=payload.category,
            ):
                if result is not None:
                    if result.get("event") == "audio_chunk":
                        sent_audio_chunks = True
                        yield f"data: {json.dumps({'percent': percent, 'message': message, 'audio_chunk': result})}\n\n"
                    else:
                        while len(_episode_cache) >= MAX_EPISODE_CACHE:
                            _episode_cache.pop(next(iter(_episode_cache)))
                        _episode_cache[key] = result
                        if not result_future.done():
                            result_future.set_result(result)
                        result_for_client = dict(result)
                        if sent_audio_chunks:
                            # Live clients already received playable chunks; don't send the
                            # full base64 MP3 again in the final metadata event.
                            result_for_client["audio_url"] = ""
                        yield f"data: {json.dumps({'percent': percent, 'result': result_for_client})}\n\n"
                else:
                    yield f"data: {json.dumps({'percent': percent, 'message': message})}\n\n"
        except Exception as e:
            logger.exception("Generate stream failed")
            if not result_future.done():
                result_future.set_exception(e)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            _inflight_episode_results.pop(key, None)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/trending-topics")
async def trending_topics_endpoint():
    try:
        topics = await get_trending_topics()
        return {"topics": topics}
    except Exception as e:
        logger.exception("Trending topics failed")
        raise HTTPException(status_code=500, detail=str(e))
