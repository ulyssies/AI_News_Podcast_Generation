# AGENTS.md

This file is the source of truth for Codex in this project. Read it fully before acting. Agents must read it before scoped work.

---

## Project Overview

Curated Daily Audio is a podcast-style daily briefing app that fetches real news, prioritizes fresh/high-impact stories, generates a broadcast-quality script via Anthropic Claude, converts it to audio via OpenAI TTS, and serves it with progressive playback, transcript, and source links. It is aimed at people who want fast, neutral, factual audio news without fluff. This is a proof of concept - not production-ready.

**Status:** Proof of Concept

---

## Stack

- **Frontend:** Next.js 16 (Pages Router), TypeScript, TailwindCSS v4, lucide-react, Syne + DM Sans (Google Fonts via next/font)
- **Backend:** FastAPI, Python 3.11+, uvicorn
- **AI:** Anthropic Claude for script generation; OpenAI TTS for audio synthesis
- **News:** NewsAPI (primary), Google News RSS (fallback)
- **Rate limiting:** slowapi (5 generations per IP per 24h on the sync endpoint)
- **Auth:** None (out of scope for POC)
- **Hosting:** Frontend -> Vercel (auto-deploys from `main`), Backend -> Render
- **Package managers:** npm (frontend), pip (backend)

---

## Deployment

- **Frontend:** Vercel. CORS `allow_origins` in `api/main.py` must include the Vercel domain.
- **Backend:** Render, running `uvicorn api.main:app`. Environment variables live in the Render dashboard.
- **Database:** None. In-memory LRU episode cache, up to 50 episodes, lost on restart.
- **Environment:** Copy `api/.env.example` -> `api/.env`. Never commit `.env`.

---

## Project Structure

```
PodcastApp/
├── api/
│   ├── main.py              # FastAPI app, CORS, rate limit error handler
│   ├── routes.py            # /generate, /generate/stream, /trending-topics, in-flight dedupe
│   ├── models.py            # Pydantic request/response models
│   ├── requirements.txt
│   └── services/
│       ├── news.py          # Category queries, full briefing fetch, politics balancing, published_at metadata
│       ├── script.py        # Claude/OpenAI script generation, fresh-first/no-fluff prompts
│       ├── tts.py           # OpenAI TTS chunking, reusable client, data URL helpers
│       ├── pipeline.py      # Orchestration, SSE progress, audio chunk streaming, timing logs
│       └── trending.py      # Trending topics via RSS
├── web/
│   ├── pages/
│   │   └── index.tsx        # Main UI, generation flow, SSE parsing, progressive audio chunks
│   ├── components/
│   │   ├── AudioPlayer.tsx
│   │   ├── BriefingPlayerDock.tsx
│   │   ├── CategoryBriefingGrid.tsx
│   │   ├── DailyBriefingHero.tsx
│   │   ├── HeroGlobeBroadcast.tsx
│   │   ├── InfoModal.tsx
│   │   └── TranscriptHighlight.tsx
│   ├── hooks/
│   │   └── useAudioPlayer.ts
│   ├── lib/
│   │   ├── apiClient.ts
│   │   └── categories.ts
│   ├── public/
│   │   └── category-covers/ # Static generated cover art for Go deeper cards
│   └── styles/
├── .claude/                 # Claude agents, commands, skills, and session notes
├── .agents/                 # Codex-oriented skill mirrors
├── AGENTS.md                # Codex source of truth
├── codex.md                 # Codex mirror/reference doc
├── SECRETS.md
└── CLAUDE.md
```

---

## Current Behavior

- `/generate/stream` emits SSE progress, early `sources`, and `audio_chunk` events as individual TTS chunks finish. Live clients can show sources/transcript and start playback before the full episode is done.
- The final stream response includes `total_chunks` and `audio_chunks`, but does not duplicate the full concatenated audio blob in the live path. The frontend keeps live/final chunk URLs as the primary playback source when any chunks arrive; concatenated full audio is only a sync/legacy fallback for responses with no chunk list.
- Progressive playback only exposes contiguous audio chunks starting at index `0`; later chunks are held until missing earlier chunks arrive so playback cannot jump ahead.
- The full daily briefing length defaults to Short (~5m).
- TTS chunks target about 800 characters and split on sentence boundaries where possible.
- OpenAI TTS uses a module-level client and dedicated thread pool.
- Duplicate in-flight requests share the same generation task by cache key.
- Generation timing is logged with `news_fetch_ms`, `first_claude_token_ms`, `script_done_ms`, `first_tts_done_ms`, `all_tts_done_ms`, `base64_ms`, and `response_bytes`.
- Script prompts must lead with the freshest, highest-impact stories from the last 24-48 hours. Older stories are context only and should be labeled naturally as context.
- Script prompts must avoid ceremonial intros/outros like "Good morning", "Welcome", "Let's get started", "That does it", and generic recaps.

