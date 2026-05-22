import { describe, expect, it } from "vitest";
import { createMatch, type MatchState } from "../src/domain";
import { parseMatchJson, serializeMatchState, validateMatchState } from "../src/shared/match-persistence";

describe("match persistence schema", () => {
  it("serializes and restores a complete versioned match state", () => {
    const match = createMatch({
      teamAName: "成都 AG",
      teamBName: "重庆狼队",
      firstSideSelectionTeam: "teamA"
    });

    const serialized = serializeMatchState(match);

    expect(serialized.ok).toBe(true);
    if (!serialized.ok || !serialized.json) {
      throw new Error("Expected serialized JSON");
    }

    const parsed = parseMatchJson(serialized.json);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.matchState).toEqual(match);
      expect(parsed.matchState.schemaVersion).toBe(1);
      expect(parsed.matchState.teams.teamA.name).toBe("成都 AG");
    }
  });

  it("rejects corrupt JSON with a clear Chinese error", () => {
    const parsed = parseMatchJson("{ not valid json");

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe("corrupt_json");
      expect(parsed.error.message).toContain("JSON");
    }
  });

  it("rejects unsupported future schema versions safely", () => {
    const futureMatch = {
      ...createMatch(),
      schemaVersion: 99
    };

    const parsed = validateMatchState(futureMatch);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe("unsupported_schema_version");
    }
  });

  it("rejects incomplete match files", () => {
    const incomplete: Partial<MatchState> = {
      schemaVersion: 1
    };

    const parsed = validateMatchState(incomplete);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe("invalid_match_schema");
    }
  });
});
