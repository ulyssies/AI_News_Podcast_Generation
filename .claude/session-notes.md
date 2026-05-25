# Session Notes

Maintained by the context-manager agent. Do not edit manually — use `/session-end` to write entries.

---

## 2026-04-13 — Project setup: CLAUDE.md + template scaffolding

### Built / Changed
- Created `CLAUDE.md` at project root, tailored to PodcastApp stack (FastAPI + Next.js 16, OpenAI TTS, Claude script gen, Vercel + Render)
- Imported full `.claude/` template: agents (code-reviewer, context-manager, debugger, docs-writer), commands (/pre-commit, /session-end), skills (frontend-design), settings.json, session-notes.md

### Decisions Made
- CLAUDE.md status set to "Proof of Concept" — matches README and existing scope
- No tests section needed (POC scope, none in place)
- Design system section notes black-background / dark-first UI as the project baseline

### Known Issues
- Rate limiting is IP-based via slowapi — easily bypassed
- In-memory episode cache lost on every Render restart
- Audio returned as base64 — not suitable at scale
- Long episodes (15–30 min) take 30–60s to generate

### Next Steps
- Continue feature development or explore adding persistence (episode caching to disk or object storage)

---

## 2026-04-13 — Performance overhaul + full frontend redesign

### Built / Changed

**Backend — pipeline speed**
- `api/services/script.py`: Merged two sequential Claude API calls (summarize → draft) into a single `_generate_script_sync` call. Added dedicated `_SCRIPT_EXECUTOR` ThreadPoolExecutor (4 workers).
- `api/services/tts.py`: Added `_TTS_EXECUTOR` ThreadPoolExecutor (12 workers) so TTS requests use a dedicated pool and don't compete with other thread work.
- `api/services/pipeline.py`: Replaced batch-of-2 TTS loop with a single `asyncio.gather(*all_chunks)` — all chunks synthesize simultaneously. Both `generate_episode_stream` and `generate_episode` updated. Removed unused `synthesize_audio` import.

**Frontend — full redesign**
- `web/lib/categories.ts`: Added `cardBg` (radial gradient per topic), `iconColor`, `borderColor` fields.
- `web/components/CategoryBriefingGrid.tsx`: Spotify-style cards — 2-col mobile / 4-col desktop, `aspect-[3/2]`, themed radial gradient backgrounds, large icon with drop-shadow glow, hover scale, loading overlay.
- `web/components/AudioPlayer.tsx`: Added `onTimeUpdate` prop firing `(currentTime, duration)` on every timeupdate.
- `web/components/BriefingPlayerDock.tsx`: Threads `onTimeUpdate` through to AudioPlayer.
- `web/components/TranscriptHighlight.tsx` (new): Word-by-word transcript highlight proportional to playback. Auto-scrolls active word into view.
- `web/components/DailyBriefingHero.tsx`: Editorial redesign — Syne headline at display scale, eyebrow rule, generous padding, globe bleeds to card edges (removed inner overflow-hidden), indigo `#6366f1` CTA.
- `web/pages/index.tsx`: `audioTime` state wired via `handleTimeUpdate`. "How it works" expandable panel. Category depth changed to `medium`. TranscriptHighlight replaces static box. Generous spacing.
- `web/pages/_app.tsx`: Syne + DM Sans via `next/font/google`.
- `web/styles/globals.css`: `@theme` block registering `--font-display` and `--font-sans`. Body uses DM Sans globally.

### Decisions Made
- Single Claude call skips intermediate bullet summary — faster, equivalent quality
- All TTS chunks fire in parallel via `asyncio.gather` — bounded by 12-worker executor
- Word highlight uses proportional time estimate — no real timestamps from OpenAI TTS
- Category episodes changed to `medium` (~10 min) — `short` was too brief
- Indigo `#6366f1` as primary accent — amber read as a warning state
- Globe bleeds to card edges via section `overflow-hidden` only

### Known Issues
- Word highlight drifts at seek points (no real TTS timestamps from OpenAI)
- Syne requires Google Fonts network request on first load (`display: swap` mitigates FOIT)

### Next Steps
- Test generation speed on Render to confirm parallel TTS improvements hold in prod
- Consider resetting word highlight position immediately on audio scrub

---

## 2026-04-13 — Streaming pipeline, model selection, progress UX, transcript drift fix

### Built / Changed

