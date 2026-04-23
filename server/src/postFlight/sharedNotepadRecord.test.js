import { describe, test, expect, vi } from "vitest";
import {
  findPromptElement,
  buildSharedNotepadRecord,
} from "./sharedNotepadRecord";

// ---------- findPromptElement ----------

describe("findPromptElement", () => {
  test("finds a prompt element by name within gameStages", () => {
    const treatment = {
      gameStages: [
        {
          elements: [
            { type: "prompt", name: "intro", file: "intro.prompt.md" },
            { type: "submitButton" },
          ],
        },
        {
          elements: [
            { type: "prompt", name: "notepad", file: "openResponse.prompt.md" },
          ],
        },
      ],
    };
    expect(findPromptElement({ treatment, padName: "notepad" })).toEqual({
      type: "prompt",
      name: "notepad",
      file: "openResponse.prompt.md",
    });
  });

  test("returns undefined when no matching element exists", () => {
    const treatment = {
      gameStages: [{ elements: [{ type: "prompt", name: "other" }] }],
    };
    expect(
      findPromptElement({ treatment, padName: "missing" }),
    ).toBeUndefined();
  });

  test("ignores non-prompt elements with the matching name", () => {
    const treatment = {
      gameStages: [
        { elements: [{ type: "display", name: "notepad" }] },
        { elements: [{ type: "prompt", name: "notepad", file: "p.md" }] },
      ],
    };
    expect(findPromptElement({ treatment, padName: "notepad" })).toEqual({
      type: "prompt",
      name: "notepad",
      file: "p.md",
    });
  });

  test("tolerates missing treatment / gameStages / elements", () => {
    expect(
      findPromptElement({ treatment: undefined, padName: "x" }),
    ).toBeUndefined();
    expect(findPromptElement({ treatment: {}, padName: "x" })).toBeUndefined();
    expect(
      findPromptElement({ treatment: { gameStages: [{}] }, padName: "x" }),
    ).toBeUndefined();
  });
});

// ---------- buildSharedNotepadRecord ----------

describe("buildSharedNotepadRecord (stagebook-compatible shape)", () => {
  const treatment = {
    gameStages: [
      {
        elements: [
          {
            type: "prompt",
            name: "etherpadTest",
            file: "openResponse.prompt.md",
            shared: true,
          },
        ],
      },
    ],
  };

  const game = {
    get: vi.fn((k) => (k === "treatment" ? treatment : undefined)),
  };

  const fetchPromptFile = vi.fn().mockResolvedValue("PROMPT_STRING");
  const parsePromptFile = vi.fn().mockReturnValue({
    metadata: { type: "openResponse", rows: 5 },
    body: "Write a response",
    responseItems: ["default answer"],
  });

  test("produces the full stagebook prompt record shape", async () => {
    const record = await buildSharedNotepadRecord({
      game,
      padName: "etherpadTest",
      progressLabel: "game_1_Etherpad Test",
      stageTimeElapsed: 42.5,
      text: "Final Etherpad text",
      cdn: "prod",
      fetchPromptFile,
      parsePromptFile,
    });
    expect(record).toEqual({
      type: "openResponse",
      rows: 5,
      name: "etherpadTest",
      file: "openResponse.prompt.md",
      shared: true,
      prompt: "Write a response",
      responses: ["default answer"],
      debugMessages: [],
      value: "Final Etherpad text",
      step: "game_1_Etherpad Test",
      stageTimeElapsed: 42.5,
    });
    expect(fetchPromptFile).toHaveBeenCalledWith({
      cdn: "prod",
      path: "openResponse.prompt.md",
    });
    expect(parsePromptFile).toHaveBeenCalledWith("PROMPT_STRING");
  });

  test("throws a clear error when the pad name doesn't match any element", async () => {
    await expect(
      buildSharedNotepadRecord({
        game,
        padName: "missingPad",
        progressLabel: "x",
        stageTimeElapsed: 0,
        text: "",
        cdn: "prod",
        fetchPromptFile,
        parsePromptFile,
      }),
    ).rejects.toThrow(/No prompt element named "missingPad"/);
  });

  test("propagates fetchPromptFile errors", async () => {
    const failingFetch = vi.fn().mockRejectedValue(new Error("CDN down"));
    await expect(
      buildSharedNotepadRecord({
        game,
        padName: "etherpadTest",
        progressLabel: "x",
        stageTimeElapsed: 0,
        text: "",
        cdn: "prod",
        fetchPromptFile: failingFetch,
        parsePromptFile,
      }),
    ).rejects.toThrow("CDN down");
  });
});
