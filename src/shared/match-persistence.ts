import type {
  GameMode,
  GameState,
  MatchState,
  MatchStatus,
  PeakDuelLineup,
  PeakDuelSlot,
  Player,
  Side,
  SideSelectionState,
  Team,
  TeamId
} from "../domain/types";
import type { PersistenceError } from "./electron-api";

export const MATCH_SCHEMA_VERSION = 1;

export type MatchValidationResult =
  | {
      ok: true;
      matchState: MatchState;
    }
  | {
      ok: false;
      error: PersistenceError;
    };

const CHINESE_MESSAGES: Record<PersistenceError["code"], string> = {
  corrupt_json: "比赛文件不是有效的 JSON，无法打开。",
  unsupported_schema_version: "比赛文件版本高于当前应用支持版本，请升级应用后再打开。",
  invalid_match_schema: "比赛文件结构不符合当前比赛存档格式。",
  file_io_error: "文件读写失败，请检查路径和权限。"
};

export function createPersistenceError(
  code: PersistenceError["code"],
  details?: Record<string, unknown>
): PersistenceError {
  return {
    code,
    message: CHINESE_MESSAGES[code],
    ...(details ? { details } : {})
  };
}

export function parseMatchJson(raw: string): MatchValidationResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    return {
      ok: false,
      error: createPersistenceError("corrupt_json", {
        reason: error instanceof Error ? error.message : String(error)
      })
    };
  }

  return validateMatchState(parsed);
}

export function serializeMatchState(matchState: MatchState): MatchValidationResult & { json?: string } {
  const validation = validateMatchState(matchState);
  if (!validation.ok) {
    return validation;
  }

  return {
    ...validation,
    json: `${JSON.stringify(validation.matchState, null, 2)}\n`
  };
}

export function validateMatchState(value: unknown): MatchValidationResult {
  if (!isRecord(value)) {
    return invalid("root_not_object");
  }

  const schemaVersion = value.schemaVersion;
  if (typeof schemaVersion !== "number") {
    return invalid("schemaVersion_missing");
  }

  if (schemaVersion > MATCH_SCHEMA_VERSION) {
    return {
      ok: false,
      error: createPersistenceError("unsupported_schema_version", {
        supported: MATCH_SCHEMA_VERSION,
        received: schemaVersion
      })
    };
  }

  if (schemaVersion !== MATCH_SCHEMA_VERSION) {
    return invalid("schemaVersion_unsupported");
  }

  if (!isTeams(value.teams)) {
    return invalid("teams_invalid");
  }

  if (!isScore(value.score)) {
    return invalid("score_invalid");
  }

  if (!Array.isArray(value.games) || !value.games.every(isGameState)) {
    return invalid("games_invalid");
  }

  const currentGameIndex = value.currentGameIndex;
  if (!Number.isInteger(currentGameIndex) || (currentGameIndex as number) < 0 || (currentGameIndex as number) > 7) {
    return invalid("currentGameIndex_invalid");
  }

  if (value.currentSideSelection !== undefined && !isSideSelectionState(value.currentSideSelection)) {
    return invalid("currentSideSelection_invalid");
  }

  if (!isMatchStatus(value.status)) {
    return invalid("status_invalid");
  }

  return {
    ok: true,
    matchState: value as unknown as MatchState
  };
}

function invalid(reason: string): MatchValidationResult {
  return {
    ok: false,
    error: createPersistenceError("invalid_match_schema", { reason })
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTeamId(value: unknown): value is TeamId {
  return value === "teamA" || value === "teamB";
}

function isSide(value: unknown): value is Side {
  return value === "blue" || value === "red";
}

function isGameMode(value: unknown): value is GameMode {
  return value === "global_bp" || value === "peak_duel";
}

function isMatchStatus(value: unknown): value is MatchStatus {
  return value === "setup" || value === "drafting" || value === "game_complete" || value === "match_complete";
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item) && item > 0);
}

function isPlayer(value: unknown): value is Player {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.role === undefined || typeof value.role === "string")
  );
}

function isTeam(value: unknown, expectedId: TeamId): value is Team {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.id === expectedId &&
    typeof value.name === "string" &&
    Array.isArray(value.players) &&
    value.players.every(isPlayer) &&
    isNumberArray(value.usedHeroIds)
  );
}

function isTeams(value: unknown): value is MatchState["teams"] {
  if (!isRecord(value)) {
    return false;
  }

  return isTeam(value.teamA, "teamA") && isTeam(value.teamB, "teamB");
}

function isScore(value: unknown): value is MatchState["score"] {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Number.isInteger(value.teamA) &&
    Number.isInteger(value.teamB) &&
    (value.teamA as number) >= 0 &&
    (value.teamB as number) >= 0 &&
    (value.teamA as number) <= 4 &&
    (value.teamB as number) <= 4
  );
}

function isSideRecord(value: unknown): value is Record<Side, number[]> {
  if (!isRecord(value)) {
    return false;
  }

  return isNumberArray(value.blue) && isNumberArray(value.red);
}

function isPeakDuelSlot(value: unknown): value is PeakDuelSlot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.playerId === undefined || typeof value.playerId === "string") &&
    (value.playerName === undefined || typeof value.playerName === "string") &&
    Number.isInteger(value.heroId) &&
    (value.heroId as number) > 0 &&
    (value.summonerSkill === undefined || typeof value.summonerSkill === "string")
  );
}

function isPeakDuelLineup(value: unknown, expectedTeamId: TeamId): value is PeakDuelLineup {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.teamId === expectedTeamId &&
    Array.isArray(value.slots) &&
    value.slots.every(isPeakDuelSlot) &&
    (value.submittedAt === undefined || typeof value.submittedAt === "string")
  );
}

function isPeakDuelRecord(value: unknown): value is GameState["peakDuel"] {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.teamA === undefined || isPeakDuelLineup(value.teamA, "teamA")) &&
    (value.teamB === undefined || isPeakDuelLineup(value.teamB, "teamB"))
  );
}

function isGameState(value: unknown): value is GameState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Number.isInteger(value.index) &&
    (value.index as number) >= 1 &&
    (value.index as number) <= 7 &&
    isGameMode(value.mode) &&
    isTeamId(value.blueTeam) &&
    isTeamId(value.redTeam) &&
    value.blueTeam !== value.redTeam &&
    isSideRecord(value.bans) &&
    isSideRecord(value.picks) &&
    Number.isInteger(value.bpStepIndex) &&
    (value.bpStepIndex as number) >= 0 &&
    (value.winner === undefined || isTeamId(value.winner)) &&
    (value.peakDuel === undefined || isPeakDuelRecord(value.peakDuel))
  );
}

function isSideSelectionState(value: unknown): value is SideSelectionState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Number.isInteger(value.gameIndex) &&
    (value.gameIndex as number) >= 1 &&
    (value.gameIndex as number) <= 7 &&
    isTeamId(value.teamId) &&
    (value.reason === "initial" || value.reason === "previous_game_loser")
  );
}
