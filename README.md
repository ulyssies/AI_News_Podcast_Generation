# AI News Podcast Generator

**This is a proof-of-concept (POC).** It is not production-ready. Use it to explore the idea and extend it; expect rough edges and missing features (auth, rate limits, persistence, etc.).

---

## What it does

Turn a **topic** into a **podcast-style audio briefing**: the app fetches recent news, generates a script with OpenAI, converts it to speech with OpenAI TTS, and serves an episode with transcript and sources.

### Features (POC scope)

- **Topic input** – Type any topic or pick from **trending topics** (derived from recent headline volume).
- **Episode length** – Short (~5 min), medium (~15 min), or long (~30 min) when read aloud.
- **Audio playback** – Play/pause, progress bar, seek, waveform-style indicator; only one episode plays at a time.
- **Transcript & sources** – Scrollable transcript and links to source articles.
- **Caching** – Same topic + length returns the cached episode to save OpenAI usage.
- **Trending discovery** – `GET /trending-topics` surfaces 5–10 short, mixed topic labels from recent news.

---

## Project structure

| Part | Description |
|------|-------------|
| **api/** | FastAPI backend: news fetch, script generation (OpenAI), TTS with chunking (OpenAI), episode cache |
| **api/routes.py** | `POST /generate`, `GET /trending-topics` |
| **api/services/** | `news`, `script`, `tts`, `pipeline`, `trending` |
| **web/** | Next.js frontend (React, TypeScript, Tailwind) |
| **web/pages/index.tsx** | Main UI: topic discovery, length, generate, player, transcript, sources |
| **web/components/** | `AudioPlayer`, `TopicInputWithDiscovery`, `TrendingTopicChips` |
| **SECRETS.md** | How to keep API keys out of git (use `api/.env`, never commit it) |

---

## Setup

### 1. Backend (API)

From the **project root**:

```bash
cp api/.env.example api/.env
# Edit api/.env and set OPENAI_API_KEY=sk-...
pip install -r api/requirements.txt
python3 -m uvicorn api.main:app --reload
```

API runs at **http://localhost:8000**.

### 2. Frontend (Web)

```bash
cd web
npm install
npm run dev
```

Web runs at **http://localhost:3000**. In development the frontend calls the API at `http://localhost:8000` directly (see `web/lib/apiClient.ts`).

### 3. Environment variables (api/.env)

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | **Yes** | Script generation (summarize + draft) and TTS (audio) |
| `NEWS_API_KEY` | No | Richer news (default: Google News RSS) |
| `OPENAI_TTS_VOICE` | No | One of: alloy, echo, fable, onyx, shimmer, nova |

Do **not** commit `api/.env`. See **SECRETS.md** and `.gitignore`.

---

## Flow

1. User enters a topic (typed or from trending chips) and chooses short/medium/long.
2. Backend fetches recent articles (Google News RSS, or NewsAPI if `NEWS_API_KEY` is set).
3. OpenAI summarizes articles and writes the podcast script (with length targets).
4. OpenAI TTS turns the script into audio (chunked for long scripts); response includes a data URL.
5. Frontend shows the custom audio player, transcript, and source links. Same topic + length on a later request returns the cached episode.

---

## POC limitations

- No authentication or rate limiting.
- Episode cache is in-memory (lost on restart).
- Trending topics are derived from RSS headlines, not a dedicated trending API.
- Audio is returned as a base64 data URL (fine for POC; for scale you’d use streaming or file storage).
- Single-user, local/dev focus; not tuned for production deployment.

---

## Quick reference

- **API docs:** http://localhost:8000/docs when the API is running.
- **Secrets:** Copy `api/.env.example` to `api/.env`, add keys, never commit `.env` (see SECRETS.md).
