"""
news.py
--------

Fetches recent news via Google News RSS (no key) or NewsAPI (NEWS_API_KEY).
Supports curated category queries and a balanced politics mix (when NewsAPI available).
"""

import re
from typing import Dict, List, Optional, Set
from urllib.parse import quote_plus

import httpx

NEWS_API_KEY: Optional[str] = None

# Order for the full daily briefing (front page → sections)
FULL_BRIEFING_SECTION_ORDER = [
    "current_events",
    "financial_report",
    "science",
    "tech_ai",
    "health_wellness",
    "sports",
    "entertainment",
    "politics",
]

SECTION_DISPLAY_NAMES = {
    "current_events": "Current Events",
    "financial_report": "Financial Report",
    "science": "Latest in Science",
    "tech_ai": "Tech & AI",
    "health_wellness": "Health & Wellness",
    "sports": "Sports",
    "entertainment": "Entertainment",
    "politics": "Politics",
}

# Tailored search queries per category (OR-style for broader coverage)
CATEGORY_SEARCH_QUERIES: Dict[str, str] = {
    "current_events": (
        "breaking news today OR top stories today OR world news today OR major news"
    ),
    "financial_report": (
        "stock market today OR S&P 500 OR Federal Reserve OR inflation rate OR "
        "earnings report OR economic outlook OR Wall Street OR interest rates"
    ),
    "science": (
        "scientific breakthrough OR NASA OR space exploration OR climate research OR "
        "new study OR medical discovery OR physics OR biology research"
    ),
    "tech_ai": (
        "artificial intelligence OR OpenAI OR Google AI OR tech startup OR "
        "cybersecurity OR semiconductor OR Apple OR Microsoft OR Meta AI"
    ),
    "health_wellness": (
        "health study OR medical news OR FDA approval OR mental health OR "
        "nutrition research OR disease outbreak OR public health OR NIH"
    ),
    "sports": (
        "NFL OR NBA OR MLB OR NHL OR soccer OR Olympics OR sports scores OR "
        "trade deadline OR championship OR playoffs"
    ),
    "entertainment": (
        "box office OR new movie OR music release OR Grammy OR Oscar OR "
        "Netflix OR streaming OR celebrity OR album release OR TV show"
    ),
    "politics": (
        "Congress OR Senate OR White House OR legislation OR election OR "
        "Supreme Court OR foreign policy OR presidential"
    ),
}


def _get_news_api_key() -> Optional[str]:
    import os
    return os.environ.get("NEWS_API_KEY") or NEWS_API_KEY


DEFAULT_MAX_ARTICLES = 8


async def fetch_news(topic: str, max_articles: int = DEFAULT_MAX_ARTICLES) -> List[Dict]:
    """Generic topic fetch (legacy / fallback)."""
    key = _get_news_api_key()
    if key:
        try:
            return await _fetch_news_api(topic, key, max_articles)
        except Exception:
            pass
    return await _fetch_google_news_rss(topic, max_articles)


async def fetch_news_for_category_key(
    category_key: str, max_articles: int = DEFAULT_MAX_ARTICLES
) -> List[Dict]:
    """Fetch news for a curated briefing category."""
    if category_key == "politics":
        return await _fetch_politics_balanced(max_articles)
    query = CATEGORY_SEARCH_QUERIES.get(
        category_key, CATEGORY_SEARCH_QUERIES["current_events"]
    )
    return await fetch_news(query, max_articles=max_articles)


