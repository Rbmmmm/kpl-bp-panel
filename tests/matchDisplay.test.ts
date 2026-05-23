import { describe, expect, it } from "vitest";
import { applyBan, applyPick, completeGame, createGlobalBpGame, createMatch, getCurrentBpStep, type MatchState } from "../src/domain";
import { getDisplayScore } from "../src/renderer/matchDisplay";

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }

  return result.value;
}

function runLegalDraft(match: MatchState, startHeroId: number): MatchState {
  let state = match;
  let nextHeroId = startHeroId;
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

describe("match display helpers", () => {
  it("displays the active game score in blue/red side order", () => {
    let match = createMatch({
      teamAName: "重庆狼队",
      teamBName: "成都AG超玩会",
      firstSideSelectionTeam: "teamA"
    });

    match = unwrap(createGlobalBpGame(match, "teamA", "blue"));
    match = runLegalDraft(match, 100);
    match = unwrap(completeGame(match, "teamB"));

    const game = match.games[match.currentGameIndex - 1];

    expect(getDisplayScore(match, game)).toEqual({
      leftTeamId: "teamA",
      rightTeamId: "teamB",
      leftScore: 0,
      rightScore: 1
    });
  });

  it("uses team A/B order before a game is created", () => {
    const match = createMatch();

    expect(getDisplayScore(match)).toMatchObject({
      leftTeamId: "teamA",
      rightTeamId: "teamB",
      leftScore: 0,
      rightScore: 0
    });
  });
});
