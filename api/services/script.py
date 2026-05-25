"""
script.py
---------

Podcast script from news: Anthropic Claude (streaming + sync) with OpenAI fallback.
TTS stays in pipeline (OpenAI).
"""

import asyncio
import concurrent.futures
import logging
import os
import re
from collections import defaultdict
from datetime import datetime
from typing import AsyncIterator, Dict, List, Optional

_SCRIPT_EXECUTOR = concurrent.futures.ThreadPoolExecutor(
    max_workers=4, thread_name_prefix="script-worker"
)

from openai import OpenAI

from api.services.news import FULL_BRIEFING_SECTION_ORDER, SECTION_DISPLAY_NAMES

logger = logging.getLogger(__name__)

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
- Lead with news, not ceremony. Never open with "Good morning", "welcome", "I'm glad you're with us", or a preview of the whole show.
- Prioritize the freshest, highest-impact developments from the last 24-48 hours. Older items are context only and must be labeled that way in natural spoken language.
"""

FULL_DAILY_DRAFT_ADDENDUM = """
This is the FULL DAILY BRIEFING covering multiple news sections in order.
Write one continuous script that flows like a professional radio newscast.
Use brief, natural transitions between topic areas (e.g. "Now turning to the markets—", "In science and research today—", "On the technology front—").
Do not use section headers in the script; only smooth spoken transitions.
The first sentence must be the single most important fresh development across all sections, not a greeting or table of contents.
"""

WORD_TARGETS = {
    ("category", "short"): (600, 800),
    ("category", "medium"): (1500, 1700),
    ("category", "long"): (3500, 4200),
    ("full_daily", "short"): (600, 850),
    ("full_daily", "medium"): (1800, 2200),
    ("full_daily", "long"): (3500, 4500),
}


def _select_model(length: str) -> str:
    """Haiku for short/medium (faster, cheaper), Sonnet for long. Env var always wins."""
    env_override = (os.environ.get("ANTHROPIC_MODEL") or "").strip()
    if env_override:
        return env_override
    return "claude-haiku-4-5-20251001" if length != "long" else "claude-sonnet-4-6"


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
        block = "\n\n".join(_format_article_for_prompt(x) for x in by_label[label][:8])
        parts.append(f"### {label}\n{block}")
    for label, lst in by_label.items():
        if label in order_labels:
            continue
        block = "\n\n".join(_format_article_for_prompt(x) for x in lst[:6])
        parts.append(f"### {label}\n{block}")
    return "\n\n".join(parts)


def _today_label() -> str:
    return datetime.now().strftime("%A, %B %d, %Y").replace(" 0", " ")


def _format_article_for_prompt(article: Dict) -> str:
    publisher = article.get("publisher") or "Unknown publisher"
    published_at = article.get("published_at") or "unknown"
    title = article.get("title") or "Untitled"
    snippet = article.get("snippet") or ""
    return f"**{title}** ({publisher})\nPublished: {published_at}\n{snippet}"


def count_script_words(script: str) -> int:
    return len(re.findall(r"\b[\w'-]+\b", script or ""))


def minimum_word_count(length: str, briefing_mode: str) -> int:
    return WORD_TARGETS.get((briefing_mode, length), WORD_TARGETS[("category", "short")])[0]


def _length_guide(length: str, briefing_mode: str) -> str:
    if length == "medium" and briefing_mode == "category":
        return (
            "LENGTH: Write 1,500-1,700 words (about 9-11 minutes when read aloud). "
            "This is the MEDIUM category format: substantive, focused, and efficient. "
            "Do not stop at a short summary; use the extra time for confirmed facts, "
            "implications, and concise context only."
        )
    return {
        "short": (
            "LENGTH: Write at least 600 words (about 4-5 minutes when read aloud). "
            "This is the SHORT format: lead fast, cover only the highest-value developments, "
            "and skip recap/sign-off padding."
        ),
        "medium": (
            "LENGTH: Write at least 1,800 words (about 12-15 minutes when read aloud). "
            "This is the MEDIUM format: add depth through verified detail and useful context, "
            "not broad previews, filler transitions, or long conclusions."
        ),
        "long": (
            "LENGTH: Write at least 3,500 words (about 25-30 minutes when read aloud). "
            "This is the LONG format: a full briefing with meaningful depth in each section. "
            "Use the length for prioritization, context, and consequences; do not pad with greetings, "
            "show previews, generic wrap-ups, or repeated source disclaimers."
        ),
    }.get(
        length,
        "LENGTH: Write at least 600 words (about 4-5 minutes when read aloud). "
        "Lead fast and avoid filler.",
    )


def _build_prompt(
    topic: str,
    articles: List[Dict],
    length: str,
    briefing_mode: str,
    category_key: Optional[str],
) -> tuple[str, int]:
    """Build the user prompt and return (prompt, max_tokens)."""
    if briefing_mode == "full_daily":
        article_content = _articles_grouped_by_section(articles)
    else:
        article_content = "\n\n".join(_format_article_for_prompt(a) for a in articles[:14])

    length_guide = _length_guide(length, briefing_mode)

    politics_note = ""
    if category_key == "politics":
        politics_note = (
            "\nPOLITICS SEGMENT: Present competing viewpoints and official positions "
            "without favoring any side. Attribute factual claims to their sources.\n"
        )

    full_note = FULL_DAILY_DRAFT_ADDENDUM if briefing_mode == "full_daily" else ""

    mode_instruction = (
        "This is a full daily briefing across sections. Start with the strongest fresh story "
        "from any section, then move through the remaining sections in a logical order."
        if briefing_mode == "full_daily"
        else "This is a single-subject/category briefing. Start with the strongest fresh development in this topic."
    )
    freshness_gap_instruction = (
        "- If a full-daily section has no fresh article, say so briefly and move on; do not stretch stale material into that section.\n"
        if briefing_mode == "full_daily"
        else "- If fresh material is thin, lead with the freshest confirmed item, then use older supplied stories as clearly labeled context to meet the length target. Do not end early just because some stories are contextual.\n"
    )

    prompt = f"""You are writing today's audio news briefing. Topic: {topic}
