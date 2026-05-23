import { describe, expect, it } from "vitest";
import {
  applyBan,
  applyPick,
  completeGame,
  createGlobalBpGame,
  createMatch,
  createPeakDuelGame,
  getCurrentBpStep,
  GLOBAL_BP_STEPS,
  submitPeakDuelLineup,
  swapPickSlots,
  undoLastBpAction,
  YUANLIUZHIZI_BP_UNITS,
  type MatchState,
  type PeakDuelLineup,
  type RuleResult,
  type Side,
  type TeamId
} from "../src/domain";

function unwrap<T>(result: RuleResult<T>): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }

  return result.value;
}

function createDraft(selectedSide: Side = "blue"): MatchState {
  const match = createMatch({ firstSideSelectionTeam: "teamA" });
  return unwrap(createGlobalBpGame(match, "teamA", selectedSide));
}

function runLegalDraft(match: MatchState, startHeroId: number): MatchState {
  let nextHeroId = startHeroId;
  let state = match;
  let step = getCurrentBpStep(state.games[state.currentGameIndex - 1]);

  while (step) {
    for (let index = 0; index < step.count; index += 1) {
      state = unwrap(step.action === "ban" ? applyBan(state, nextHeroId) : applyPick(state, nextHeroId));
      nextHeroId += 1;
    }
    step = getCurrentBpStep(state.games[state.currentGameIndex - 1]);
  }

  return state;
}

function completeNormalGame(
  match: MatchState,
  winner: TeamId,
  startHeroId: number,
  selectedSide: Side = "blue"
): MatchState {
  const selector = match.currentSideSelection?.teamId;
  if (!selector) {
    throw new Error("No side selection available");
  }

  const drafting = unwrap(createGlobalBpGame(match, selector, selectedSide));
  const drafted = runLegalDraft(drafting, startHeroId);
  return unwrap(completeGame(drafted, winner));
}

function reachThreeThree(): MatchState {
  let match = createMatch({ firstSideSelectionTeam: "teamA" });
  const winners: TeamId[] = ["teamA", "teamB", "teamA", "teamB", "teamA", "teamB"];

  winners.forEach((winner, index) => {
    match = completeNormalGame(match, winner, 1000 + index * 100);
  });

  return match;
}

function lineup(teamId: TeamId, heroIds: number[]): PeakDuelLineup {
  return {
    teamId,
    slots: heroIds.map((heroId, index) => ({
      playerName: `${teamId}-player-${index + 1}`,
      heroId
    }))
  };
}

