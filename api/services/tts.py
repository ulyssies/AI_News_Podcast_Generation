"""
tts.py
------

Converts a podcast script into spoken audio using OpenAI TTS.
Chunks long scripts to stay under the API limit (~4096 chars), then concatenates
the audio. Returns a data URL (base64) so the frontend can play it without file storage.
"""

import base64
import os
from typing import List, Optional

from openai import OpenAI

# OpenAI TTS input limit; chunk below this to be safe
TTS_MAX_CHARS = 4000


def _client() -> Optional[OpenAI]:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    return OpenAI(api_key=key) if key else None


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
        resp = client.audio.speech.create(
            model=os.environ.get("OPENAI_TTS_MODEL", "tts-1"),
            voice=voice,
            input=text.strip(),
        )
        return resp.content or b""
    except Exception:
        return b""


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
    import asyncio

    voice = (voice or os.environ.get("OPENAI_TTS_VOICE", "alloy")).lower()
    allowed = ("alloy", "echo", "fable", "onyx", "shimmer", "nova")
    if voice not in allowed:
        voice = "alloy"

    loop = asyncio.get_event_loop()
    audio_bytes = await loop.run_in_executor(
        None, lambda: _synthesize_full_script_sync(script, voice)
    )
    if not audio_bytes:
        return ""
    b64 = base64.b64encode(audio_bytes).decode("ascii")
    return f"data:audio/mpeg;base64,{b64}"
