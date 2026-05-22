# AGENTS.md

## Working Rules

This project uses multiple agents with clear ownership boundaries.

Before making changes, read:

- `AGENT.md`
- `docs/development-log.md`
- The subsystem doc relevant to the task

## Documentation Rule

Every completed feature, fix, packaging change, or behavior change must be recorded in project docs before the task is considered done.

Use the smallest useful documentation update:

- Update `docs/development-log.md` for completed work and fixes.
- Update subsystem docs only when behavior, commands, schemas, or development workflow changed.
- Do not write long narrative reports. Keep entries factual and concise.

Recommended log entry format:

```text
## YYYY-MM-DD

- Area: short summary.
- Verification: command or manual check result.
- Notes: limitations or follow-up, if any.
```

## Ownership

- Rule changes belong in the domain layer and rule tests.
- Hero data changes belong in the sync pipeline and hero data docs.
- UI changes belong in renderer components and styles.
- Desktop persistence changes belong in Electron/preload/shared persistence code.
- Packaging changes belong in package scripts, builder config, CI, and packaging docs.
- QA findings should list issues first, with reproduction steps.

## Handoff

Each agent should finish with:

- Changed files summary.
- Verification run.
- Known limitations.
- Documentation updates made.

If no documentation update is needed, state why.
