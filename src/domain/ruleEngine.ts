import type {
  BpActionType,
  BpStep,
  CreateMatchInput,
  GameState,
  MatchState,
  PeakDuelLineup,
  RuleError,
  RuleErrorCode,
  RuleResult,
  Side,
  Team,
  TeamId,
  YuanliuzhiziBpUnit
} from "./types";

export const YUANLIUZHIZI_BP_UNITS = {
  tank: { id: 900001, role: "tank", displayName: "元流之子（坦克）" },
  mage: { id: 900002, role: "mage", displayName: "元流之子（法师）" },
  assassin: { id: 900003, role: "assassin", displayName: "元流之子（刺客）" },
  marksman: { id: 900004, role: "marksman", displayName: "元流之子（射手）" },
  support: { id: 900005, role: "support", displayName: "元流之子（辅助）" }
} as const satisfies Record<string, YuanliuzhiziBpUnit>;

const YUANLIUZHIZI_BP_UNIT_IDS = new Set<number>(
  Object.values(YUANLIUZHIZI_BP_UNITS).map((unit) => unit.id)
);

export const GLOBAL_BP_STEPS = [
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
] as const satisfies readonly BpStep[];

const CHINESE_MESSAGES: Record<RuleErrorCode, string> = {
  invalid_team: "队伍不存在。",
  invalid_side: "选边无效。",
  invalid_hero: "英雄无效。",
  invalid_lineup: "阵容无效。",
  invalid_bp_step: "当前 BP 步骤不允许该操作。",
  game_not_drafting: "当前小局不在 BP 阶段。",
  game_not_complete: "当前小局尚未完成 BP。",
  game_already_complete: "当前小局已经完成。",
  match_already_complete: "比赛已经结束。",
  normal_bp_not_available: "当前不能创建常规 BP 小局。",
  peak_duel_not_available: "当前不能创建巅峰对决。",
  hero_banned_current_game: "该英雄已在当前小局被禁用。",
  hero_banned_duplicate: "该英雄已在当前小局被禁用。",
  hero_picked_current_game: "该英雄已在当前小局被选择。",
  hero_used_by_same_team: "该队伍已在前序小局使用过该英雄。",
  yuanliuzhizi_picked_current_game: "当前小局已有队伍选择元流之子，双方不能再选择其他元流之子职业形态。",
  yuanliuzhizi_used_by_same_team: "该队伍已在前序小局使用过元流之子，后续不能再选择任何元流之子职业形态。",
  yuanliuzhizi_variant_conflict: "元流之子职业形态选择冲突。",
  side_selection_required: "需要先完成选边。",
  side_selection_not_owned_by_team: "当前队伍没有本局选边权。",
  peak_duel_duplicate_hero: "巅峰对决同队阵容不能重复英雄。"
};

function ok<T>(value: T): RuleResult<T> {
  return { ok: true, value };
}

function fail(code: RuleErrorCode, details?: Record<string, unknown>): RuleResult<never> {
  return { ok: false, error: createRuleError(code, details) };
}

export function createRuleError(code: RuleErrorCode, details?: Record<string, unknown>): RuleError {
  return {
    code,
    message: CHINESE_MESSAGES[code],
    ...(details ? { details } : {})
  };
}

export function createMatch(input: CreateMatchInput = {}): MatchState {
  const firstSideSelectionTeam = input.firstSideSelectionTeam ?? "teamA";

  return {
    schemaVersion: 1,
    teams: {
      teamA: createTeam("teamA", input.teamAName ?? "A队", input.teamAPlayers ?? []),
      teamB: createTeam("teamB", input.teamBName ?? "B队", input.teamBPlayers ?? [])
    },
    score: {
      teamA: 0,
      teamB: 0
    },
    games: [],
    currentGameIndex: 0,
    currentSideSelection: {
      gameIndex: 1,
      teamId: firstSideSelectionTeam,
      reason: "initial"
    },
    status: "setup"
  };
}

function createTeam(id: TeamId, name: string, players: Team["players"]): Team {
  return {
    id,
    name,
    players,
    usedHeroIds: []
  };
}

