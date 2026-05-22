# Architecture

## 1. App Structure

Use a three-layer structure:

```text
Electron main process
  - window lifecycle
  - app menu
  - filesystem persistence
  - packaging integration

Preload API
  - typed bridge between renderer and main
  - save/open/export methods
  - no broad Node exposure

React renderer
  - BP panel UI
  - match setup UI
  - hero selector
  - result display
```

Keep KPL BP rules in a framework-independent domain layer that can be tested without Electron or React.

## 2. Domain Model

Recommended core types:

```ts
type TeamId = "teamA" | "teamB";
type Side = "blue" | "red";
type GameMode = "global_bp" | "peak_duel";
type BpActionType = "ban" | "pick";

interface MatchState {
  schemaVersion: 1;
  teams: Record<TeamId, Team>;
  score: Record<TeamId, number>;
  games: GameState[];
  currentGameIndex: number;
  currentSideSelection?: SideSelectionState;
  status: "setup" | "drafting" | "game_complete" | "match_complete";
}

interface GameState {
  index: number;
  mode: GameMode;
  blueTeam: TeamId;
  redTeam: TeamId;
  bans: Record<Side, number[]>;
  picks: Record<Side, number[]>;
  bpStepIndex: number;
  winner?: TeamId;
  peakDuel?: Record<TeamId, PeakDuelLineup>;
}

interface Team {
  id: TeamId;
  name: string;
  players: Player[];
  usedHeroIds: number[];
}
```

The exact file layout can be decided during implementation, but the rule engine must not depend on React state or Electron APIs.

## 3. BP Step Sequence

Represent the normal BP sequence as data.

```ts
const GLOBAL_BP_STEPS = [
  { side: "blue", action: "ban", count: 1 },
  { side: "red", action: "ban", count: 1 },
  { side: "blue", action: "ban", count: 1 },
  { side: "red", action: "ban", count: 1 },
  { side: "blue", action: "pick", count: 1 },
  { side: "red", action: "pick", count: 2 },
  { side: "blue", action: "pick", count: 2 },
  { side: "red", action: "pick", count: 1 },
  { side: "red", action: "ban", count: 1 },
  { side: "blue", action: "ban", count: 1 },
  { side: "red", action: "ban", count: 1 },
  { side: "blue", action: "ban", count: 1 },
  { side: "red", action: "ban", count: 1 },
  { side: "blue", action: "ban", count: 1 },
  { side: "red", action: "pick", count: 1 },
  { side: "blue", action: "pick", count: 2 },
  { side: "red", action: "pick", count: 1 }
] as const;
```

This produces:

- Blue: 5 bans, 5 picks.
- Red: 5 bans, 5 picks.

The normal BP structure is `ban 2 -> pick 3 -> ban 3 -> pick 2`.

元流之子 should be represented as role variants in BP state, such as `元流之子（坦克）` and `元流之子（辅助）`. Bans target only the selected role variant. Picks are stricter: once either side picks any 元流之子 variant in a game, neither side can pick another 元流之子 variant in that game. In games 1-6, once a team uses any 元流之子 variant, that team cannot use any 元流之子 variant again in later global BP games.

## 4. Rule Engine Responsibilities

The rule engine owns:

- Creating a match.
- Creating a game.
- Applying a ban.
- Applying a pick.
- Computing current BP step.
- Checking legal heroes.
- Completing a game.
- Advancing score.
- Entering Peak Duel.
- Validating Peak Duel lineups.

React components should call rule-engine functions and render the resulting state or error.

## 5. Persistence Model

Save match state as versioned JSON.

Minimum saved fields:

- Schema version.
- Teams and players.
- Score.
- Every game.
- Side assignment.
- Bans and picks.
- Used hero pools.
- Peak Duel submissions.
- Match status.

Autosave path should use Electron app data. Manual exports should be user-selected JSON files.

## 6. Error Handling

Invalid operations should return structured errors, not throw for expected user mistakes.

Examples:

- `hero_banned_current_game`
- `hero_picked_current_game`
- `hero_used_by_same_team`
- `invalid_bp_step`
- `peak_duel_duplicate_hero`
- `match_already_complete`

UI maps these codes to clear Chinese messages.
