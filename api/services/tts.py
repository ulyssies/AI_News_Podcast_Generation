"""
tts.py
------

Converts podcast script text into spoken audio using OpenAI TTS.
The streaming pipeline requests chunks as they become available; legacy/cache paths
can still concatenate chunks into a single data URL for playback without file storage.
"""

import asyncio
import base64
import concurrent.futures
import logging
import os
import threading
from typing import List, Optional

# Dedicated pool so concurrent TTS requests don't compete with other thread work.
# One thread per chunk; 12 covers the largest realistic script (long episode ~10 chunks).
_TTS_EXECUTOR = concurrent.futures.ThreadPoolExecutor(
    max_workers=12, thread_name_prefix="tts-worker"
)

from openai import OpenAI

logger = logging.getLogger(__name__)
_OPENAI_CLIENT: Optional[OpenAI] = None
_OPENAI_CLIENT_KEY: Optional[str] = None
_OPENAI_CLIENT_LOCK = threading.Lock()

# OpenAI TTS input limit is 4096. Smaller chunks start earlier while Claude streams,
# so audio synthesis overlaps with generation instead of waiting for the full script.
TTS_MAX_CHARS = 800
# Timeout per chunk; with tts-1 and ~800 chars this is ample.
TTS_REQUEST_TIMEOUT = 90.0
TTS_MAX_ATTEMPTS = 3


def _client() -> Optional[OpenAI]:
    global _OPENAI_CLIENT, _OPENAI_CLIENT_KEY
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        return None
    with _OPENAI_CLIENT_LOCK:
        if _OPENAI_CLIENT is None or _OPENAI_CLIENT_KEY != key:
            _OPENAI_CLIENT = OpenAI(api_key=key, timeout=TTS_REQUEST_TIMEOUT)
            _OPENAI_CLIENT_KEY = key
        return _OPENAI_CLIENT


def ensure_tts_configured() -> None:
    """Fail before script generation if the backend cannot possibly synthesize audio."""
    if not (os.environ.get("OPENAI_API_KEY") or "").strip():
        raise RuntimeError(
            "OPENAI_API_KEY is not loaded in the backend process. "
            "Add it to api/.env or restart the local API after updating the environment."
        )


def _chunk_script(script: str, max_chars: int = TTS_MAX_CHARS) -> List[str]:
    """Split script into chunks at word boundaries so we stay under max_chars per chunk."""
    if not script or not script.strip():
        return []
    chunks: List[str] = []
    rest = script.strip()
    while rest:
        if len(rest) <= max_chars:
            chunks.append(rest)
            break
        segment = rest[:max_chars]
        split_at = -1
        for sep in (". ", "! ", "? ", ".\n", "!\n", "?\n"):
            idx = segment.rfind(sep)
            if idx > max_chars // 2:
                split_at = idx + len(sep)
                break
        if split_at == -1:
            last_space = segment.rfind(" ")
            split_at = last_space if last_space > max_chars // 2 else max_chars
        chunk = rest[:split_at].strip()
        rest = rest[split_at:].strip()
        if chunk:
            chunks.append(chunk)
    return chunks


def _synthesize_one_chunk_sync(text: str, voice: str) -> bytes:
    """Call OpenAI TTS for a single chunk; returns raw audio bytes."""
    client = _client()
    if not client:
        raise RuntimeError(
            "OPENAI_API_KEY is not loaded in the backend process. "
            "Add it to api/.env or restart the local API after updating the environment."
        )
    if not (text or "").strip():
        return b""
    # tts-1 keeps the demo path low-latency; hd variants are noticeably slower.
    model = (os.environ.get("OPENAI_TTS_MODEL") or "tts-1").strip() or "tts-1"
    resp = client.audio.speech.create(
        model=model,
        voice=voice,
        input=text.strip(),
    )
    return resp.content or b""


