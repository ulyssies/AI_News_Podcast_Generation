"""
script.py
---------

Podcast script from news: Anthropic Claude (script) + OpenAI fallback.
TTS stays in pipeline (OpenAI).
"""

import asyncio
import os
from collections import defaultdict
from typing import Dict, List, Optional

from openai import OpenAI

from news import FULL_BRIEFING_SECTION_ORDER, SECTION_DISPLAY_NAMES

try:
    import anthropic
except ImportError:
    anthropic = None  # type: ignore

BROADCAST_SYSTEM_PROMPT = """You are a broadcast journalist writing for audio news briefings.

Rules:
- Neutral, factual tone only. No opinion, no spin, no editorial framing.
- Do not favor any political party, ideology, or outlet. Present facts; attribute claims to sources when relevant.
- No hype, no clickbait phrasing. Plain, clear English for listeners.
- For politics: cover multiple perspectives fairly when stories are contested; do not imply one side is right.
"""

FULL_DAILY_DRAFT_ADDENDUM = """
This is the FULL DAILY BRIEFING covering multiple news sections in order.
Write one continuous script that flows like a professional radio newscast.
Use brief, natural transitions between topic areas (e.g. "Now turning to the markets—", "In science and research today—", "On the technology front—").
Do not use section headers in the script; only smooth spoken transitions.
"""


def _openai_client() -> Optional[OpenAI]:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    return OpenAI(api_key=key) if key else None


def _anthropic_client():
    if not anthropic:
        return None
    key = (os.environ.get("ANTHROPIC_API_KEY") or "").strip()
    if not key:
        return None
    return anthropic.Anthropic(api_key=key)


