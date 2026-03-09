"""
trending.py
-----------

Fetches and ranks trending news topics for discovery (e.g. last 7 days by volume).
Uses Google News RSS across multiple sections; designed to be swappable with
a dedicated trending API (e.g. filters: world, business, tech, sports, entertainment).
"""

import re
from collections import Counter
from typing import List, Optional

import httpx

# Sections to query for headline volume (extensible for filters later)
DEFAULT_SECTIONS = [
    "world news",
    "technology",
    "business",
    "sports",
    "entertainment",
]

# Stopwords to exclude from headline-derived topics
STOPWORDS = frozenset(
    {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "as", "is", "are", "was", "were", "be",
        "been", "being", "have", "has", "had", "do", "does", "did", "will",
        "would", "could", "should", "may", "might", "must", "can", "this",
        "that", "these", "those", "it", "its", "not", "you", "your", "we",
        "our", "they", "their", "he", "she", "his", "her", "news", "says",
        "year", "new", "first", "one", "two", "over", "after", "before",
    }
)

MAX_TOPICS = 10
MIN_TOPIC_LENGTH = 3
MIN_WORD_LENGTH = 4
MAX_TOPIC_CHARS = 35
MAX_TOPIC_WORDS = 4


async def _fetch_headlines_for_query(query: str, max_items: int = 15) -> List[str]:
    """Fetch article titles from Google News RSS for one query. Returns list of title strings."""
    from urllib.parse import quote_plus
    import xml.etree.ElementTree as ET

    encoded = quote_plus(query)
    url = f"https://news.google.com/rss/search?q={encoded}&hl=en-US&gl=US&ceid=US:en"
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=12.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            root = ET.fromstring(resp.text)
    except Exception:
        return []

    channel = root.find("channel")
    if channel is None:
        return []

    titles: List[str] = []
    for item in channel.findall("item")[:max_items]:
        title_el = item.find("title")
        if title_el is not None and title_el.text:
            t = (title_el.text or "").strip()
            if t:
                titles.append(t)
    return titles


def _clean_title_for_topic(title: str) -> str:
    """Strip source suffix (e.g. ' - BBC News') and trim."""
    return re.sub(r"\s*[-–—|]\s*[A-Za-z0-9\s]+$", "", title).strip()


def _extract_words_from_titles(titles: List[str]) -> Counter:
    """Tokenize titles and count words (min length, not stopwords)."""
    counter: Counter = Counter()
    for title in titles:
        words = re.findall(r"[A-Za-z0-9]+", title)
        for w in words:
            lower = w.lower()
            if len(lower) >= MIN_WORD_LENGTH and lower not in STOPWORDS:
                counter[lower] += 1
    return counter


def _extract_bigrams_from_titles(titles: List[str]) -> Counter:
    """Extract adjacent word pairs (bigrams) for short 2-word topics."""
    counter: Counter = Counter()
    for title in titles:
        words = [
            w.lower()
            for w in re.findall(r"[A-Za-z0-9]+", title)
            if len(w) >= MIN_WORD_LENGTH and w.lower() not in STOPWORDS
        ]
        for i in range(len(words) - 1):
            bigram = f"{words[i]} {words[i+1]}"
            if len(bigram) <= MAX_TOPIC_CHARS:
                counter[bigram] += 1
    return counter


def _short_headline_snippet(title: str, max_words: int = MAX_TOPIC_WORDS, max_chars: int = MAX_TOPIC_CHARS) -> Optional[str]:
    """First few words of a cleaned title, no truncation mid-word. Returns None if too long or empty."""
    cleaned = _clean_title_for_topic(title)
    words = cleaned.split()
    if not words:
        return None
    taken = words[:max_words]
    snippet = " ".join(taken)
    if len(snippet) > max_chars:
        snippet = snippet[: max_chars + 1].rsplit(" ", 1)[0] or snippet[:max_chars]
    return snippet.strip() if len(snippet) >= 8 else None


def _rank_and_select_topics(
    section_titles: List[str],
    word_counts: Counter,
    max_topics: int = MAX_TOPICS,
) -> List[str]:
    """
    Produce a varied list of short topic labels (no long headlines).
    Mix of single words, 2-word phrases, and very short snippets. All capped in length.
    """
    import random
    seen_lower: set = set()
    singles: List[str] = []
    bigrams: List[str] = []
    snippets: List[str] = []

    bigram_counts = _extract_bigrams_from_titles(section_titles)

    # Single words (high volume)
    for word, _ in word_counts.most_common(20):
        if len(word) < MIN_TOPIC_LENGTH:
            continue
        key = word.lower()
        if key in seen_lower:
            continue
        seen_lower.add(key)
        singles.append(word.capitalize())

    # 2-word phrases (bigrams)
    for phrase, _ in bigram_counts.most_common(15):
        if len(phrase) > MAX_TOPIC_CHARS:
            continue
        key = phrase.lower()
        if key in seen_lower:
            continue
        seen_lower.add(key)
        words = phrase.split()
        if len(words) != 2:
            continue
        bigrams.append(f"{words[0].capitalize()} {words[1].capitalize()}")

    # Very short headline snippets (first 3–4 words only, capped)
    for t in section_titles[:30]:
        if len(snippets) >= 3:
            break
        snip = _short_headline_snippet(t, max_words=4, max_chars=MAX_TOPIC_CHARS)
        if not snip:
            continue
        key = snip.lower()
        if key in seen_lower:
            continue
        seen_lower.add(key)
        snippets.append(snip)

    # Build mixed list: take from each pool then shuffle so it's not uniform
    result: List[str] = []
    n = max_topics
    # Roughly a third each, but take what we have
    take_s = min(len(singles), max(2, n // 3))
    take_b = min(len(bigrams), max(2, n // 3))
    take_snip = min(len(snippets), n - take_s - take_b)
    result.extend(singles[:take_s])
    result.extend(bigrams[:take_b])
    result.extend(snippets[:take_snip])
    # Fill remaining with whatever is left
    used = take_s + take_b + take_snip
    if used < n and singles[take_s:]:
        result.extend(singles[take_s : take_s + n - used])
    elif used < n and bigrams[take_b:]:
        result.extend(bigrams[take_b : take_b + n - used])
    result = result[:max_topics]
    random.shuffle(result)
    return result


async def get_trending_topics(
    sections: Optional[List[str]] = None,
    max_topics: int = MAX_TOPICS,
) -> List[str]:
    """
    Fetch and rank trending topics from recent headlines.
    Returns 5–10 topic strings for discovery UI.
    """
    sections = sections or DEFAULT_SECTIONS
    all_titles: List[str] = []

    for query in sections:
        titles = await _fetch_headlines_for_query(query, max_items=12)
        all_titles.extend(titles)

    if not all_titles:
        return []

    word_counts = _extract_words_from_titles(all_titles)
    return _rank_and_select_topics(all_titles, word_counts, max_topics=max_topics)
