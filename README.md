<div align="center">

# Curated Daily Audio

**A live AI-generated daily news briefing that turns current reporting into source-linked podcast audio.**

[![Live Demo](https://img.shields.io/badge/Live-Demo-22c55e?style=for-the-badge)](https://ai-news-podcast-generation.vercel.app)
[![Portfolio Project](https://img.shields.io/badge/Portfolio-Project-6366f1?style=for-the-badge)](.)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Claude](https://img.shields.io/badge/Anthropic-Claude-c96442?style=for-the-badge)](https://anthropic.com)
[![OpenAI](https://img.shields.io/badge/OpenAI-TTS-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)

[Try the live app](https://ai-news-podcast-generation.vercel.app) | [View source](https://github.com/ulyssies/AI_News_Podcast_Generation)

</div>

---

## Overview

Curated Daily Audio is a full-stack portfolio project that generates podcast-style news briefings from current reporting. Users can choose a full daily briefing or a specific section, then listen as the app fetches fresh articles, writes a neutral broadcast script, converts it into speech, and streams playable audio chunks into a custom player.

The project is intentionally scoped as a proof of concept, but it is live, deployed, and built to show production-minded engineering decisions: progressive streaming, source transparency, in-flight request deduplication, rate limiting, caching, and a responsive dark UI.

```
NewsAPI / Google News RSS
        |
        v
Freshness-ranked article set
        |
        v
Claude script generation
        |
        v
Sentence-safe OpenAI TTS chunks
        |
        v
SSE progress + progressive audio playback
```

## What Recruiters Should Notice

- **Full-stack execution:** Next.js 16 frontend, FastAPI backend, deployed on Vercel and Render.
- **Real AI product flow:** retrieval, prompt design, LLM script generation, TTS synthesis, source links, and user-facing error states.
- **Progressive UX:** the frontend can begin playback from chunk `0` while later TTS chunks continue generating.
- **Streaming architecture:** Server-Sent Events deliver progress, sources, audio chunks, and final metadata without blocking on one large response.
- **Practical reliability choices:** duplicate in-flight generations share work, episode results are cached, and sync fallback paths still exist.
- **Design polish:** dark-first interface, custom player dock, responsive layouts, generated category cover art, and an animated broadcast globe.

## Live Product Behavior

- Generate a **full daily briefing** across eight news sections, defaulting to a short episode.
- Generate **category briefings** for current events, finance, science, sports, entertainment, tech and AI, health, or politics.
- Watch generation progress in the sticky player dock while sources and transcript content arrive.
- Start listening before the full episode is finished when contiguous TTS chunks are ready.
- Review source links for the stories used to produce the briefing.
- Reuse cached episodes for repeated category and length combinations to reduce API cost and latency.

## Tech Stack

| Layer | Tools |
|---|---|
| Frontend | Next.js 16, Pages Router, TypeScript, React 19, TailwindCSS v4, lucide-react |
| Backend | FastAPI, Python 3.11+, uvicorn, slowapi |
| AI | Anthropic Claude for script generation, OpenAI TTS for audio synthesis |
| News | NewsAPI primary source, Google News RSS fallback |
| Hosting | Vercel frontend, Render backend |
| State and storage | In-memory LRU episode cache, no database |

## Core Features

| Feature | Description |
|---|---|
| Full daily briefing | A cohesive front-page-style audio episode across all curated sections |
| Category deep dives | Single-section episodes with tailored article queries |
| Length options | Short, medium, and long briefing targets |
| Source-linked transcript | Generated script and supporting article links are shown in the UI |
| SSE streaming | Progress, sources, audio chunks, and final metadata stream from `/generate/stream` |
| Progressive playback | Only contiguous audio chunks from index `0` are exposed, preventing playback jumps |
| Sticky audio dock | Persistent player for progress, seeking, loaded duration, and playback controls |
| Fresh-first prompting | Scripts prioritize high-impact stories from the last 24-48 hours |
| Balanced politics fetch | Politics requests balance left- and right-leaning source groups when NewsAPI is available |
| Rate limiting | Sync generation endpoint is limited to 5 generations per IP per day |

## Categories

| Category | Focus |
|---|---|
| Current Events | Today's top stories from around the world |
| Financial Report | Markets, earnings, and economic trends |
| Latest in Science | Discoveries, research, and breakthroughs |
| Sports | Scores, highlights, and headlines |
| Entertainment | Movies, music, culture, and celebrity news |
| Tech & AI | Technology and artificial intelligence |
| Health & Wellness | Medical news, wellness reporting, and research |
| Politics | Balanced coverage with reduced spin |

## Architecture

1. **Fetch news:** category-specific queries pull recent stories through NewsAPI, with Google News RSS as a fallback.
2. **Prepare source context:** the backend deduplicates, balances, and orders articles so fresh and high-impact stories lead.
3. **Generate script:** Claude writes a neutral broadcast script without ceremonial filler intros or generic outros.
4. **Chunk for TTS:** text is split around sentence boundaries so audio can be synthesized while generation continues.
5. **Stream to client:** FastAPI emits SSE messages for progress, early sources, each `audio_chunk`, and final result metadata.
6. **Play progressively:** the frontend builds a chunk playlist, exposes only contiguous chunks, and falls back to full audio only when needed.

## Project Structure

```text
PodcastApp/
|-- api/
|   |-- main.py              # FastAPI app, CORS, rate limit error handler
|   |-- routes.py            # /generate, /generate/stream, /trending-topics
|   |-- models.py            # Pydantic response models
|   |-- requirements.txt
|   `-- services/
|       |-- news.py          # Category queries, full briefing fetch, politics balancing
|       |-- script.py        # Claude prompts and script generation
|       |-- tts.py           # OpenAI TTS chunking, reusable client, data URL helpers
|       |-- pipeline.py      # Orchestration, SSE progress, audio chunk streaming
|       `-- trending.py      # Trending topics via RSS
|-- web/
|   |-- pages/
|   |   `-- index.tsx        # Main UI, SSE parsing, progressive chunk state
|   |-- components/
|   |   |-- AudioPlayer.tsx
|   |   |-- BriefingPlayerDock.tsx
|   |   |-- CategoryBriefingGrid.tsx
|   |   |-- DailyBriefingHero.tsx
|   |   |-- HeroGlobeBroadcast.tsx
|   |   |-- InfoModal.tsx
|   |   `-- TranscriptHighlight.tsx
|   |-- hooks/
|   |   `-- useAudioPlayer.ts
|   |-- lib/
|   |   |-- apiClient.ts
|   |   |-- categories.ts
|   |   `-- playbackManager.ts
|   |-- public/category-covers/
|   `-- styles/
`-- README.md
```

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- OpenAI API key for TTS
- Anthropic API key for script generation
- Optional NewsAPI key for richer article retrieval

### Backend

```bash
cp api/.env.example api/.env
pip install -r api/requirements.txt
python3 -m uvicorn api.main:app --reload
```

The API runs at `http://localhost:8000`, with interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd web
npm install
npm run dev
```

The web app runs at `http://localhost:3000` and uses `http://localhost:8000` as its local API fallback.

### Environment Variables

Add these to `api/.env`. Do not commit local environment files.

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | Generates TTS audio |
| `ANTHROPIC_API_KEY` | Yes | Generates briefing scripts through Claude |
| `NEWS_API_KEY` | No | Enables richer NewsAPI results before RSS fallback |
| `OPENAI_TTS_VOICE` | No | Optional TTS voice override such as `alloy`, `echo`, `fable`, `onyx`, `shimmer`, or `nova` |

For Vercel, set `NEXT_PUBLIC_API_URL` to the deployed backend URL.

## API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/generate` | Synchronous episode generation, rate limited to 5/day per IP |
| `POST` | `/generate/stream` | Streaming generation with progress, sources, audio chunks, and final metadata |
| `GET` | `/trending-topics` | Trending topic labels from recent headlines |

Example generation request:

```json
{
  "length": "short",
  "briefing_mode": "full_daily",
  "category": null
}
```

For a category briefing, send `briefing_mode: "category"` and a category key such as `tech_ai`, `financial_report`, or `current_events`.

### Streaming Event Shapes

```json
{ "percent": 16, "message": "Fetching sources...", "sources": [] }
```

```json
{
  "percent": 42,
  "message": "Synthesizing audio...",
  "audio_chunk": {
    "index": 0,
    "audio_url": "data:audio/mpeg;base64,...",
    "text": "..."
  }
}
```

```json
{
  "percent": 100,
  "result": {
    "transcript": "...",
    "sources": [],
    "total_chunks": 8,
    "audio_chunks": []
  }
}
```

The live streaming path avoids duplicating one giant concatenated audio blob when chunked audio is available.

## Deployment

- **Frontend:** Vercel, auto-deployed from `main`.
- **Backend:** Render, running `uvicorn api.main:app`.
- **CORS:** `api/main.py` includes the live Vercel origin.
- **Secrets:** backend environment variables are configured in the Render dashboard.

Live frontend: [https://ai-news-podcast-generation.vercel.app](https://ai-news-podcast-generation.vercel.app)

## Engineering Tradeoffs

This is a deployed portfolio project, not a production news platform. The current constraints are intentional and documented:

- **No authentication:** all access is public for demo purposes.
- **No database:** episode caching is in memory and resets on backend restart.
- **Base64 audio data URLs:** simple for a POC, but object storage or byte streaming would scale better.
- **IP-based rate limiting:** useful for cost control, not strong abuse prevention.
- **Heuristic transcript sync:** good enough for demo playback, but real word timestamps would improve precision.
- **External API latency:** generation depends on news fetches, Claude, and OpenAI TTS, so first-time episodes can take time.

## Future Improvements

- Store generated episodes and audio chunks in durable object storage.
- Add authentication, user history, and saved briefings.
- Replace heuristic transcript timing with word-level timestamps.
- Add automated integration tests around SSE ordering and chunk continuity.
- Improve observability around first-audio latency and third-party API failures.

## Acknowledgments

- [Anthropic Claude](https://anthropic.com/) for script generation
- [OpenAI API](https://platform.openai.com/) for text-to-speech
- [NewsAPI](https://newsapi.org/) and Google News RSS for article discovery
- [FastAPI](https://fastapi.tiangolo.com/) and [Next.js](https://nextjs.org/) for the application stack

---

<div align="center">
<sub>Live portfolio project built by Ulyssies Adams</sub>
</div>