**Backend — generation speed**
- `api/services/script.py`: Added `_select_model(length)` — uses `claude-haiku-4-5-20251001` for short/medium (3–5x faster, 4x cheaper), `claude-sonnet-4-6` for long. Env var `ANTHROPIC_MODEL` always overrides. Extracted `_build_prompt()` for reuse. Added `stream_podcast_script()` async generator using `AsyncAnthropic.messages.stream()` — streams tokens from Claude as they arrive. Falls back gracefully to sync path if streaming unavailable.
- `api/services/pipeline.py`: Full rewrite of `generate_episode_stream`. Now streams from Claude via `stream_podcast_script` and fires `asyncio.create_task(synthesize_one_chunk(...))` for each 1200-char chunk as it accumulates — TTS overlaps with generation instead of running after. Added `_find_chunk_boundary()` (prefers sentence boundary, falls back to word boundary). Added `_build_sources()` helper. Total generation time reduced from `Claude time + TTS time` → roughly `max(Claude time, TTS time)`.

**Frontend — progress bar + transcript**
- `web/pages/index.tsx`: Added `displayProgress` state with smooth animation — eases toward real SSE milestones at 18% per tick, idle creep of 0.14%/200ms between milestones (capped at 93%). Resets to 0 when `progress === 0` on new generation. Passes `Math.round(displayProgress)` to dock instead of raw `progress`.
- `web/components/BriefingPlayerDock.tsx`: Added 2px indigo progress bar along top edge of dock, visible during loading. Fixed `relative` + `fixed` conflict that caused dock to disappear from viewport.
- `web/components/TranscriptHighlight.tsx`: Replaced uniform word-count interpolation with character-weighted cumulative positions (`useMemo`). Words weighted by character length + punctuation pause weight (`.!?` → +4, `,;:` → +1). Reduces accumulated drift over playback duration.

**Repo hygiene**
- `README.md`: Removed all emojis from headings and tables.
- `~/.claude/settings.json`: Set `attribution.commit: ""` and `attribution.pr: ""` to disable Claude co-author trailers globally across all projects.

### Decisions Made
- Haiku for short/medium: speed and cost win outweigh quality difference for category briefings; Sonnet retained for long where depth matters
- Streaming pipeline chosen over pre-warming or caching as the highest-impact latency reduction
- Character-weighted transcript positions chosen over uniform word-count — accounts for real speech timing variation without needing true TTS timestamps
- Co-author attribution disabled globally — user preference

### Known Issues
- Transcript highlight still drifts somewhat on seek — character weighting helps but inter-chunk TTS silence still accumulates without real timestamps
- Haiku quality for full_daily medium may be slightly lower than previous Sonnet — not yet validated on Render
- Streaming fallback (sync path) fires if `ANTHROPIC_API_KEY` missing — OpenAI script fallback path untested with streaming pipeline

### Next Steps
- Validate streaming pipeline + Haiku quality on live Render deployment
- Test transcript highlight drift improvement with real audio across short/medium lengths
- Consider passing `numChunks` to TranscriptHighlight to subtract estimated inter-chunk silence from duration for better seek accuracy

---

## 2026-04-13 — UI polish: color pass, transcript/sources redesign, info modal

### Built / Changed

**Global color pass**
- `web/styles/globals.css`: `background-color: #000000` → `#0a0a0a`
- `web/pages/index.tsx`: main bg `bg-[#050508]` → `bg-[#0a0a0a]`
- All blue-tinted dark surfaces (`bg-[#08080c]`, `bg-slate-900`, `border-slate-800`) replaced with neutral tokens: `bg-[#111111]` cards, `border-[#222222]` dividers, `bg-[#1a1a1a]` subtle
- `BriefingPlayerDock`: `bg-[#070709]/95` → `bg-[#0a0a0a]/95`, borders and inner player wrapper updated

**Transcript section**
- Font reduced: `text-base sm:text-lg leading-loose` → `text-[11px] sm:text-xs leading-relaxed`
- Max-height tightened: `h-64 sm:h-80 lg:h-96` → `h-48 sm:h-56`
- Card surface: `bg-[#08080c]` → `bg-[#111111]` with `border-[#222222]`

**Sources section**
- Replaced unstyled `<ul>` with a contained scrollable card (`max-h-56 overflow-y-auto`, hidden scrollbar)
- Row layout: article title (left, truncated, `#f5f5f5`) + publisher badge (right, uppercase, `bg-[#1a1a1a]`)
- `border-[#1a1a1a]` dividers between rows
- Full `group` hover: row `hover:bg-[#161616]`, title `group-hover:text-white`, badge brightens

