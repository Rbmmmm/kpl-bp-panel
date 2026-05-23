import { getTeamForSide, type GameState, type MatchState, type TeamId } from "../domain";

export type DisplayScore = {
  leftTeamId: TeamId;
  rightTeamId: TeamId;
  leftScore: number;
  rightScore: number;
};

export function getDisplayScore(match: MatchState, game?: GameState): DisplayScore {
  const leftTeamId = game ? getTeamForSide(game, "blue") : "teamA";
  const rightTeamId = game ? getTeamForSide(game, "red") : "teamB";

  return {
    leftTeamId,
    rightTeamId,
    leftScore: match.score[leftTeamId],
    rightScore: match.score[rightTeamId]
  };
}