def _anthropic_complete(
    prompt: str, max_tokens: int, system: Optional[str] = None
) -> Optional[str]:
    client = _anthropic_client()
    if not client:
        return None
    model = (
        os.environ.get("ANTHROPIC_MODEL") or "claude-sonnet-4-20250514"
    ).strip()
    kwargs = {
        "model": model,
        "max_tokens": min(max_tokens, 8192),
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        kwargs["system"] = system
    try:
        msg = client.messages.create(**kwargs)
        if not msg.content:
            return None
        out = []
        for block in msg.content:
            if getattr(block, "type", None) == "text" and getattr(block, "text", None):
                out.append(block.text)
        return "".join(out).strip() or None
    except Exception:
        return None


def _openai_complete(prompt: str, max_tokens: int) -> Optional[str]:
    client = _openai_client()
    if not client:
        return None
    try:
        resp = client.chat.completions.create(
            model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": BROADCAST_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            max_tokens=max_tokens,
        )
        return (resp.choices[0].message.content or "").strip() or None
    except Exception:
        return None


def _complete_user_prompt(
    prompt: str, max_tokens: int, use_full_system: bool = True
) -> Optional[str]:
    sys = BROADCAST_SYSTEM_PROMPT if use_full_system else None
    if (os.environ.get("ANTHROPIC_API_KEY") or "").strip():
        text = _anthropic_complete(prompt, max_tokens, system=sys)
        if text:
            return text
    return _openai_complete(prompt, max_tokens)


def _articles_grouped_by_section(articles: List[Dict]) -> str:
    """Build labeled blocks for full-daily summarization."""
    by_label: Dict[str, List[Dict]] = defaultdict(list)
    order_labels = [SECTION_DISPLAY_NAMES[k] for k in FULL_BRIEFING_SECTION_ORDER]
    for a in articles:
        label = a.get("_briefing_section") or "General"
        by_label[label].append(a)
    parts = []
    for label in order_labels:
        if label not in by_label:
            continue
        block = "\n\n".join(
            f"**{x.get('title', '')}** ({x.get('publisher', '')})\n{x.get('snippet', '')}"
            for x in by_label[label][:8]
        )
        parts.append(f"### {label}\n{block}")
    for label, lst in by_label.items():
        if label in order_labels:
            continue
        block = "\n\n".join(
            f"**{x.get('title', '')}** ({x.get('publisher', '')})\n{x.get('snippet', '')}"
            for x in lst[:6]
        )
        parts.append(f"### {label}\n{block}")
    return "\n\n".join(parts)


def _summarize_articles_sync(
    articles: List[Dict], briefing_mode: str
) -> str:
    if briefing_mode == "full_daily":
        grouped = _articles_grouped_by_section(articles)
        prompt = (
            "The following news items are grouped by editorial section. "
            "Summarize into clear factual bullet points, keeping the same section groupings "
            "(use a short section title before each group). Suitable for a news podcast. Be concise.\n\n"
            f"{grouped}"
        )
    else:
        content = "\n\n".join(
            f"**{a.get('title', 'Untitled')}** ({a.get('publisher', '')})\n{a.get('snippet', '')}"
            for a in articles[:14]
        )
        prompt = (
            "Summarize the following news items into clear, factual bullet points "
            "suitable for a news podcast. One bullet per main point. Be concise.\n\n"
            f"{content}"
        )
    result = _complete_user_prompt(prompt, 1200)
    if result:
        return result
    return "\n".join(
        f"- {a.get('title', '')}: {a.get('snippet', '')}" for a in articles[:10]
    )


def _draft_script_sync(
    topic: str,
    bullet_summary: str,
    length: str,
    briefing_mode: str,
    category_key: Optional[str],
) -> str:
    length_guide = {
        "short": (
            "LENGTH: Write at least 600 words (about 4–5 minutes when read aloud). "
            "This is the SHORT format—be substantive but concise."
        ),
        "medium": (
            "LENGTH: Write at least 1,800 words (about 12–15 minutes when read aloud). "
            "This is the MEDIUM format—significantly longer than short."
        ),
        "long": (
            "LENGTH: Write at least 3,500 words (about 25–30 minutes when read aloud). "
            "This is the LONG format—a full deep-dive."
        ),
    }.get(
        length,
        "LENGTH: Write at least 600 words (about 4–5 minutes when read aloud).",
    )

    politics_note = ""
    if category_key == "politics":
        politics_note = (
            "\nPOLITICS SEGMENT: Present competing viewpoints and official positions "
            "without favoring any side. Attribute factual claims to their sources.\n"
        )

    full_note = FULL_DAILY_DRAFT_ADDENDUM if briefing_mode == "full_daily" else ""

    prompt = f"""You are writing today's audio news briefing. Topic focus: {topic}

Research summary (bullet points):
{bullet_summary}
{politics_note}{full_note}
Structure:
- Brief introduction (what listeners will hear)
- Main developments (facts only)
- Context only where it helps understanding
- Short sign-off

{length_guide}
CRITICAL: Meet the minimum word count. Output only the spoken script—no headings, stage directions, or markdown."""

    max_tokens_by_length = {"short": 1200, "medium": 3500, "long": 6500}
    max_tokens = max_tokens_by_length.get(length, 1200)

    result = _complete_user_prompt(prompt, max_tokens)
    if result:
        return result
    return (
        f"Today's briefing on {topic}. "
        "Here's a summary of the latest coverage. " + bullet_summary[:500]
    )


async def generate_podcast_script(
    topic: str,
    articles: List[Dict],
    length: str = "short",
    *,
    briefing_mode: str = "category",
    category_key: Optional[str] = None,
) -> str:
    if not articles:
        return (
            f"Today's briefing on {topic}. "
            "We couldn't find enough recent coverage. Try again later."
        )

    loop = asyncio.get_event_loop()
    bullet_summary = await loop.run_in_executor(
        None, lambda: _summarize_articles_sync(articles, briefing_mode)
    )
    script = await loop.run_in_executor(
        None,
        lambda: _draft_script_sync(
            topic, bullet_summary, length, briefing_mode, category_key
        ),
    )
    return script.strip()