export function createGlobalBpGame(
  match: MatchState,
  selectingTeam: TeamId,
  selectedSide: Side
): RuleResult<MatchState> {
  if (match.status === "match_complete") {
    return fail("match_already_complete");
  }

  if (!isTeamId(selectingTeam)) {
    return fail("invalid_team", { selectingTeam });
  }

  if (!isSide(selectedSide)) {
    return fail("invalid_side", { selectedSide });
  }

  const nextIndex = match.games.length + 1;
  if (nextIndex > 6 || isScore(match, 3, 3)) {
    return fail("normal_bp_not_available", { nextIndex, score: match.score });
  }

  if (!match.currentSideSelection || match.currentSideSelection.gameIndex !== nextIndex) {
    return fail("side_selection_required", { nextIndex });
  }

  if (match.currentSideSelection.teamId !== selectingTeam) {
    return fail("side_selection_not_owned_by_team", {
      expectedTeam: match.currentSideSelection.teamId,
      selectingTeam
    });
  }

  const otherTeam = getOpponentTeam(selectingTeam);
  const game = createNormalGame(nextIndex, selectedSide === "blue" ? selectingTeam : otherTeam);

  return ok({
    ...match,
    games: [...match.games, game],
    currentGameIndex: game.index,
    currentSideSelection: undefined,
    status: "drafting"
  });
}

function createNormalGame(index: number, blueTeam: TeamId): GameState {
  const redTeam = getOpponentTeam(blueTeam);

  return {
    index,
    mode: "global_bp",
    blueTeam,
    redTeam,
    bans: {
      blue: [],
      red: []
    },
    picks: {
      blue: [],
      red: []
    },
    bpStepIndex: 0
  };
}

export function getCurrentBpStep(game: GameState): BpStep | undefined {
  if (game.mode !== "global_bp") {
    return undefined;
  }

  return GLOBAL_BP_STEPS[game.bpStepIndex];
}

export function applyBan(match: MatchState, heroId: number): RuleResult<MatchState> {
  return applyBpAction(match, "ban", heroId);
}

export function applyPick(match: MatchState, heroId: number): RuleResult<MatchState> {
  return applyBpAction(match, "pick", heroId);
}

function applyBpAction(match: MatchState, action: BpActionType, heroId: number): RuleResult<MatchState> {
  if (match.status === "match_complete") {
    return fail("match_already_complete");
  }

  if (!Number.isInteger(heroId) || heroId <= 0) {
    return fail("invalid_hero", { heroId });
  }

  const gameIndex = match.currentGameIndex;
  const game = match.games[gameIndex - 1];
  if (!game || match.status !== "drafting" || game.mode !== "global_bp") {
    return fail("game_not_drafting");
  }

  const step = getCurrentBpStep(game);
  if (!step || step.action !== action) {
    return fail("invalid_bp_step", {
      expected: step,
      attemptedAction: action
    });
  }

  const legal = action === "ban" ? validateBan(game, heroId) : validatePick(match, game, step.side, heroId);
  if (!legal.ok) {
    return legal;
  }

  const updatedGame = addActionToGame(game, step, heroId);
  return ok(replaceCurrentGame(match, updatedGame));
}

function validateBan(game: GameState, heroId: number): RuleResult<true> {
  if (game.bans.blue.includes(heroId) || game.bans.red.includes(heroId)) {
    return fail("hero_banned_duplicate", { heroId });
  }

  if (game.picks.blue.includes(heroId) || game.picks.red.includes(heroId)) {
    return fail("hero_picked_current_game", { heroId });
  }

  return ok(true);
}

function validatePick(match: MatchState, game: GameState, side: Side, heroId: number): RuleResult<true> {
  if (game.bans.blue.includes(heroId) || game.bans.red.includes(heroId)) {
    return fail("hero_banned_current_game", { heroId });
  }

  if (game.picks.blue.includes(heroId) || game.picks.red.includes(heroId)) {
    return fail("hero_picked_current_game", { heroId });
  }

  const teamId = getTeamForSide(game, side);
  if (isYuanliuzhiziVariant(heroId)) {
    const currentGameYuanliuzhiziVariants = [...game.picks.blue, ...game.picks.red].filter(isYuanliuzhiziVariant);
    if (currentGameYuanliuzhiziVariants.length > 0) {
      return fail("yuanliuzhizi_picked_current_game", {
        heroId,
        teamId,
        pickedVariants: currentGameYuanliuzhiziVariants
      });
    }

    const teamUsedYuanliuzhiziVariants = match.teams[teamId].usedHeroIds.filter(isYuanliuzhiziVariant);
    if (teamUsedYuanliuzhiziVariants.length > 0) {
      return fail("yuanliuzhizi_used_by_same_team", {
        heroId,
        teamId,
        usedVariants: teamUsedYuanliuzhiziVariants
      });
    }
  } else if (match.teams[teamId].usedHeroIds.includes(heroId)) {
    return fail("hero_used_by_same_team", { heroId, teamId });
  }

  return ok(true);
}

