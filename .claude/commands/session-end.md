# /session-end

Run this at the end of every work session. Writes permanent memory before closing.

## Steps

1. **Trigger context-manager agent** to write the full session summary
   - What was built or changed (specific files and features)
   - Decisions made and rationale
   - Known issues discovered
   - Exact next steps for the next session

2. **Update root agent docs**
   - Rewrite Current Priorities to reflect the current project state
   - Add any new Known Issues discovered this session
   - Remove resolved Known Issues
   - Keep `CLAUDE.md`, `AGENTS.md`, and `codex.md` aligned

3. **State the first task for next session**
   - Output one clear, specific sentence: the exact first thing to do when opening this project again
   - This becomes the recommended task when `load context` is called next session

## Output

```
## Session Saved

**Summary written to:** .claude/session-notes.md
**Agent docs updated:** CLAUDE.md + AGENTS.md + codex.md Current Priorities + Known Issues

**First task next session:**
> [Exact, specific task — e.g., "Wire up the /api/users POST endpoint to the database layer in api/routes.py"]

Say 'load context' at the start of your next session to resume.
```

## Notes

- Do not skip this command. A session without `/session-end` means the next session starts cold.
- If the session was short or exploratory, still write a brief entry — even "investigated X, decided not to proceed because Y" is valuable.
- The context-manager handles the actual writing. This command orchestrates it.
