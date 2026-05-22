# AGENT.md

## Project

KPL BP Panel is a cross-platform desktop app for simulating KPL BO7 Ban/Pick.

Target deliverables:

- macOS `.app`
- Windows `.exe`

Primary user flow:

1. Create a BO7 match.
2. Configure two teams and initial side selection.
3. Run manual KPL global BP for games 1-6.
4. Track score, side selection, bans, picks, and each team's global used hero pool.
5. Enter Peak Duel when the score reaches 3:3.
6. Save, reopen, and export the complete match result.

## Product Direction

Use a professional esports panel style:

- Chinese UI copy.
- Dark competitive visual style.
- Blue side and red side as the main layout anchors.
- Clear current-step indication.
- Visible BO7 score and game index.
- Visible per-game Ban/Pick slots.
- Visible global used hero pools.
- Peak Duel presented as blind lineup submission and simultaneous reveal.

Do not build a marketing landing page. The first screen should be the usable BP simulator.

## Tech Stack

Use:

- Electron
- React
- TypeScript
- Vite
- npm
- electron-builder

Current local environment already has Node.js and npm. Do not assume Rust/Tauri is available.

Code conventions:

- UI text: Chinese.
- Code identifiers, file names, types, functions: English.
- Data files: JSON where practical.
- Keep domain rules separate from React components.
- Keep Electron main-process filesystem work separate from renderer UI state.

## Canonical Rules

Before changing BP behavior, read:

- `KPL_BO7_BP_规则整理.md`

Core rules:

- BO7 is first to 4 wins.
- Games 1-6 use global BP.
- Each side has 5 bans and 5 picks per normal BP game.
- A team cannot reuse its own previously picked heroes in games 1-6.
- A team may pick heroes previously used by the opponent.
- Current-game bans only affect the current game.
- Current-game picks cannot duplicate across both sides in games 1-6.
- 元流之子 must be modeled by role variant for BP. Bans target one role variant only. Once any side picks any 元流之子 variant in a game, neither side can pick another 元流之子 variant in that game. Once a team uses any 元流之子 variant in games 1-6, that team cannot use any 元流之子 variant again in later global BP games.
- At 3:3, game 7 enters Peak Duel.
- Peak Duel ignores previous used hero pools.
- Peak Duel allows both teams to pick the same hero.
- Peak Duel still forbids duplicate heroes within the same team's 5-player lineup.

## Hero Data Direction

Use the official Honor of Kings website static data as the primary source:

- Hero list: `https://pvp.qq.com/web201605/js/herolist.json`
- Hero icon rule: `https://game.gtimg.cn/images/yxzj/img201606/heroimg/{hero_id}/{hero_id}.jpg`

Preferred local shape:

```json
{
  "id": 105,
  "name": "廉颇",
  "title": "正义爆轰",
  "role": "坦克",
  "roles": ["坦克"],
  "iconUrl": "heroes/105.jpg",
  "remoteIconUrl": "https://game.gtimg.cn/images/yxzj/img201606/heroimg/105/105.jpg"
}
```

Do not depend on third-party personal APIs for production app behavior. They can be used only as references.

## Asset and Copyright Notes

Hero data and images are Tencent/Honor of Kings assets.

For this project:

- Prefer local cache for app stability.
- Keep source attribution in docs.
- Avoid bundling unnecessary skin art or promotional assets in the MVP.
- Do not imply official affiliation.
- For public or commercial distribution, verify authorization requirements before release.

## Documentation

Important docs:

- `AGENTS.md`: multi-agent working rules and documentation requirements.
- `docs/development-log.md`: concise record of completed features, fixes, and verification.
- `docs/development-roadmap.md`: staged implementation path.
- `docs/architecture.md`: app modules and state model.
- `docs/hero-data-pipeline.md`: hero data sync and local cache plan.
- `docs/testing-and-packaging.md`: test and desktop build expectations.

Keep docs updated when product decisions change.

Every completed feature, fix, packaging change, or behavior change must be recorded in `docs/development-log.md`. Update subsystem docs only when commands, schemas, behavior, or workflow changed.

## Implementation Expectations

When implementing:

- Add focused tests for rule-engine behavior before relying on UI manual testing.
- Keep BP step ordering deterministic and data-driven.
- Validate actions through rule-engine functions instead of ad hoc UI checks.
- Store match state in a versioned JSON schema.
- Prefer local app data for autosaves and explicit JSON export for sharing.
- Make invalid actions impossible or clearly rejected with a Chinese error message.

When editing:

- Do not rewrite existing documents unnecessarily.
- Do not introduce broad refactors before the app skeleton exists.
- Do not add network-only behavior for core app usage.
- Do not add AI recommendations in MVP unless explicitly requested later.