function addActionToGame(game: GameState, step: BpStep, heroId: number): GameState {
  const target = step.action === "ban" ? game.bans : game.picks;
  const currentCount = target[step.side].length;
  const updatedTarget = {
    ...target,
    [step.side]: [...target[step.side], heroId]
  };

  const priorCount = countActionsBeforeStep(game.bpStepIndex, step.side, step.action);
  const completedInStep = currentCount + 1 - priorCount;
  const shouldAdvanceStep = completedInStep >= step.count;

  return {
    ...game,
    [step.action === "ban" ? "bans" : "picks"]: updatedTarget,
    bpStepIndex: shouldAdvanceStep ? game.bpStepIndex + 1 : game.bpStepIndex
  };
}

function countActionsBeforeStep(stepIndex: number, side: Side, action: BpActionType): number {
  return GLOBAL_BP_STEPS.slice(0, stepIndex)
    .filter((step) => step.side === side && step.action === action)
    .reduce((total, step) => total + step.count, 0);
}

export function completeGame(match: MatchState, winner: TeamId): RuleResult<MatchState> {
  if (match.status === "match_complete") {
    return fail("match_already_complete");
  }

  if (!isTeamId(winner)) {
    return fail("invalid_team", { winner });
  }

  const game = match.games[match.currentGameIndex - 1];
  if (!game) {
    return fail("game_not_drafting");
  }

  if (game.winner) {
    return fail("game_already_complete", { gameIndex: game.index });
  }

  if (game.mode === "global_bp" && !isGlobalBpComplete(game)) {
    return fail("game_not_complete", { gameIndex: game.index });
  }

  if (game.mode === "peak_duel" && !areBothPeakDuelLineupsSubmitted(game)) {
    return fail("game_not_complete", { gameIndex: game.index });
  }

  const updatedGame = {
    ...game,
    winner
  };
  const loser = getOpponentTeam(winner);
  const updatedScore = {
    ...match.score,
    [winner]: match.score[winner] + 1
  };
  const updatedTeams = game.mode === "global_bp" ? applyUsedHeroes(match.teams, updatedGame) : match.teams;
  const status = updatedScore[winner] === 4 ? "match_complete" : "game_complete";
  const nextGameIndex = updatedGame.index + 1;

  return ok({
    ...match,
    teams: updatedTeams,
    score: updatedScore,
    games: replaceGameAtIndex(match.games, updatedGame),
    currentGameIndex: updatedGame.index,
    currentSideSelection:
      status === "game_complete"
        ? {
            gameIndex: nextGameIndex,
            teamId: loser,
            reason: "previous_game_loser"
          }
        : undefined,
    status
  });
}

function isGlobalBpComplete(game: GameState): boolean {
  return (
    game.bpStepIndex === GLOBAL_BP_STEPS.length &&
    game.bans.blue.length === 5 &&
    game.bans.red.length === 5 &&
    game.picks.blue.length === 5 &&
    game.picks.red.length === 5
  );
}

function applyUsedHeroes(teams: MatchState["teams"], game: GameState): MatchState["teams"] {
  return {
    ...teams,
    [game.blueTeam]: {
      ...teams[game.blueTeam],
      usedHeroIds: appendUnique(teams[game.blueTeam].usedHeroIds, game.picks.blue)
    },
    [game.redTeam]: {
      ...teams[game.redTeam],
      usedHeroIds: appendUnique(teams[game.redTeam].usedHeroIds, game.picks.red)
    }
  };
}

function appendUnique(existing: number[], added: number[]): number[] {
  const values = new Set(existing);
  for (const value of added) {
    values.add(value);
  }
  return [...values];
}

