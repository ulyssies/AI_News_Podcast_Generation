"""
news.py
--------

Fetches recent news articles for a given topic via Google News RSS
(no API key required). Optional: NewsAPI if NEWS_API_KEY is set.
"""

import re
from typing import Dict, List, Optional
from urllib.parse import quote_plus

import httpx

# Optional: set NEWS_API_KEY in .env for richer snippets from NewsAPI.org
NEWS_API_KEY: Optional[str] = None


def _get_news_api_key() -> Optional[str]:
    import os
    return os.environ.get("NEWS_API_KEY") or NEWS_API_KEY


# Fewer articles = faster summarization and slightly shorter scripts; reduces timeouts
DEFAULT_MAX_ARTICLES = 8

async def fetch_news(topic: str, max_articles: int = DEFAULT_MAX_ARTICLES) -> List[Dict]:
    """
    Fetch recent articles for the topic.
    Uses Google News RSS by default; if NEWS_API_KEY is set, uses NewsAPI first.
    Returns list of { "title", "url", "publisher", "snippet" }.
    """
    key = _get_news_api_key()
    if key:
        try:
            return await _fetch_news_api(topic, key, max_articles)
        except Exception:
            pass
    return await _fetch_google_news_rss(topic, max_articles)


async def _fetch_google_news_rss(topic: str, max_articles: int) -> List[Dict]:
    """Fetch via Google News RSS (no API key)."""
    encoded = quote_plus(topic)
    url = f"https://news.google.com/rss/search?q={encoded}&hl=en-US&gl=US&ceid=US:en"
    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        text = resp.text

    # Simple XML parse for <item> entries (avoid extra dep if we can)
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
            # Strip HTML tags for snippet
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
    """Fetch via NewsAPI.org (requires free API key at https://newsapi.org)."""
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
            "publisher": a.get("source", {}).get("name") if isinstance(a.get("source"), dict) else None,
            "snippet": (a.get("description") or a.get("content") or "")[:500],
        }
        for a in articles
        if a.get("url")
    ][:max_articles]
