import { describe, it, expect } from "vitest";
import { computeProgressLabel } from "./progressLabelUtils";

describe("computeProgressLabel", () => {
  it("computes game stage labels correctly", () => {
    expect(
      computeProgressLabel({ phase: "game", index: 0, name: "practice_round" })
    ).toBe("game_0_practice_round");
  });

  it("computes intro step labels correctly", () => {
    expect(
      computeProgressLabel({ phase: "intro", index: 2, name: "instructions" })
    ).toBe("intro_2_instructions");
  });

  it("computes exit step labels correctly", () => {
    expect(
      computeProgressLabel({ phase: "exit", index: 1, name: "survey" })
    ).toBe("exit_1_survey");
  });

  it("trims whitespace from name", () => {
    expect(
      computeProgressLabel({
        phase: "game",
        index: 0,
        name: "  practice_round  ",
      })
    ).toBe("game_0_practice_round");
  });

  it("replaces spaces with underscores in name", () => {
    expect(
      computeProgressLabel({ phase: "game", index: 0, name: "practice round" })
    ).toBe("game_0_practice_round");
  });

  it("replaces multiple spaces with underscores", () => {
    expect(
      computeProgressLabel({
        phase: "game",
        index: 1,
        name: "my long stage name",
      })
    ).toBe("game_1_my_long_stage_name");
  });

  it("handles names with leading/trailing spaces and internal spaces", () => {
    expect(
      computeProgressLabel({
        phase: "intro",
        index: 0,
        name: "  welcome screen  ",
      })
    ).toBe("intro_0_welcome_screen");
  });

  it("handles numeric index values", () => {
    expect(
      computeProgressLabel({ phase: "game", index: 10, name: "final_stage" })
    ).toBe("game_10_final_stage");
  });
});
