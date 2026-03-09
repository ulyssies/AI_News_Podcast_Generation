"""
script.py
---------

Generates a podcast-style script from news articles using OpenAI only:
- Summarize articles into bullet points
- Draft podcast script (intro, developments, conclusion) from those bullets
"""

import asyncio
import os
from typing import Dict, List, Optional

from openai import OpenAI


def _openai_client() -> Optional[OpenAI]:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    return OpenAI(api_key=key) if key else None


def _summarize_articles_sync(articles: List[Dict]) -> str:
    """Use OpenAI to summarize articles into bullet points."""
    client = _openai_client()
    if not client:
        return "\n".join(
            f"- {a.get('title', '')}: {a.get('snippet', '')}" for a in articles
        )

    try:
        content = "\n\n".join(
            f"**{a.get('title', 'Untitled')}** ({a.get('publisher', '')})\n{a.get('snippet', '')}"
            for a in articles[:20]
        )
        prompt = (
            "Summarize the following news items into clear, factual bullet points "
            "suitable for a news podcast. One bullet per main point. Be concise.\n\n"
            f"{content}"
        )
        resp = client.chat.completions.create(
            model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
        )
        return resp.choices[0].message.content or ""
    except Exception:
        return "\n".join(
            f"- {a.get('title', '')}: {a.get('snippet', '')}" for a in articles
        )


def _draft_script_sync(topic: str, bullet_summary: str, length: str) -> str:
    """Use OpenAI to draft the podcast script from bullet points."""
    client = _openai_client()
    if not client:
        return (
            f"Today's briefing on {topic}. "
            "Here's a summary of the latest coverage. " + bullet_summary[:500]
        )

    length_guide = {
        "short": (
            "LENGTH: Write at least 600 words (about 4–5 minutes when read aloud). "
            "This is the SHORT format—be substantive but concise."
        ),
        "medium": (
            "LENGTH: Write at least 1,800 words (about 12–15 minutes when read aloud). "
            "This is the MEDIUM format—significantly longer than short. Cover the topic in depth with multiple segments and context."
        ),
        "long": (
            "LENGTH: Write at least 3,500 words (about 25–30 minutes when read aloud). "
            "This is the LONG format—a full deep-dive. Include thorough context, multiple angles, and a detailed conclusion."
        ),
    }.get(
        length,
        "LENGTH: Write at least 600 words (about 4–5 minutes when read aloud).",
    )

    prompt = f"""You are writing a news podcast script. Be neutral and factual.

Topic: {topic}

Bullet-point summary of the latest coverage:
{bullet_summary}

Write a script with:
- A brief introduction (what we're covering)
- Key developments (main facts only)
- Brief context where helpful
- A short conclusion

{length_guide}
CRITICAL: Meet the minimum word count for the chosen length. Do not stop early.
Output only the script text, no labels or section headers. Write for spoken delivery."""

    # Token budget so long scripts (30 min ≈ 4500 words) fit in one response
    max_tokens_by_length = {"short": 1200, "medium": 3500, "long": 6500}
    max_tokens = max_tokens_by_length.get(length, 1200)

    try:
        resp = client.chat.completions.create(
            model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception:
        return (
            f"Today's briefing on {topic}. "
            "Here's a summary of the latest coverage. " + bullet_summary[:500]
        )


async def generate_podcast_script(
    topic: str, articles: List[Dict], length: str = "short"
) -> str:
    """
    Summarize articles (OpenAI) then draft podcast script (OpenAI).
    Runs sync API calls in a thread pool so the event loop is not blocked.
    """
    if not articles:
        return (
            f"Today's briefing on {topic}. "
            "We couldn't find recent coverage for this topic. Try a different query or check back later."
        )

    loop = asyncio.get_event_loop()
    bullet_summary = await loop.run_in_executor(
        None, lambda: _summarize_articles_sync(articles)
    )
    script = await loop.run_in_executor(
        None, lambda: _draft_script_sync(topic, bullet_summary, length)
    )
    return script.strip()
