# Development Roadmap

## 1. MVP Goal

Build a desktop KPL BO7 BP simulator that runs as:

- macOS `.app`
- Windows `.exe`

The MVP is a manual simulator, not an AI drafting assistant.

MVP success criteria:

- User can create a BO7 match with two teams.
- User can run games 1-6 using KPL global BP.
- App enforces all core BP legality rules.
- App tracks score, game index, side selection, bans, picks, and used hero pools.
- App enters Peak Duel at 3:3.
- App saves local progress and exports match JSON.
- App can be packaged for macOS and Windows.

## 2. Chosen Stack

Use:

- Electron for desktop shell.
- React for UI.
- TypeScript for app code.
- Vite for renderer development.
- npm for package management.
- electron-builder for packaging.

Reasoning:

- Current environment already has Node.js and npm.
- Electron has mature cross-platform `.app` and `.exe` packaging.
- React is suitable for state-heavy BP panel UI.
- TypeScript makes rule-engine and match-state modeling safer.

Do not use Tauri for the first version because the current environment does not have Rust installed.

## 3. Implementation Phases

Current status: the MVP implementation path has been completed once across all planned agent areas. Keep this roadmap as the intended architecture and use `docs/development-log.md` for ongoing completion/fix records.

### Phase 1: App Skeleton

Create the Electron + React + TypeScript + Vite project.

Required behavior:

- App launches a single main window.
- Renderer displays the simulator shell.
- Basic app menu supports new match, open, save, export, quit.
- Main and renderer communicate through a typed preload API.

No BP feature should depend on direct Node access from React components.

### Phase 2: Domain Rules

Implement the rule engine before the full UI.

Core modules:

- Match creation.
- Side assignment.
- BP step sequence for games 1-6.
- Ban legality.
- Pick legality.
- Game result submission.
- Score update.
- Side-selection handoff to previous-game loser.
- Peak Duel transition at 3:3.
- Peak Duel lineup legality.

Rule functions should be pure where possible.

### Phase 3: Hero Data Pipeline

Implement a sync script that:

1. Fetches `https://pvp.qq.com/web201605/js/herolist.json`.
2. Maps official fields into local app fields.
3. Generates icon URLs from hero ID.
4. Downloads hero icons to local cache.
5. Writes a generated `heroes.json`.

The UI should read generated local data, not fetch remote data at runtime for normal usage.

### Phase 4: BP Panel UI

Build the usable simulator interface.

Required views:

- Match setup.
- Normal BP panel for games 1-6.
- Game summary and winner selection.
- Peak Duel blind submission.
- Peak Duel reveal.
- Match result summary.

Primary layout:

- Blue side on the left.
- Red side on the right.
- Score and current step in the center.
- Hero selector modal or drawer.
- Used hero pool visible for both teams.

### Phase 5: Persistence

Implement:

- Autosave current match to Electron app data.
- Manual save to a local JSON file.
- Open existing match JSON.
- Export completed or in-progress match JSON.

Persisted match files must include a schema version.

### Phase 6: Packaging

Set up:

- macOS local packaging.
- Windows packaging through GitHub Actions or a Windows machine.

Initial packaging does not need code signing. Add signing later only if distribution requires it.

Implemented packaging paths:

- `npm run package:mac`
- `npm run package:win`
- `.github/workflows/package-windows.yml`

## 4. Out of Scope for MVP

Do not include these in the first implementation unless explicitly requested later:

- AI recommendations.
- Online account system.
- Cloud sync.
- Live match data ingestion.
- Skin gallery.
- Skill images.
- Draft timers.
- Theme editor.
- Commercial asset licensing flow.

## 5. Acceptance Checklist

The MVP is acceptable when:

- A full BO7 from 0:0 to 4 wins can be simulated.
- Illegal BP actions are blocked with Chinese explanations.
- Peak Duel behavior differs correctly from games 1-6.
- Local save and reopen restore the same state.
- Exported JSON contains all match details.
- macOS package opens outside dev mode.
- Windows package is produced by the documented build path.