export function createPeakDuelGame(
  match: MatchState,
  selectingTeam = match.currentSideSelection?.teamId,
  selectedSide: Side = "blue"
): RuleResult<MatchState> {
  if (match.status === "match_complete") {
    return fail("match_already_complete");
  }

  if (!isScore(match, 3, 3) || match.games.length !== 6) {
    return fail("peak_duel_not_available", {
      score: match.score,
      games: match.games.length
    });
  }

  if (match.games.some((game) => game.index === 7)) {
    return fail("peak_duel_not_available", { reason: "already_created" });
  }

  if (!selectingTeam || !match.currentSideSelection || match.currentSideSelection.gameIndex !== 7) {
    return fail("side_selection_required", { nextIndex: 7 });
  }

  if (!isTeamId(selectingTeam)) {
    return fail("invalid_team", { selectingTeam });
  }

  if (!isSide(selectedSide)) {
    return fail("invalid_side", { selectedSide });
  }

  if (match.currentSideSelection.teamId !== selectingTeam) {
    return fail("side_selection_not_owned_by_team", {
      expectedTeam: match.currentSideSelection.teamId,
      selectingTeam
    });
  }

  const previousGame = match.games[5];
  const previousLoser = previousGame?.winner ? getOpponentTeam(previousGame.winner) : selectingTeam;
  const blueTeam = selectedSide === "blue" ? selectingTeam : getOpponentTeam(selectingTeam);
  const game: GameState = {
    index: 7,
    mode: "peak_duel",
    blueTeam,
    redTeam: getOpponentTeam(blueTeam),
    bans: {
      blue: [],
      red: []
    },
    picks: {
      blue: [],
      red: []
    },
    bpStepIndex: 0,
    peakDuel: {}
  };

  if (previousLoser !== selectingTeam) {
    return fail("side_selection_not_owned_by_team", {
      expectedTeam: previousLoser,
      selectingTeam
    });
  }

  return ok({
    ...match,
    games: [...match.games, game],
    currentGameIndex: 7,
    currentSideSelection: undefined,
    status: "drafting"
  });
}

export function validatePeakDuelLineup(lineup: PeakDuelLineup): RuleResult<PeakDuelLineup> {
  if (!isTeamId(lineup.teamId)) {
    return fail("invalid_team", { teamId: lineup.teamId });
  }

  if (lineup.slots.length !== 5) {
    return fail("invalid_lineup", { expectedSlots: 5, actualSlots: lineup.slots.length });
  }

  const heroIds = lineup.slots.map((slot) => slot.heroId);
  if (heroIds.some((heroId) => !Number.isInteger(heroId) || heroId <= 0)) {
    return fail("invalid_hero", { heroIds });
  }

  if (new Set(heroIds).size !== heroIds.length) {
    return fail("peak_duel_duplicate_hero", { heroIds });
  }

  return ok(lineup);
}

export function isYuanliuzhiziVariant(heroId: number): boolean {
  return YUANLIUZHIZI_BP_UNIT_IDS.has(heroId);
}

export function submitPeakDuelLineup(match: MatchState, lineup: PeakDuelLineup): RuleResult<MatchState> {
  if (match.status === "match_complete") {
    return fail("match_already_complete");
  }

  const game = match.games[match.currentGameIndex - 1];
  if (!game || game.mode !== "peak_duel" || match.status !== "drafting") {
    return fail("peak_duel_not_available");
  }

  const validLineup = validatePeakDuelLineup(lineup);
  if (!validLineup.ok) {
    return validLineup;
  }

  const updatedGame: GameState = {
    ...game,
    picks: {
      ...game.picks,
      [getSideForTeam(game, lineup.teamId)]: lineup.slots.map((slot) => slot.heroId)
    },
    peakDuel: {
      ...game.peakDuel,
      [lineup.teamId]: lineup
    }
  };

  return ok(replaceCurrentGame(match, updatedGame));
}

function areBothPeakDuelLineupsSubmitted(game: GameState): boolean {
  return Boolean(game.peakDuel?.teamA && game.peakDuel?.teamB);
}

export function getTeamForSide(game: GameState, side: Side): TeamId {
  return side === "blue" ? game.blueTeam : game.redTeam;
}

export function getSideForTeam(game: GameState, teamId: TeamId): Side {
  return game.blueTeam === teamId ? "blue" : "red";
}

export function getOpponentTeam(teamId: TeamId): TeamId {
  return teamId === "teamA" ? "teamB" : "teamA";
}

function replaceCurrentGame(match: MatchState, game: GameState): MatchState {
  return {
    ...match,
    games: replaceGameAtIndex(match.games, game)
  };
}

function replaceGameAtIndex(games: GameState[], game: GameState): GameState[] {
  return games.map((existingGame) => (existingGame.index === game.index ? game : existingGame));
}

function isScore(match: MatchState, teamAScore: number, teamBScore: number): boolean {
  return match.score.teamA === teamAScore && match.score.teamB === teamBScore;
}

function isTeamId(value: unknown): value is TeamId {
  return value === "teamA" || value === "teamB";
}

function isSide(value: unknown): value is Side {
  return value === "blue" || value === "red";
}