---

## Conventions

- **Naming:** camelCase for TS variables/functions, PascalCase for React components, snake_case for Python
- **Commits:** Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **Branches:** `feature/`, `fix/`, `chore/` prefixes
- **Error handling:** Never swallow errors silently. Log with context on the backend. Surface meaningful errors to the frontend.
- **Comments:** Explain why, not what. Remove debug comments before commit.
- **Tests:** None currently (POC scope)
- **TypeScript:** Strict mode. No `any` unless absolutely necessary.

---

## Design System

- Global black background (`#050508` page, near-black cards), overscroll disabled.
- Dark-first UI - all components assume a dark background.
- **Accent color:** `#6366f1` (indigo), with cyan used sparingly for progress gradients.
- **Fonts:** Syne (`font-display`) for display headings, DM Sans (`font-sans`) for body - registered via `@theme` in `globals.css`.
- TailwindCSS v4. No `tailwind.config.js`; extend via the `@theme` block in `globals.css`.
- lucide-react for all UI icons.
- Go deeper cards use static generated cover art from `web/public/category-covers/` with metadata in `web/lib/categories.ts`.
- Globe graphic is a shaded wireframe sphere with no pins/points. During loading, it remains visual-only and spins faster as progress increases; concrete progress lives in the bottom dock.
- The sticky bottom dock owns loading progress and progressive playback. The hero card waveform is audio-reactive when playback is active.

All UI work references the shared design system before touching styles.

**Shared reference:** `~/Codex-shared/design-system.md`

---

## Do Not Touch

- `.env` files - never read, never modify, never commit
- `web/node_modules/`, `web/.next/` - generated artifacts
- `api/__pycache__/` - generated artifacts
- `SECRETS.md` - documents what secrets are needed; never add actual secret values here
- `.claude/settings.local.json` - local machine permissions/preferences

---

## Current Priorities

1. Validate chunked SSE playback on Render/Vercel, especially first-audio time and final metadata behavior.
2. Monitor generation timing logs to identify the next real bottleneck before making more performance changes.
3. Test fresh-first/no-fluff script quality across full daily and all category lengths with real current news.
4. Test transcript highlight timing with progressive chunk playback across short, medium, and long episodes.
5. Keep CORS and deployment config synced between Vercel frontend and Render backend.

---

## Known Issues

- Rate limiting is IP-based via slowapi - easily bypassed, not production-grade.
- In-memory episode cache is lost on every server restart.
- Cached/sync responses still carry a full base64 data URL; the live SSE path mitigates this by streaming chunks.
- Transcript highlight timing is heuristic and may drift on very long episodes or across progressive chunk boundaries.
- The sync fallback path when `ANTHROPIC_API_KEY` is missing is less tested than the Claude streaming path.
- Generated category cover art is static. If labels or themes change, regenerate/update the matching files in `web/public/category-covers/`.
- No auth, no persistence, no multi-user support.

---

## Agent Files

- `AGENTS.md` is the Codex source of truth.
- `codex.md` mirrors Codex-facing project guidance for tools or users that look for that filename.
- `CLAUDE.md` is the Claude Code source of truth.
- `.agents/skills/frontend-design/SKILL.md` mirrors the frontend design skill for Codex-oriented workflows.
- `.claude/agents`, `.claude/commands`, and `.claude/skills` define Claude helper workflows.

When project behavior changes, update `AGENTS.md`, `codex.md`, and `CLAUDE.md` together so future agents do not follow stale instructions.

---

## Session Notes

Detailed session history currently lives in `.claude/session-notes.md`. The context-manager agent maintains it. Run `/session-end` at the end of every work session.