describe("KPL BO7 rule engine", () => {
  it("uses the deterministic BP sequence for games 1-6", () => {
    expect(GLOBAL_BP_STEPS).toEqual([
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
    ]);
  });

  it("provides 5 ban slots per side in games 1-6", () => {
    const match = runLegalDraft(createDraft(), 100);
    const game = match.games[0];

    expect(game.bans.blue).toHaveLength(5);
    expect(game.bans.red).toHaveLength(5);
    expect(game.picks.blue).toHaveLength(5);
    expect(game.picks.red).toHaveLength(5);
  });

  it("swaps completed pick slots on the same side", () => {
    let match = runLegalDraft(createDraft(), 100);
    const before = match.games[0].picks.blue;

    match = unwrap(swapPickSlots(match, "blue", 0, 4));

    expect(match.games[0].picks.blue).toEqual([before[4], before[1], before[2], before[3], before[0]]);
    expect(match.games[0].picks.red).toEqual([105, 106, 109, 116, 119]);
  });

  it("rejects pick slot swaps before all ten picks are complete", () => {
    let match = createDraft();
    match = unwrap(applyBan(match, 101));
    match = unwrap(applyBan(match, 102));
    match = unwrap(applyBan(match, 103));
    match = unwrap(applyBan(match, 104));
    match = unwrap(applyPick(match, 105));

    const result = swapPickSlots(match, "blue", 0, 1);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("game_not_complete");
    }
  });

  it("blocks picking a hero banned in the current game", () => {
    let match = createDraft();
    match = unwrap(applyBan(match, 101));
    match = unwrap(applyBan(match, 102));
    match = unwrap(applyBan(match, 103));
    match = unwrap(applyBan(match, 104));

    const result = applyPick(match, 101);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("hero_banned_current_game");
    }
  });

  it("undoes the latest ban and restores the previous BP step", () => {
    let match = createDraft();
    match = unwrap(applyBan(match, 101));

    match = unwrap(undoLastBpAction(match));

    const game = match.games[0];
    expect(game.bans.blue).toEqual([]);
    expect(game.bpStepIndex).toBe(0);
    expect(getCurrentBpStep(game)).toEqual({ side: "blue", action: "ban", count: 1 });
  });

  it("undoes the latest pick inside a multi-pick step", () => {
    let match = createDraft();
    match = unwrap(applyBan(match, 101));
    match = unwrap(applyBan(match, 102));
    match = unwrap(applyBan(match, 103));
    match = unwrap(applyBan(match, 104));
    match = unwrap(applyPick(match, 105));
    match = unwrap(applyPick(match, 106));

    match = unwrap(undoLastBpAction(match));

    const game = match.games[0];
    expect(game.picks.red).toEqual([]);
    expect(game.bpStepIndex).toBe(5);
    expect(getCurrentBpStep(game)).toEqual({ side: "red", action: "pick", count: 2 });
  });

  it("undoes the final pick after BP is complete", () => {
    let match = runLegalDraft(createDraft(), 100);

    match = unwrap(undoLastBpAction(match));

    const game = match.games[0];
    expect(game.picks.red).toEqual([105, 106, 109, 116]);
    expect(game.bpStepIndex).toBe(GLOBAL_BP_STEPS.length - 1);
    expect(getCurrentBpStep(game)).toEqual({ side: "red", action: "pick", count: 1 });
  });

  it("rejects undo when no BP action exists", () => {
    const match = createDraft();

    const result = undoLastBpAction(match);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("no_bp_action_to_undo");
    }
  });

  it("blocks both sides from picking the same hero in the same game", () => {
    let match = createDraft();
    match = unwrap(applyBan(match, 101));
    match = unwrap(applyBan(match, 102));
    match = unwrap(applyBan(match, 103));
    match = unwrap(applyBan(match, 104));
    match = unwrap(applyPick(match, 201));

    const result = applyPick(match, 201);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("hero_picked_current_game");
    }
  });

  it("blocks a team from reusing its own previous picks", () => {
    let match = createMatch({ firstSideSelectionTeam: "teamA" });
    match = completeNormalGame(match, "teamA", 100);
    match = unwrap(createGlobalBpGame(match, "teamB", "blue"));
    match = unwrap(applyBan(match, 301));
    match = unwrap(applyBan(match, 302));
    match = unwrap(applyBan(match, 303));
    match = unwrap(applyBan(match, 304));
    match = unwrap(applyPick(match, 305));

    const result = applyPick(match, 104);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("hero_used_by_same_team");
    }
  });

  it("allows a team to pick a hero previously used by the opponent", () => {
    let match = createMatch({ firstSideSelectionTeam: "teamA" });
    match = completeNormalGame(match, "teamA", 100);
    match = unwrap(createGlobalBpGame(match, "teamB", "blue"));
    match = unwrap(applyBan(match, 301));
    match = unwrap(applyBan(match, 302));
    match = unwrap(applyBan(match, 303));
    match = unwrap(applyBan(match, 304));

    const result = applyPick(match, 104);

    expect(result.ok).toBe(true);
  });

  it("allows 元流之子 role variants to be banned independently", () => {
    let match = createDraft();
    match = unwrap(applyBan(match, YUANLIUZHIZI_BP_UNITS.support.id));
    match = unwrap(applyBan(match, 102));
    match = unwrap(applyBan(match, 103));
    match = unwrap(applyBan(match, 104));

    const result = applyPick(match, YUANLIUZHIZI_BP_UNITS.tank.id);

    expect(result.ok).toBe(true);
  });

  it("blocks both sides from picking any 元流之子 role variant after either side picks one in the same game", () => {
    let match = createDraft();
    match = unwrap(applyBan(match, 101));
    match = unwrap(applyBan(match, 102));
    match = unwrap(applyBan(match, 103));
    match = unwrap(applyBan(match, 104));
    match = unwrap(applyPick(match, YUANLIUZHIZI_BP_UNITS.tank.id));

    const result = applyPick(match, YUANLIUZHIZI_BP_UNITS.mage.id);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("yuanliuzhizi_picked_current_game");
    }
  });

  it("blocks a team from picking any 元流之子 role variant after it used one in an earlier global BP game", () => {
    let match = createDraft();
    match = unwrap(applyBan(match, 101));
    match = unwrap(applyBan(match, 102));
    match = unwrap(applyBan(match, 103));
    match = unwrap(applyBan(match, 104));
    match = unwrap(applyPick(match, YUANLIUZHIZI_BP_UNITS.tank.id));
    match = runLegalDraft(match, 200);
    match = unwrap(completeGame(match, "teamA"));

    expect(match.teams.teamA.usedHeroIds).toContain(YUANLIUZHIZI_BP_UNITS.tank.id);
    expect(match.teams.teamA.usedHeroIds).not.toContain(YUANLIUZHIZI_BP_UNITS.mage.id);

    match = unwrap(createGlobalBpGame(match, "teamB", "blue"));
    match = unwrap(applyBan(match, 301));
    match = unwrap(applyBan(match, 302));
    match = unwrap(applyBan(match, 303));
    match = unwrap(applyBan(match, 304));
    match = unwrap(applyPick(match, 305));

    const result = applyPick(match, YUANLIUZHIZI_BP_UNITS.mage.id);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("yuanliuzhizi_used_by_same_team");
    }
  });

  it("does not let one team's previous 元流之子 usage block the opponent in a later game", () => {
    let match = createDraft();
    match = unwrap(applyBan(match, 101));
    match = unwrap(applyBan(match, 102));
    match = unwrap(applyBan(match, 103));
    match = unwrap(applyBan(match, 104));
    match = unwrap(applyPick(match, YUANLIUZHIZI_BP_UNITS.tank.id));
    match = runLegalDraft(match, 200);
    match = unwrap(completeGame(match, "teamA"));

    match = unwrap(createGlobalBpGame(match, "teamB", "blue"));
    match = unwrap(applyBan(match, 301));
    match = unwrap(applyBan(match, 302));
    match = unwrap(applyBan(match, 303));
    match = unwrap(applyBan(match, 304));

    const result = applyPick(match, YUANLIUZHIZI_BP_UNITS.mage.id);
    expect(result.ok).toBe(true);
  });

  it("does not add bans to a team's global used hero pool", () => {
    let match = createMatch({ firstSideSelectionTeam: "teamA" });
    match = completeNormalGame(match, "teamA", 100);

    expect(match.teams.teamA.usedHeroIds).not.toContain(100);
    expect(match.teams.teamB.usedHeroIds).not.toContain(100);

    match = unwrap(createGlobalBpGame(match, "teamB", "red"));
    match = unwrap(applyBan(match, 301));
    match = unwrap(applyBan(match, 302));
    match = unwrap(applyBan(match, 303));
    match = unwrap(applyBan(match, 304));

    const result = applyPick(match, 100);

    expect(result.ok).toBe(true);
  });

  it("updates score when a game is completed", () => {
    let match = createMatch({ firstSideSelectionTeam: "teamA" });
    match = completeNormalGame(match, "teamA", 100);

    expect(match.score).toEqual({ teamA: 1, teamB: 0 });
  });

  it("gives next-game side-selection right to the previous-game loser", () => {
    let match = createMatch({ firstSideSelectionTeam: "teamA" });
    match = completeNormalGame(match, "teamA", 100);

    expect(match.currentSideSelection).toEqual({
      gameIndex: 2,
      teamId: "teamB",
      reason: "previous_game_loser"
    });
  });

  it("ends the match when a team reaches 4 wins", () => {
    let match = createMatch({ firstSideSelectionTeam: "teamA" });
    match = completeNormalGame(match, "teamA", 100);
    match = completeNormalGame(match, "teamA", 300);
    match = completeNormalGame(match, "teamA", 500);
    match = completeNormalGame(match, "teamA", 700);

    expect(match.score).toEqual({ teamA: 4, teamB: 0 });
    expect(match.status).toBe("match_complete");
    expect(match.currentSideSelection).toBeUndefined();

    const result = createGlobalBpGame(match, "teamB", "blue");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("match_already_complete");
    }
  });

  it("creates game 7 only after the score reaches 3:3", () => {
    const earlyMatch = createMatch({ firstSideSelectionTeam: "teamA" });
    const earlyResult = createPeakDuelGame(earlyMatch);

    expect(earlyResult.ok).toBe(false);
    if (!earlyResult.ok) {
      expect(earlyResult.error.code).toBe("peak_duel_not_available");
    }

    const tiedMatch = reachThreeThree();
    expect(tiedMatch.currentSideSelection).toEqual({
      gameIndex: 7,
      teamId: "teamA",
      reason: "previous_game_loser"
    });

    const result = createPeakDuelGame(tiedMatch);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.games[6].mode).toBe("peak_duel");
      expect(result.value.currentGameIndex).toBe(7);
    }
  });

  it("Peak Duel ignores previous used hero pools", () => {
    let match = reachThreeThree();
    match = unwrap(createPeakDuelGame(match));

    const result = submitPeakDuelLineup(match, lineup("teamA", [104, 105, 106, 107, 108]));

    expect(result.ok).toBe(true);
  });

  it("Peak Duel allows both teams to select the same hero", () => {
    let match = reachThreeThree();
    match = unwrap(createPeakDuelGame(match));
    match = unwrap(submitPeakDuelLineup(match, lineup("teamA", [104, 105, 106, 107, 108])));

    const result = submitPeakDuelLineup(match, lineup("teamB", [104, 205, 206, 207, 208]));

    expect(result.ok).toBe(true);
  });

  it("Peak Duel blocks duplicate heroes inside the same team lineup", () => {
    let match = reachThreeThree();
    match = unwrap(createPeakDuelGame(match));

    const result = submitPeakDuelLineup(match, lineup("teamA", [104, 104, 106, 107, 108]));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("peak_duel_duplicate_hero");
    }
  });

  it("Peak Duel does not apply global BP 元流之子 restrictions", () => {
    let match = reachThreeThree();
    match = unwrap(createPeakDuelGame(match));

    const result = submitPeakDuelLineup(
      match,
      lineup("teamA", [
        YUANLIUZHIZI_BP_UNITS.tank.id,
        YUANLIUZHIZI_BP_UNITS.mage.id,
        106,
        107,
        108
      ])
    );

    expect(result.ok).toBe(true);
  });
});