async def fetch_full_daily_briefing_articles(max_total: int) -> List[Dict]:
    """
    Pull from every section in fixed order; merge and dedupe by URL.
    Each article gets _briefing_section for script structuring.
    """
    n_sections = len(FULL_BRIEFING_SECTION_ORDER)
    per = max(2, max_total // n_sections)
    seen_urls: Set[str] = set()
    out: List[Dict] = []

    for section_key in FULL_BRIEFING_SECTION_ORDER:
        if section_key == "politics":
            batch = await _fetch_politics_balanced(per)
        else:
            query = CATEGORY_SEARCH_QUERIES.get(section_key, "news")
            batch = await fetch_news(query, max_articles=per)
        label = SECTION_DISPLAY_NAMES.get(section_key, section_key)
        for a in batch:
            url = (a.get("url") or "").strip()
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            row = dict(a)
            row["_briefing_section"] = label
            out.append(row)
    return out


async def _fetch_politics_balanced(max_articles: int) -> List[Dict]:
    """
    Aim for balance across perspectives: with NewsAPI, split between
    typically left- and right-leaning domains; otherwise alternate RSS queries.
    """
    key = _get_news_api_key()
    half = max(1, max_articles // 2)
    q = CATEGORY_SEARCH_QUERIES["politics"]
    if key:
        try:
            left = await _fetch_news_api_domains(
                q, "cnn.com,msnbc.com,theguardian.com", key, half
            )
            right = await _fetch_news_api_domains(
                q, "foxnews.com,nypost.com,washingtonexaminer.com", key, half
            )
            merged: List[Dict] = []
            for a in left:
                merged.append(a)
            for a in right:
                if a.get("url") and a["url"] not in {x.get("url") for x in merged}:
                    merged.append(a)
            return merged[:max_articles]
        except Exception:
            pass
    # RSS fallback: two query flavors
    a = await _fetch_google_news_rss(f"{q} CNN OR Reuters", half + 1)
    b = await _fetch_google_news_rss(f"{q} Fox News OR Wall Street Journal", half + 1)
    merged = []
    urls: Set[str] = set()
    for lst in (a, b):
        for item in lst:
            u = item.get("url") or ""
            if u and u not in urls:
                urls.add(u)
                merged.append(item)
            if len(merged) >= max_articles:
                return merged
    return merged[:max_articles]


async def _fetch_news_api_domains(
    query: str, domains: str, api_key: str, max_articles: int
) -> List[Dict]:
    url = "https://newsapi.org/v2/everything"
    params = {
        "q": query,
        "domains": domains,
        "apiKey": api_key,
        "pageSize": min(max_articles, 20),
        "sortBy": "publishedAt",
        "language": "en",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
    articles = data.get("articles") or []
    return [
        {
            "title": a.get("title") or "Untitled",
            "url": a.get("url") or "",
            "publisher": a.get("source", {}).get("name")
            if isinstance(a.get("source"), dict)
            else None,
            "snippet": (a.get("description") or a.get("content") or "")[:500],
        }
        for a in articles
        if a.get("url")
    ][:max_articles]


async def _fetch_google_news_rss(topic: str, max_articles: int) -> List[Dict]:
    encoded = quote_plus(topic)
    url = f"https://news.google.com/rss/search?q={encoded}&hl=en-US&gl=US&ceid=US:en"
    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        text = resp.text

    import xml.etree.ElementTree as ET

    root = ET.fromstring(text)
    channel = root.find("channel")
    if channel is None:
        return []

    items: List[Dict] = []
    for item in channel.findall("item")[:max_articles]:
        title_el = item.find("title")
        link_el = item.find("link")
        source_el = item.find("source")
        desc_el = item.find("description")

        title = (title_el.text or "").strip() if title_el is not None else ""
        link = (link_el.text or "").strip() if link_el is not None else ""
        publisher = None
        if source_el is not None and source_el.text:
            publisher = source_el.text.strip()
        snippet = None
        if desc_el is not None and desc_el.text:
            snippet = re.sub(r"<[^>]+>", "", desc_el.text).strip()[:500]

        if not link:
            continue
        items.append({
            "title": title or "Untitled",
            "url": link,
            "publisher": publisher,
            "snippet": snippet or title,
        })
    return items


async def _fetch_news_api(topic: str, api_key: str, max_articles: int) -> List[Dict]:
    url = "https://newsapi.org/v2/everything"
    params = {
        "q": topic,
        "apiKey": api_key,
        "pageSize": min(max_articles, 20),
        "sortBy": "publishedAt",
        "language": "en",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    articles = data.get("articles") or []
    return [
        {
            "title": a.get("title") or "Untitled",
            "url": a.get("url") or "",
            "publisher": a.get("source", {}).get("name")
            if isinstance(a.get("source"), dict)
            else None,
            "snippet": (a.get("description") or a.get("content") or "")[:500],
        }
        for a in articles
        if a.get("url")
    ][:max_articles]