**AudioPlayer**
- Play/pause button: `bg-white text-zinc-900` → `bg-[#6366f1] text-white hover:bg-[#5152d4]` (accent system)
- Button size: compact `w-8 h-8` → `w-9 h-9`, standard `w-10 h-10` → `w-11 h-11`
- Progress bar: compact `h-1` → `h-1.5`, standard `h-1.5` → `h-2`, track `bg-slate-800` → `bg-[#222222]`
- Progress fill: `bg-white` → `bg-[#6366f1] group-hover:bg-[#7c7ff5]`

**InfoModal** (`web/components/InfoModal.tsx` — new)
- First-visit modal gated by `localStorage.getItem("cda_seen_intro")`
- `open/onClose` props; `handleModalClose` sets localStorage key then closes
- Fade + `translate-y-2` enter/exit animation via `requestAnimationFrame` + `setTimeout(200ms)` unmount delay
- Overlay click-to-dismiss, X button top-right
- Three content sections: "What it is" paragraph, "How it works" bullet list (indigo dots), GitHub outlined button with Lucide `Github` icon
- "How it works" nav button always opens modal (ignores localStorage); inline about panel removed from header

**Commit:** `afe7aa9` pushed to `main` — Vercel auto-deploy triggered

### Decisions Made
- True near-black palette (`#0a0a0a` / `#111111` / `#1a1a1a`) matches design system tokens exactly — removes cool blue cast from prior `#050508` / `#08080c` values
- Sources redesigned as a card — better hierarchy, scrollable when long
- Play button switched to indigo accent — consistent with the accent system used on CTA and progress bar
- InfoModal replaces inline collapsible about panel — simpler header layout, better UX (overlay, first-visit auto-show)
- `cda_seen_intro` as localStorage key — namespaced to avoid collisions

### Known Issues
- No new issues introduced this session

### Next Steps
- Confirm Vercel deploy looks correct after color changes
- Validate streaming pipeline + Haiku quality on live Render deployment
- Test transcript highlight drift with real audio after font/height reduction

---

## 2026-04-13 — README refresh, SSE stall fix, transcript lag fix, mobile polish

### Built / Changed

**Docs**
- `README.md`: Full rewrite — corrected component names (`CategoryBriefingGrid`, `BriefingPlayerDock`, etc.), added streaming, split layout, mobile layout, animated globe, info modal to features table, updated project structure, replaced localhost-only CORS note with accurate Vercel/Render deployment section. Commit `ec37423`.

**Bug fixes**
- `api/routes.py`: Added a `1%` flush SSE event at the top of `event_stream()` before any blocking work. Without this, nginx/Render proxy buffered the first real `10%` event for 20–30 s until enough bytes accumulated. Commit `be6a28e`.
- `web/pages/index.tsx`: Removed the `if (progress === 0) { return }` early return from the `displayProgress` animation effect. Progress bar now creeps from 0 immediately when loading starts (~0.7%/s), giving visual feedback before the first SSE event arrives. Commit `be6a28e`.
- `web/components/TranscriptHighlight.tsx`: Added `activeWordIndex + 2` after the binary search. TTS speech rate outpaces the character-weight model by ~1–2 words; this nudge keeps the highlight visually in sync. Commit `be6a28e`.

**Mobile polish — round 1** (commit `297476b`)
- `web/styles/globals.css`: Wrapped `#mobile-categories` in a card container (`#111111` bg, `1px solid #222222` border, `16px` border-radius, `10px` padding) matching the hero card.
- `web/components/HeroGlobeBroadcast.tsx`: Added `"mobile"` variant — same centering as `"centered"` but at `h-[200px] w-[200px]` (later bumped to 320px).
- `web/pages/index.tsx`: Added `#mobile-globe-container` div between the left and right columns — `lg:hidden`, conditionally rendered when `!result && !loading && !error`.
- `web/styles/globals.css`: Length pills — changed `flex-wrap: wrap` → `nowrap`, added `flex: 1 1 0; min-width: 0` on buttons, hid the time hints (`~5m` etc.) via `span + span { display: none }` so all three pills fit on one row.

**Mobile polish — round 2** (commit `8270bfc`)
- `web/components/HeroGlobeBroadcast.tsx`: Mobile variant bumped from `200×200px` → `320×320px`.
- `web/pages/index.tsx`: Restructured mobile globe container to a flex column: `#mobile-globe-sphere` (positioned ancestor for the globe) + `#mobile-globe-label` ("Select a briefing to begin"). Conditional guard unchanged.
- `web/styles/globals.css`:
  - `#layout-left-inner`: Added `align-items: stretch` for equal card heights in the top row.
  - `#mobile-hero`: Added `display: flex; flex-direction: column`.
  - `#mobile-hero > section`: Added `flex: 1` so the hero card background fills the full cell.
  - `#mobile-globe-container/sphere/label`: Flex column layout, 320px sphere, label mirrors desktop idle styling (`10px, uppercase, tracking: 0.22em, #2e2e2e`).

