from typing import List, Optional

from pydantic import BaseModel, HttpUrl


class Article(BaseModel):
    title: str
    url: HttpUrl
    publisher: Optional[str] = None
    snippet: Optional[str] = None


class EpisodeSource(BaseModel):
    title: str
    url: HttpUrl
    publisher: Optional[str] = None


class GenerateEpisodeResponse(BaseModel):
    audio_url: str
    transcript: str
    sources: List[EpisodeSource]