Today is {_today_label()}.

Source articles:
{article_content}
{politics_note}{full_note}
Editorial priority:
- {mode_instruction}
- Lead with the freshest, highest-impact reporting from the last 24-48 hours.
- Use older stories only when they explain why the fresh story matters. Label older material naturally, e.g. "For context..." or "Earlier this month...".
- Treat sources with unknown publication dates cautiously; do not lead with them unless the title or snippet clearly indicates a current breaking development.
{freshness_gap_instruction.rstrip()}
- Rank by public importance and recency, not by the order articles appear in the source list.
- Do not invent details not present in the sources.
- Do not narrate source limitations, word counts, or production constraints. Simply state what is confirmed.

Audio style:
- First sentence must be a direct news lead. Do not greet the listener.
- Banned openings: "Good morning", "Welcome", "I'm glad you're with us", "Over the next...", "We have a lot to cover", "Let's get started".
- Banned endings: "That does it", "Thank you for spending this time", "Stay informed", "Take care".
- No table-of-contents opening. No generic recap ending. End after the final useful fact or forward-looking watch item.
- Use short spoken paragraphs, clean transitions, and direct attribution where needed.

{length_guide}
CRITICAL: Meet the word-count target through reporting depth, not filler. Output only the spoken script; no headings, stage directions, or markdown."""

    if length == "medium" and briefing_mode == "category":
        max_tokens = 3400
    else:
        max_tokens = {"short": 1200, "medium": 3500, "long": 6500}.get(length, 1200)
    return prompt, max_tokens


def _build_extension_prompt(
    topic: str,
    articles: List[Dict],
    length: str,
    briefing_mode: str,
    category_key: Optional[str],
    existing_script: str,
    missing_words: int,
) -> tuple[str, int]:
    if briefing_mode == "full_daily":
        article_content = _articles_grouped_by_section(articles)
    else:
        article_content = "\n\n".join(_format_article_for_prompt(a) for a in articles[:14])

    target_extra = max(350, missing_words + 120)
    politics_note = ""
    if category_key == "politics":
        politics_note = (
            "\nPOLITICS SEGMENT: Present competing viewpoints and official positions "
            "without favoring any side. Attribute factual claims to their sources.\n"
        )

    prompt = f"""The current audio briefing for {topic} is too short.
Today is {_today_label()}.

Existing script:
{existing_script}

