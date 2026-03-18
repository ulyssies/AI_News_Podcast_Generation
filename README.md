[<div align="center">

# 🎙️ Curated Daily Audio

**Stay informed — without the noise.**

[![Status](https://img.shields.io/badge/Status-Proof%20of%20Concept-f59e0b?style=for-the-badge)](.)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![Claude](https://img.shields.io/badge/Anthropic-Claude-c96442?style=for-the-badge)](https://anthropic.com)
[![OpenAI](https://img.shields.io/badge/OpenAI-TTS-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)

> **POC notice:** This is not production-ready. Auth and persistence are out of scope.

</div>

---

## What it does

A curated daily audio briefing app for people who want to stay informed without sitting through fluff or biased takes. Pick a category, hit play, and get a clean factual podcast-style episode — like the front page of a newspaper, read to you.

```
Category select → News fetch → Claude script generation → OpenAI TTS → Audio player + transcript
```

---

## Features

| Feature | Description |
|---|---|
| 📰 **Today's Full Briefing** | One cohesive episode covering all 8 categories in order — the main experience |
| 🗂️ **Category Deep Dives** | 8 curated categories, each with tailored news queries for relevant results |
| ⏱️ **Episode length** | Short (~5 min), medium (~15 min), or long (~30 min) |
| 🎵 **Sticky audio player** | Persistent bottom bar player — play/pause, seek, progress bar |
| 📄 **Transcript & sources** | Full scrollable transcript and links to every source article |
| 💾 **Caching** | Same category + length returns a cached episode to save API costs (up to 50 episodes in memory) |
| ⚖️ **Balanced politics** | Politics category pulls from both left and right-leaning sources equally |
| 🚦 **Rate limiting** | 5 generations per IP per 24 hours to prevent API abuse |

---

## Categories

| Category | Focus |
|---|---|
| 🔴 **Current Events** | Today's top stories from around the world |
| 💹 **Financial Report** | Markets, earnings, and economic trends |
| 🔬 **Latest in Science** | Discoveries, research, and breakthroughs |
| 🏆 **Sports** | Scores, highlights, and headlines |
| 🎬 **Entertainment** | Movies, music, culture, and celebrity news |
| 💻 **Tech & AI** | The latest in technology and artificial intelligence |
| 🩺 **Health & Wellness** | Medical news, wellness tips, and research |
| ⚖️ **Politics** | Balanced coverage, all sides, no spin |

---

## How it works

1. **News fetch** — each category maps to tailored search queries via NewsAPI (or Google News RSS fallback). The Full Briefing pulls from all 8 categories and merges/deduplicates articles.
2. **Script generation** — Anthropic's Claude generates a broadcast-style script from the fetched articles, instructed to write in a neutral, factual journalist tone with no opinion or political framing.
3. **TTS** — OpenAI TTS converts the script to audio.
4. **Playback** — the frontend serves a sticky audio player with transcript and source links.

---

## Project Structure

```
.
├── api/
│   ├── main.py                    # FastAPI app, rate limit error handler, CORS
│   ├── routes.py                  # /generate, /generate/stream, /trending-topics
│   ├── .env.example
│   └── services/
│       ├── news.py                # Category queries, full briefing fetch, politics balancing
│       ├── script.py              # Claude API script generation
│       ├── tts.py                 # OpenAI TTS
│       ├── pipeline.py            # Orchestration, streaming support
│       └── trending.py            # Trending topics via RSS
├── web/
│   ├── pages/
│   │   └── index.tsx              # Main UI
│   ├── components/
│   │   ├── AudioPlayer.tsx        # Sticky bottom audio player
│   │   └── CategoryCards.tsx      # 8 category cards grid
│   └── lib/
│       └── apiClient.ts
└── SECRETS.md
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- An [OpenAI API key](https://platform.openai.com/api-keys) (for TTS)
- An [Anthropic API key](https://console.anthropic.com/) (for script generation)

### 1. Backend

```bash
cp api/.env.example api/.env
# Add your keys to api/.env (see Environment Variables below)

pip install -r api/requirements.txt
python3 -m uvicorn api.main:app --reload
```

API runs at **http://localhost:8000** · Docs at **http://localhost:8000/docs**

### 2. Frontend

```bash
cd web
npm install
npm run dev
```

Web runs at **http://localhost:3000** and calls the API at `http://localhost:8000` in development.

### 3. Environment Variables

Add these to `api/.env`. **Never commit this file** — see `SECRETS.md` and `.gitignore`.

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | **Yes** | Used for TTS audio generation |
| `ANTHROPIC_API_KEY` | **Yes** | Used for script generation via Claude |
| `NEWS_API_KEY` | No | Richer news sources (falls back to Google News RSS) |
| `OPENAI_TTS_VOICE` | No | `alloy`, `echo`, `fable`, `onyx`, `shimmer`, or `nova` |

---

## API Reference

| Method | Endpoint | Rate Limited | Description |
|---|---|---|---|
| `POST` | `/generate` | ✅ 5/day per IP | Generate an episode, returns full result when complete |
| `POST` | `/generate/stream` | ❌ | Generate an episode with real-time progress via SSE |
| `GET` | `/trending-topics` | ❌ | Returns trending topic labels from recent headlines |

### Request body for `/generate` and `/generate/stream`

```json
{
  "length": "short",
  "briefing_mode": "full_daily",
  "category": null
}
```

| Field | Values | Description |
|---|---|---|
| `length` | `short` · `medium` · `long` | Episode length (~5 / ~15 / ~30 min) |
| `briefing_mode` | `full_daily` · `category` | Full briefing or single category |
| `category` | e.g. `current_events`, `financial_report` | Required when `briefing_mode` is `category` |

Full interactive docs available at `http://localhost:8000/docs` when the API is running.

---

## POC Limitations

This is scoped for local exploration. Before any production use, you'd want to address:

- **Rate limiting is IP-based** — easily bypassed, not a production-grade solution
- **In-memory cache** — up to 50 episodes cached, lost on server restart
- **Base64 audio** — works for POC; replace with streaming or object storage at scale
- **Generation time** — 15–30 min episodes can take 30–60 seconds to generate
- **Single-user, local focus** — not tuned for concurrent or production load
- **CORS is localhost only** — update `allow_origins` in `main.py` before deploying

---

## Acknowledgments

- [Anthropic Claude](https://anthropic.com/) — script generation
- [OpenAI API](https://platform.openai.com/) — TTS audio generation
- [FastAPI](https://fastapi.tiangolo.com/) — backend framework
- [Next.js](https://nextjs.org/) — frontend framework
- [slowapi](https://github.com/laurentS/slowapi) — rate limiting
- [NewsAPI](https://newsapi.org/) — optional news enrichment

---

<div align="center">
<sub>Proof of Concept · Not production-ready · Extend freely</sub>
</div>]
