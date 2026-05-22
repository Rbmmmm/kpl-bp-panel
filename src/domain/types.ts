export type TeamId = "teamA" | "teamB";
export type Side = "blue" | "red";
export type GameMode = "global_bp" | "peak_duel";
export type BpActionType = "ban" | "pick";
export type MatchStatus = "setup" | "drafting" | "game_complete" | "match_complete";
export type YuanliuzhiziRole = "tank" | "mage" | "assassin" | "marksman" | "support";

export interface YuanliuzhiziBpUnit {
  id: number;
  role: YuanliuzhiziRole;
  displayName: string;
}

export interface Player {
  id: string;
  name: string;
  role?: string;
}

export interface Team {
  id: TeamId;
  name: string;
  players: Player[];
  usedHeroIds: number[];
}

export interface BpStep {
  side: Side;
  action: BpActionType;
  count: number;
}

export interface SideSelectionState {
  gameIndex: number;
  teamId: TeamId;
  reason: "initial" | "previous_game_loser";
}

export interface PeakDuelSlot {
  playerId?: string;
  playerName?: string;
  heroId: number;
  summonerSkill?: string;
}

export interface PeakDuelLineup {
  teamId: TeamId;
  slots: PeakDuelSlot[];
  submittedAt?: string;
}

export interface GameState {
  index: number;
  mode: GameMode;
  blueTeam: TeamId;
  redTeam: TeamId;
  bans: Record<Side, number[]>;
  picks: Record<Side, number[]>;
  bpStepIndex: number;
  winner?: TeamId;
  peakDuel?: Partial<Record<TeamId, PeakDuelLineup>>;
}

export interface MatchState {
  schemaVersion: 1;
  teams: Record<TeamId, Team>;
  score: Record<TeamId, number>;
  games: GameState[];
  currentGameIndex: number;
  currentSideSelection?: SideSelectionState;
  status: MatchStatus;
}

export type RuleErrorCode =
  | "invalid_team"
  | "invalid_side"
  | "invalid_hero"
  | "invalid_lineup"
  | "invalid_bp_step"
  | "game_not_drafting"
  | "game_not_complete"
  | "game_already_complete"
  | "match_already_complete"
  | "normal_bp_not_available"
  | "peak_duel_not_available"
  | "hero_banned_current_game"
  | "hero_banned_duplicate"
  | "hero_picked_current_game"
  | "hero_used_by_same_team"
  | "yuanliuzhizi_picked_current_game"
  | "yuanliuzhizi_used_by_same_team"
  | "yuanliuzhizi_variant_conflict"
  | "side_selection_required"
  | "side_selection_not_owned_by_team"
  | "peak_duel_duplicate_hero";

export interface RuleError {
  code: RuleErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type RuleResult<T> = { ok: true; value: T } | { ok: false; error: RuleError };

export interface CreateMatchInput {
  teamAName?: string;
  teamBName?: string;
  teamAPlayers?: Player[];
  teamBPlayers?: Player[];
  firstSideSelectionTeam?: TeamId;
}
