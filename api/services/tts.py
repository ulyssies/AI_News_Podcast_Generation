"""
tts.py
------

Converts a podcast script into spoken audio using OpenAI TTS.
Chunks long scripts to stay under the API limit (~4096 chars), then concatenates
the audio. Returns a data URL (base64) so the frontend can play it without file storage.
"""

import asyncio
import base64
import logging
import os
from typing import List, Optional

from openai import OpenAI

logger = logging.getLogger(__name__)

# OpenAI TTS input limit is 4096. Smaller chunks = faster per request (~30–60s each).
TTS_MAX_CHARS = 1200
# Timeout per chunk; with tts-1 and ~1200 chars this is ample
TTS_REQUEST_TIMEOUT = 90.0


def _client() -> Optional[OpenAI]:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        return None
    return OpenAI(api_key=key, timeout=TTS_REQUEST_TIMEOUT)


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
        last_space = segment.rfind(" ")
        if last_space > max_chars // 2:
            chunk = segment[:last_space].strip()
            rest = rest[last_space:].strip()
        else:
            chunk = segment
            rest = rest[max_chars:].strip()
        if chunk:
            chunks.append(chunk)
    return chunks


def _synthesize_one_chunk_sync(text: str, voice: str) -> bytes:
    """Call OpenAI TTS for a single chunk; returns raw audio bytes."""
    client = _client()
    if not client or not (text or "").strip():
        return b""
    try:
        # tts-1 is fast (~30–60s per chunk); tts-1-hd is higher quality but 3–5x slower
        model = (os.environ.get("OPENAI_TTS_MODEL") or "tts-1").strip() or "tts-1"
        resp = client.audio.speech.create(
            model=model,
            voice=voice,
            input=text.strip(),
        )
        return resp.content or b""
    except Exception as e:
        logger.warning("TTS chunk failed: %s", e, exc_info=True)
        return b""


def get_chunks(script: str, max_chars: int = TTS_MAX_CHARS) -> List[str]:
    """Return script split into TTS-sized chunks (for progress reporting)."""
    return _chunk_script(script, max_chars)


async def synthesize_one_chunk(chunk: str, voice: Optional[str] = None) -> bytes:
    """Synthesize a single chunk in a thread; used by pipeline for per-chunk progress."""
    voice = _normalize_voice(voice)
    loop = asyncio.get_event_loop()
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(
                None, lambda: _synthesize_one_chunk_sync(chunk, voice)
            ),
            timeout=TTS_REQUEST_TIMEOUT,
        )
    except asyncio.TimeoutError:
        logger.warning(
            "TTS chunk timed out after %.0fs (chunk length %d chars); skipping.",
            TTS_REQUEST_TIMEOUT,
            len(chunk or ""),
        )
        return b""


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
