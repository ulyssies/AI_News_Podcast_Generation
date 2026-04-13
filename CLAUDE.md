# CLAUDE.md

This file is the source of truth for Claude Code in this project. Read it fully before acting. Agents must read it before scoped work.

---

## Project Overview

Curated Daily Audio is a podcast-style daily briefing app that fetches real news, generates a broadcast-quality script via Claude, converts it to audio via OpenAI TTS, and serves it with a sticky player, transcript, and source links. It's aimed at people who want fast, neutral, factual audio news without fluff. This is a proof of concept — not production-ready.

**Status:** Proof of Concept

---

## Stack

- **Frontend:** Next.js 16 (Pages Router), TypeScript, TailwindCSS v4, lucide-react, Syne + DM Sans (Google Fonts via next/font)
- **Backend:** FastAPI, Python 3.11+, uvicorn
- **AI:** Anthropic Claude (script generation), OpenAI TTS (audio)
- **News:** NewsAPI (primary), Google News RSS (fallback)
- **Rate limiting:** slowapi (5 generations per IP per 24h)
- **Auth:** None (out of scope for POC)
- **Hosting:** Frontend → Vercel (auto-deploys from `main`), Backend → Render
- **Package managers:** npm (frontend), pip (backend)

---

## Deployment

- **Frontend:** Vercel — auto-deploys from `main`. CORS `allow_origins` in `api/main.py` must include the Vercel domain.
- **Backend:** Render — runs `uvicorn api.main:app`. Environment variables set in Render dashboard.
- **Database:** None (in-memory LRU cache, up to 50 episodes, lost on restart)
- **Environment:** Copy `api/.env.example` → `api/.env`. Never commit `.env`.

---

## Project Structure

```
PodcastApp/
├── api/
│   ├── main.py              # FastAPI app, CORS, rate limit error handler
│   ├── routes.py            # /generate, /generate/stream, /trending-topics
│   ├── models.py            # Pydantic request/response models
│   ├── requirements.txt
│   └── services/
│       ├── news.py          # Category queries, full briefing fetch, politics balancing
│       ├── script.py        # Claude API script generation
│       ├── tts.py           # OpenAI TTS
│       ├── pipeline.py      # Orchestration, streaming support
│       └── trending.py      # Trending topics via RSS
├── web/
│   ├── pages/
│   │   └── index.tsx        # Main UI (single page)
│   ├── components/
│   │   ├── AudioPlayer.tsx  # Sticky bottom audio player
│   │   └── CategoryCards.tsx
│   ├── hooks/
│   ├── lib/
│   │   └── apiClient.ts     # API client
│   └── styles/
├── SECRETS.md
└── CLAUDE.md
```

---

## Conventions

- **Naming:** camelCase for TS variables/functions, PascalCase for React components, snake_case for Python
- **Commits:** Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **Branches:** `feature/`, `fix/`, `chore/` prefixes
- **Error handling:** Never swallow errors silently. Log with context on the backend. Surface meaningful errors to the frontend.
- **Comments:** Explain *why*, not *what*. Remove debug comments before commit.
- **Tests:** None currently (POC scope)
- **TypeScript:** Strict mode. No `any` unless absolutely necessary.

---

## Design System

- Global black background (`#050508` page, `#0a0a0a` cards), overscroll disabled
- Dark-first UI — all components assume a dark background
- **Accent color:** `#6366f1` (indigo) — used for primary CTAs
- **Fonts:** Syne (`font-display`) for display headings, DM Sans (`font-sans`) for body — registered via `@theme` in `globals.css`
- TailwindCSS v4 (no `tailwind.config.js` — CSS-based config, extend via `@theme` block in `globals.css`)
- lucide-react for all icons
- Category cards use per-topic radial gradient backgrounds defined in `web/lib/categories.ts`
- Globe graphic bleeds to card edges — clipped only by section `overflow-hidden`, never by inner containers

All UI work references the shared design system before touching any styles.

**Shared reference:** `~/claude-shared/design-system.md`

---

## Do Not Touch

- `.env` files — never read, never modify, never commit
- `web/node_modules/`, `web/.next/` — generated artifacts
- `api/__pycache__/` — generated artifacts
- `SECRETS.md` — documents what secrets are needed; never add actual secret values here

---

## Current Priorities

1. Test generation speed improvements on Render (parallel TTS + single Claude call)
2. Validate word-highlight transcript UX with real audio — check drift at seek points
3. CORS and deployment config kept in sync between Vercel frontend and Render backend

---

## Known Issues

- Rate limiting is IP-based via slowapi — easily bypassed, not production-grade
- In-memory episode cache (50 episodes max) is lost on every server restart
- Audio is returned as base64 — not suitable for large scale
- Generation time reduced but still dependent on Claude token output speed (~1–2 min for medium)
- Transcript word highlight drifts on seek — no real timestamps from OpenAI TTS
- No auth, no persistence, no multi-user support

---

## Session Notes

Detailed session history lives in `.claude/session-notes.md`. The context-manager agent maintains it. Run `/session-end` at the end of every work session.