def get_chunks(script: str, max_chars: int = TTS_MAX_CHARS) -> List[str]:
    """Return script split into TTS-sized chunks (for progress reporting)."""
    return _chunk_script(script, max_chars)


async def synthesize_one_chunk_result(chunk: str, voice: Optional[str] = None) -> tuple[bytes, Optional[str]]:
    """Synthesize one chunk, returning an error string instead of hiding failures."""
    voice = _normalize_voice(voice)
    loop = asyncio.get_event_loop()
    last_error = ""
    for attempt in range(1, TTS_MAX_ATTEMPTS + 1):
        try:
            audio = await asyncio.wait_for(
                loop.run_in_executor(
                    _TTS_EXECUTOR, lambda: _synthesize_one_chunk_sync(chunk, voice)
                ),
                timeout=TTS_REQUEST_TIMEOUT,
            )
            if audio:
                return audio, None
            last_error = "TTS chunk returned empty audio."
        except asyncio.TimeoutError:
            last_error = (
                "TTS chunk timed out after "
                f"{TTS_REQUEST_TIMEOUT:.0f}s (chunk length {len(chunk or '')} chars)."
            )
        except Exception as e:
            last_error = str(e) or type(e).__name__
            logger.warning("TTS chunk attempt %d failed: %s", attempt, e, exc_info=True)

        if attempt < TTS_MAX_ATTEMPTS:
            await asyncio.sleep(0.5 * attempt)

    message = f"{last_error} Attempts: {TTS_MAX_ATTEMPTS}."
    logger.warning(message)
    return b"", message


async def synthesize_one_chunk(chunk: str, voice: Optional[str] = None) -> bytes:
    """Synthesize a single chunk in a thread; used by legacy paths."""
    audio, error = await synthesize_one_chunk_result(chunk, voice)
    if error:
        logger.warning(
            "TTS chunk returned no audio (chunk length %d chars): %s",
            len(chunk or ""),
            error,
        )
    return audio


def _normalize_voice(voice: Optional[str]) -> str:
    voice = (voice or os.environ.get("OPENAI_TTS_VOICE", "alloy")).lower()
    allowed = ("alloy", "echo", "fable", "onyx", "shimmer", "nova")
    return voice if voice in allowed else "alloy"


def _synthesize_full_script_sync(script: str, voice: str) -> bytes:
    """
    Chunk the script, call TTS for each chunk, concatenate raw MP3 bytes.
    Runs entirely in a thread so the event loop is not blocked.
    """
    client = _client()
    if not client:
        return b""
    if not (script or "").strip():
        return b""
    chunks = _chunk_script(script, TTS_MAX_CHARS)
    if not chunks:
        return b""
    audio_parts: List[bytes] = []
    for chunk in chunks:
        part = _synthesize_one_chunk_sync(chunk, voice)
        if part:
            audio_parts.append(part)
    if not audio_parts:
        return b""
    return b"".join(audio_parts)


async def synthesize_audio(script: str, voice: Optional[str] = None) -> str:
    """
    Convert script to speech via OpenAI TTS. Long scripts are chunked and
    synthesized in sequence, then concatenated into one audio blob.
    Returns a data URL (data:audio/mpeg;base64,...) for <audio src={audio_url} />.
    """
    voice = _normalize_voice(voice)
    loop = asyncio.get_event_loop()
    audio_bytes = await loop.run_in_executor(
        None, lambda: _synthesize_full_script_sync(script, voice)
    )
    if not audio_bytes:
        return ""
    b64 = base64.b64encode(audio_bytes).decode("ascii")
    return f"data:audio/mpeg;base64,{b64}"


def bytes_to_data_url(audio_bytes: bytes) -> str:
    """Turn raw MP3 bytes into a data URL for the frontend."""
    if not audio_bytes:
        return ""
    b64 = base64.b64encode(audio_bytes).decode("ascii")
    return f"data:audio/mpeg;base64,{b64}"