Source articles:
{article_content}
{politics_note}
Write a continuation that adds about {target_extra} words.
Rules:
- Continue naturally from the existing script. Do not restart the episode.
- Do not repeat facts already covered unless adding a new implication or useful context.
- Lead any added section with the strongest unused fresh item. If fresh material is thin, use older supplied stories as clearly labeled context.
- Do not invent facts, sources, quotes, dates, or outcomes.
- No greetings, no sign-off, no recap for its own sake.
- Output only the spoken continuation text."""
    max_tokens = min(2400, max(900, int(target_extra * 1.7)))
    return prompt, max_tokens


def _anthropic_complete(
    prompt: str, max_tokens: int, length: str, system: Optional[str] = None
) -> Optional[str]:
    client = _anthropic_client()
    if not client:
        return None
    model = _select_model(length)
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
    prompt: str, max_tokens: int, length: str, use_full_system: bool = True
) -> Optional[str]:
    sys = BROADCAST_SYSTEM_PROMPT if use_full_system else None
    if (os.environ.get("ANTHROPIC_API_KEY") or "").strip():
        text = _anthropic_complete(prompt, max_tokens, length, system=sys)
        if text:
            return text
    return _openai_complete(prompt, max_tokens)


def _generate_script_sync(
    topic: str,
    articles: List[Dict],
    length: str,
    briefing_mode: str,
    category_key: Optional[str],
) -> str:
    """Generate a broadcast script directly from source articles in a single LLM call."""
    prompt, max_tokens = _build_prompt(topic, articles, length, briefing_mode, category_key)
    result = _complete_user_prompt(prompt, max_tokens, length)
    if result:
        return result
    return (
        f"Latest confirmed coverage on {topic}: "
        + "\n".join(f"- {a.get('title', '')}: {a.get('snippet', '')}" for a in articles[:10])
    )


async def stream_podcast_script(
    topic: str,
    articles: List[Dict],
    length: str = "short",
    *,
    briefing_mode: str = "category",
    category_key: Optional[str] = None,
) -> AsyncIterator[str]:
    """
    Stream the podcast script token-by-token from Claude.
    Falls back to a single yielded response if streaming is unavailable.
    """
    if not articles:
        yield f"No recent coverage was found for {topic}. Try again later."
        return

    api_key = (os.environ.get("ANTHROPIC_API_KEY") or "").strip()

    if not anthropic or not api_key:
        # No Anthropic available — run sync path in executor, yield result whole
        loop = asyncio.get_event_loop()
        text = await loop.run_in_executor(
            _SCRIPT_EXECUTOR,
            lambda: _generate_script_sync(topic, articles, length, briefing_mode, category_key),
        )
        yield text
        return

    prompt, max_tokens = _build_prompt(topic, articles, length, briefing_mode, category_key)
    model = _select_model(length)
    async_client = anthropic.AsyncAnthropic(api_key=api_key)

    try:
        async with async_client.messages.stream(
            model=model,
            max_tokens=min(max_tokens, 8192),
            system=BROADCAST_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text_delta in stream.text_stream:
                if text_delta:
                    yield text_delta
    except Exception as exc:
        logger.warning("Claude streaming failed (%s); falling back to sync.", exc)
        loop = asyncio.get_event_loop()
        text = await loop.run_in_executor(
            _SCRIPT_EXECUTOR,
            lambda: _generate_script_sync(topic, articles, length, briefing_mode, category_key),
        )
        if text:
            yield text


async def generate_podcast_script(
    topic: str,
    articles: List[Dict],
    length: str = "short",
    *,
    briefing_mode: str = "category",
    category_key: Optional[str] = None,
) -> str:
    if not articles:
        return f"No recent coverage was found for {topic}. Try again later."

    loop = asyncio.get_event_loop()
    script = await loop.run_in_executor(
        _SCRIPT_EXECUTOR,
        lambda: _generate_script_sync(topic, articles, length, briefing_mode, category_key),
    )
    return script.strip()


async def generate_script_extension(
    topic: str,
    articles: List[Dict],
    existing_script: str,
    missing_words: int,
    length: str = "short",
    *,
    briefing_mode: str = "category",
    category_key: Optional[str] = None,
) -> str:
    """Generate additional spoken script when the first pass undershoots the target."""
    if not articles or missing_words <= 0:
        return ""

    prompt, max_tokens = _build_extension_prompt(
        topic,
        articles,
        length,
        briefing_mode,
        category_key,
        existing_script,
        missing_words,
    )
    loop = asyncio.get_event_loop()
    extension = await loop.run_in_executor(
        _SCRIPT_EXECUTOR,
        lambda: _complete_user_prompt(prompt, max_tokens, length),
    )
    return (extension or "").strip()
