# Multi-Agent Development Plan

## 1. Collaboration Model

This project is suitable for multi-agent development because the app has clear subsystem boundaries:

- KPL BO7 rule engine.
- Hero data synchronization.
- Electron desktop shell and persistence.
- React BP panel UI.
- Packaging and release workflow.
- QA and regression testing.

Each agent should work from the shared project docs:

- `AGENT.md`
- `AGENTS.md`
- `KPL_BO7_BP_规则整理.md`
- `docs/development-log.md`
- `docs/development-roadmap.md`
- `docs/architecture.md`
- `docs/hero-data-pipeline.md`
- `docs/testing-and-packaging.md`

Agents should keep changes small and avoid modifying another agent's area unless the task explicitly requires it.

Current status: all initial agents have completed their MVP implementation pass. Continue using this document for ownership boundaries, prompts, and future follow-up tasks.

## 2. Recommended Agent Split

### Agent 1: Project Bootstrap Agent

Responsibility:

- Initialize the Electron + React + TypeScript + Vite project.
- Set up npm scripts.
- Set up basic folder structure.
- Add app shell, preload bridge, and renderer entry.
- Ensure the app can launch in development mode.

Primary ownership:

- Electron main process.
- Vite/React app setup.
- npm scripts.
- Initial project structure.

Avoid:

- Implementing full BP rules.
- Designing final UI details.
- Building the hero sync pipeline beyond placeholder data loading.

Prompt:

```text
You are the Project Bootstrap Agent for the KPL BP Panel project.

Read AGENT.md, docs/development-roadmap.md, and docs/architecture.md first.

Your task is to initialize the Electron + React + TypeScript + Vite application skeleton. Use npm, Electron, React, TypeScript, Vite, and electron-builder. The app should launch a desktop window and render a basic Chinese placeholder screen for the KPL BO7 BP simulator.

Implement only the foundation:
- package.json scripts
- Electron main process
- typed preload bridge
- React renderer entry
- basic app layout placeholder
- initial folder structure for domain, data, renderer, and Electron code

Do not implement the full BP rule engine yet. Do not implement hero sync yet. Do not add AI features. Keep the app ready for the Rule Engine Agent and UI Agent to build on.

After implementation, run the relevant install/build/dev checks that are feasible in the local environment and report exact results.
```

### Agent 2: Rule Engine Agent

Responsibility:

- Implement KPL BO7 match state.
- Implement global BP legality rules.
- Implement BP step sequence.
- Implement side-selection flow.
- Implement Peak Duel transition and validation.
- Add focused unit tests.

Primary ownership:

- Domain types.
- Pure rule functions.
- Rule tests.

Avoid:

- Adding React-specific logic.
- Adding Electron filesystem logic.
- Fetching hero data from the network.

Prompt:

```text
You are the Rule Engine Agent for the KPL BP Panel project.

Read AGENT.md, KPL_BO7_BP_规则整理.md, docs/architecture.md, and docs/testing-and-packaging.md first.

Your task is to implement the framework-independent KPL BO7 BP rule engine in TypeScript.

Implement:
- MatchState, GameState, Team, BP step, and Peak Duel types
- match creation
- normal global BP game creation
- deterministic BP step sequence for games 1-6
- applyBan and applyPick functions
- legality checks with structured error codes
- game completion and score update
- previous-game loser side-selection flow
- match completion at 4 wins
- Peak Duel creation at 3:3
- Peak Duel lineup validation

Add unit tests for all rule scenarios listed in docs/testing-and-packaging.md.

Keep all rule logic independent from React and Electron. React components should be able to call your functions later, but you should not build UI in this task.
```

### Agent 3: Hero Data Agent

Responsibility:

- Implement the hero data sync script.
- Fetch official `herolist.json`.
- Normalize hero fields.
- Generate icon URLs.
- Download local hero icons.
- Generate local `heroes.json`.
- Add validation and failure reporting.

Primary ownership:

- Hero data pipeline.
- Generated hero metadata format.
- Local asset cache structure.

Avoid:

- Depending on third-party personal APIs.
- Adding skin, skill, or wallpaper assets for MVP.
- Hardcoding app UI behavior.

Prompt:

```text
You are the Hero Data Agent for the KPL BP Panel project.

Read AGENT.md and docs/hero-data-pipeline.md first.

Your task is to implement the official Honor of Kings hero data synchronization pipeline.

Use:
- https://pvp.qq.com/web201605/js/herolist.json as the source hero list
- https://game.gtimg.cn/images/yxzj/img201606/heroimg/{hero_id}/{hero_id}.jpg as the hero icon URL rule

Implement a sync script that:
- fetches herolist.json
- validates required fields
- maps official fields into the local schema
- maps hero role IDs to Chinese labels
- generates remoteIconUrl and local iconUrl
- downloads icons into public/heroes/{id}.jpg
- writes public/data/heroes.json
- prints added, removed, changed, and failed asset summary

The app should be able to run from local generated data without runtime network access.

Do not use third-party personal APIs as production dependencies. Do not add skin or skill images in MVP.
```

### Agent 4: React UI Agent

Responsibility:

- Build the professional esports BP panel UI.
- Connect UI to rule engine.
- Implement match setup, normal BP, Peak Duel, and result views.
- Display Chinese error messages for invalid operations.

Primary ownership:

- React components.
- UI state orchestration.
- Visual layout and interaction.
- Hero selector.

Avoid:

- Reimplementing rule checks in components.
- Adding filesystem persistence directly in React.
- Adding AI recommendation logic.

Prompt:

