# /pre-commit

Run this before every commit. Catches problems before they reach the repo.

## Steps

1. **Invoke code-reviewer agent** on all staged files
   - Check for unused imports, dead code, convention violations
   - Check for missing error handling
   - Check for performance issues
   - Report critical issues first

2. **Secret scan**
   - Confirm no API keys, tokens, passwords, or connection strings are hardcoded in staged files
   - If any found: block commit, report exact location, do not proceed

3. **Documentation check**
   - For any new public functions, classes, or modules added in this diff: confirm docstrings/JSDoc exist
   - Flag missing docs as Major issues

4. **Debug artifact removal**
   - Scan for `console.log`, `print(`, `debugger`, `breakpoint()`, `TODO`, `FIXME`, `HACK` in staged files
   - List each one with file and line number
   - Do not remove automatically — report and let developer confirm

5. **Scope check**
   - Read Current Priorities in the root agent docs (`CLAUDE.md`, `AGENTS.md`, `codex.md`)
   - Confirm the staged changes align with current priorities
   - Flag any out-of-scope changes for developer review (not automatic block)

## Output

```
## Pre-Commit Review

**Secrets:** ✓ Clean / ✗ BLOCKED — [location]
**Code quality:** [Critical / Major / Minor issues or ✓ Clean]
**Documentation:** ✓ Complete / ✗ Missing on [functions]
**Debug artifacts:** ✓ None / ✗ Found at [locations]
**Scope:** ✓ Matches root-doc priorities / ⚠ Out-of-scope changes detected

[Summary: safe to commit / blocked on X]
```

## Blocking Conditions

The following block a commit entirely:
- Any hardcoded secret
- Critical code quality issue (broken logic, unhandled error on user-facing path)

Minor and Major issues are reported but do not block — developer decides.
