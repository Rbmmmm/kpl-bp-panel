# CLAUDE.md

## Project

KPL BP Panel is a cross-platform desktop app for simulating KPL BO7 Ban/Pick.

Target deliverables: macOS `.app`, Windows `.exe`.

Tech stack: Electron + React + TypeScript + Vite + npm + electron-builder.

## Working Rules

Before making changes, read:
- `AGENT.md`
- `docs/development-log.md`
- The subsystem doc relevant to the task

## Documentation Rule

Every completed feature, fix, packaging change, or behavior change must be recorded in `docs/development-log.md` before the task is considered done.

Use the smallest useful documentation update:
- Update `docs/development-log.md` for completed work and fixes.
- Update subsystem docs only when behavior, commands, schemas, or development workflow changed.
- Do not write long narrative reports. Keep entries factual and concise.

Recommended log entry format:
```
## YYYY-MM-DD
- Area: short summary.
- Verification: command or manual check result.
- Notes: limitations or follow-up, if any.
```

## Code Conventions

- UI text: Chinese.
- Code identifiers, file names, types, functions: English.
- Keep domain rules separate from React components.
- Keep Electron main-process filesystem work separate from renderer UI state.
- Do not rewrite existing documents unnecessarily.
- Do not introduce broad refactors before the app skeleton exists.
- Add focused tests for rule-engine behavior before relying on UI manual testing.
- Validate actions through rule-engine functions instead of ad hoc UI checks.
- Make invalid actions impossible or clearly rejected with a Chinese error message.

## Handoff

When finishing a task:
- Changed files summary.
- Verification run (tests, typecheck, build).
- Known limitations.
- Documentation updates made.
- If no documentation update is needed, state why.