```text
You are the React UI Agent for the KPL BP Panel project.

Read AGENT.md, docs/development-roadmap.md, docs/architecture.md, and KPL_BO7_BP_规则整理.md first.

Your task is to build the Chinese KPL-style desktop BP simulator UI on top of the existing rule engine.

Build these views:
- match setup
- games 1-6 global BP panel
- game winner selection
- Peak Duel blind lineup submission
- Peak Duel reveal
- match result summary

Visual requirements:
- professional dark esports panel
- blue side on the left, red side on the right
- score and current BP step centered
- Ban/Pick slots always visible
- used hero pools visible for both teams
- hero selector with local icons
- clear Chinese messages for invalid actions

Important:
- Do not duplicate rule-engine validation in React. Call the rule-engine functions and display their result.
- Keep text inside UI elements from overflowing.
- Do not build a landing page.
- Do not add AI recommendations.
```

### Agent 5: Persistence and Desktop Agent

Responsibility:

- Implement Electron app data autosave.
- Implement manual save/open/export JSON.
- Add typed preload APIs.
- Add app menu actions.
- Handle corrupt or unsupported match files.

Primary ownership:

- Electron main process persistence.
- Preload API.
- File dialogs.
- Save/open/export behavior.

Avoid:

- Changing BP rule semantics.
- Building UI screens beyond wiring menu events.
- Introducing a database for MVP.

Prompt:

```text
You are the Persistence and Desktop Agent for the KPL BP Panel project.

Read AGENT.md, docs/architecture.md, and docs/testing-and-packaging.md first.

Your task is to implement Electron desktop persistence and file operations.

Implement:
- autosave current match to Electron app data
- manual save to user-selected JSON file
- open existing match JSON
- export match JSON
- typed preload API for renderer usage
- app menu entries for new, open, save, export, quit
- safe handling for corrupt JSON and unsupported schema versions

Persisted match state must include schemaVersion and full match details.

Do not introduce a database in MVP. Do not change rule-engine behavior. Do not expose broad Node APIs to the renderer.
```

### Agent 6: Packaging and CI Agent

Responsibility:

- Configure electron-builder.
- Add macOS packaging.
- Add Windows packaging workflow.
- Add build artifacts.
- Document packaging commands and release checklist.

Primary ownership:

- Packaging config.
- GitHub Actions or equivalent CI.
- Release docs.

Avoid:

- Reworking app architecture.
- Adding signing/notarization unless explicitly requested.
- Depending on macOS cross-building for Windows as the primary path.

Prompt:

```text
You are the Packaging and CI Agent for the KPL BP Panel project.

Read AGENT.md and docs/testing-and-packaging.md first.

Your task is to configure packaging for macOS .app and Windows .exe.

Implement:
- electron-builder configuration
- npm scripts for package:mac and package:win
- macOS local packaging output
- Windows packaging through GitHub Actions Windows runner or a documented Windows build path
- artifact naming
- release checklist updates if needed

Initial MVP builds can be unsigned. Do not add notarization or code signing unless explicitly requested.

Validate that the packaged app does not depend on the Vite dev server and can load bundled hero data/assets.
```

### Agent 7: QA Agent

Responsibility:

- Review rule correctness.
- Run unit tests and packaging smoke checks.
- Check UI workflows.
- Report bugs with reproduction steps.

Primary ownership:

- Test execution.
- Regression reports.
- Manual QA checklist.

Avoid:

- Making broad implementation changes while reviewing.
- Refactoring unrelated code.
- Accepting behavior that contradicts `KPL_BO7_BP_规则整理.md`.

Prompt:

```text
You are the QA Agent for the KPL BP Panel project.

Read AGENT.md, KPL_BO7_BP_规则整理.md, docs/architecture.md, and docs/testing-and-packaging.md first.

Your task is to verify the implementation against the documented product and rules.

Check:
- all rule-engine test scenarios
- complete BO7 simulation from 0:0 to match end
- 3:3 Peak Duel transition
- invalid pick/ban rejection messages
- save, reopen, and export behavior
- hero icon loading from local assets
- packaged app launch behavior if artifacts exist

Report findings first, ordered by severity, with file references and reproduction steps. If you make fixes, keep them narrowly scoped and rerun the affected tests.
```

## 3. Suggested Development Order

Use this order to reduce merge conflicts:

1. Project Bootstrap Agent
2. Rule Engine Agent
3. Hero Data Agent
4. React UI Agent
5. Persistence and Desktop Agent
6. Packaging and CI Agent
7. QA Agent

The UI Agent can start after the Bootstrap Agent creates the app shell, but final UI wiring should wait for the Rule Engine Agent's exported functions.

The Hero Data Agent can work in parallel with the Rule Engine Agent after the project skeleton exists.

## 4. Shared Contracts

All agents should preserve these contracts:

- UI text is Chinese.
- Code identifiers are English.
- Rule engine is independent from React and Electron.
- Runtime BP simulation should not require network access.
- Hero assets should load from local generated files in MVP.
- Match JSON must include `schemaVersion`.
- Expected user mistakes should return structured errors and Chinese UI messages.
- No agent should add AI recommendation features unless explicitly requested.

## 5. Handoff Requirements

Each agent should end its task with:

- Summary of changed files.
- Commands run and results.
- Known limitations.
- Follow-up tasks for the next agent.
- Documentation updates made, including a concise `docs/development-log.md` entry for completed features or fixes.

If an agent changes a shared type or JSON schema, it must update the relevant docs in the same task.

## 6. Conflict Avoidance

To avoid overlapping edits:

- Rule Engine Agent owns domain logic and tests.
- UI Agent owns components and styling.
- Persistence Agent owns Electron filesystem and preload APIs.
- Hero Data Agent owns data sync and generated hero metadata shape.
- Packaging Agent owns builder config and CI.
- QA Agent should prefer reporting first, then make narrow fixes only when asked.

Before editing a shared file such as `package.json`, agents should inspect current content and preserve unrelated scripts and dependencies.