### Decisions Made
- SSE flush event uses `1%` not `0%` — avoids the old `progress === 0` early-return path in the frontend animation.
- Transcript `+2` word offset is a heuristic fix — more predictable than a time-based lead, directly matches the "1–2 words behind" symptom.
- Mobile globe only shown when idle — mirrors desktop behavior.
- All mobile CSS stays inside the single `@media (max-width: 1024px)` block; desktop untouched.

### Known Issues
- `audioPlaying` prop in `HeroGlobeBroadcast` is never read inside the component — dead prop, cleanup candidate.
- Transcript `+2` offset is a heuristic; may still drift on very long episodes.
- SSE flush sends `percent: 1` — briefly shows 1% before real pipeline events; negligible visually but technically inaccurate.

### Next Steps
- Push to Vercel/Render and validate the SSE flush fix resolves the 20–30 s stall on production.
- Test transcript highlight `+2` offset on real audio across short, medium, and long episodes.
- Clean up the dead `audioPlaying` prop in `HeroGlobeBroadcast.tsx`.

---

## 2026-05-24 — Streaming audio, script freshness, loading polish, agent docs sync

### Built / Changed
- `api/routes.py`: Added in-flight generation dedupe for sync and streaming requests. Live streaming clients receive `audio_chunk` events and no longer get a duplicate full base64 MP3 in the final metadata payload when chunks were already sent.
- `api/services/pipeline.py`: Added chunk-level audio streaming, ordered final assembly, and timing logs for news fetch, first Claude token, script completion, first/all TTS completion, base64 encoding, and response size.
- `api/services/tts.py`: Reduced TTS chunk target to about 800 characters, split chunks on sentence boundaries when possible, reused a module-level OpenAI client, and kept a dedicated TTS thread pool.
- `api/services/news.py`: Added `published_at` metadata from NewsAPI and Google News RSS so script prompts can distinguish fresh stories from context.
- `api/services/script.py`: Updated prompts to lead with the freshest/highest-impact reporting from the last 24-48 hours, label older material as context, and remove ceremonial intro/outro filler.
- `web/components/AudioPlayer.tsx`, `web/hooks/useAudioPlayer.ts`, `web/components/BriefingPlayerDock.tsx`, and `web/pages/index.tsx`: Added progressive chunk playback, audio-reactive hero waveform levels, loading progress that caps at 99 until completion, and a bottom dock loading bar.
- `web/components/HeroGlobeBroadcast.tsx`, `web/components/DailyBriefingHero.tsx`, and `web/styles/globals.css`: Reworked the globe into a cleaner shaded wireframe with no pins/points, removed redundant loading text under it, and made active spin speed increase with progress.
- `web/components/CategoryBriefingGrid.tsx`, `web/lib/categories.ts`, and `web/public/category-covers/`: Swapped fragile CSS/icon art for static generated cover assets with consistent Spotify-inspired formatting.
- `CLAUDE.md`, `AGENTS.md`, and `codex.md`: Synced root guidance to the current streaming pipeline, UI components, prompt behavior, priorities, and known issues.

### Decisions Made
- Optimize perceived latency by streaming playable TTS chunks instead of waiting for one final base64 payload.
- Keep episode durations meaningful; reduce prompt waste and TTS chunk size rather than shortening content into unusable snippets.
- Use freshness metadata and prompt constraints to prevent stale or context-only stories from becoming the lead.
- Keep concrete generation progress in the bottom dock while the globe stays a visual loading centerpiece.
- Treat `.claude/settings.local.json` as machine-local and do not commit it.

### Known Issues
- Cached/sync responses still rely on full base64 data URLs; live SSE streaming is the optimized path.
- Transcript timing is still heuristic and may drift across progressive chunk boundaries.
- The no-Anthropic sync fallback remains less tested than the Claude streaming path.
- Static category covers need regeneration if labels, topics, or visual direction changes.

### Next Steps
- Run real generation tests on Render/Vercel and compare timing logs before choosing the next performance target.
- Validate fresh-first/no-fluff scripts across all categories and lengths with current news.
- Test transcript highlight behavior during progressive playback and seeking.

---
