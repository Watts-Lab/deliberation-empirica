import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock the CDN provider so getTreatments/getText never hits the network.
// Tests register fixture content via the `__setMockCdn` helper below.
const cdnFixture = { treatments: new Map(), prompts: new Map() };
vi.mock("./providers/cdn", () => ({
  getText: vi.fn(async ({ path }) => {
    if (cdnFixture.treatments.has(path)) return cdnFixture.treatments.get(path);
    if (cdnFixture.prompts.has(path)) return cdnFixture.prompts.get(path);
    throw new Error(`[mock cdn] no fixture registered for path: ${path}`);
  }),
}));

// Mock the GitHub provider — getAssetsRepoSha uses it but no test below
// exercises that path.
vi.mock("./providers/github", () => ({
  getRepoHeadSha: vi.fn(
    async () => "mocksha0000000000000000000000000000000000",
  ),
}));

// Imported AFTER vi.mock so the module picks up the mocked deps.
// eslint-disable-next-line import/first
import {
  joinRelativeToDir,
  validatePromptString,
  getTreatments,
} from "./getTreatments";

const validPrompt = `---
type: multipleChoice
---

Which sounds best?

---

- Option A
- Option B
`;

const validOpenResponse = `---
type: openResponse
---

Write about your day.

---

> placeholder
`;

const validNoResponse = `---
type: noResponse
---

Static informational content with no input.

---
`;

describe("joinRelativeToDir (pure path-joining helper)", () => {
  test("joins a simple filename with a directory", () => {
    expect(joinRelativeToDir("projects/example", "prompt.md")).toBe(
      "projects/example/prompt.md",
    );
  });

  test("joins a nested subpath", () => {
    expect(
      joinRelativeToDir("demo/annotated_demo", "intro/describe.prompt.md"),
    ).toBe("demo/annotated_demo/intro/describe.prompt.md");
  });

  test("returns the path unchanged when dir is empty", () => {
    expect(joinRelativeToDir("", "prompt.md")).toBe("prompt.md");
  });

  test("returns the path unchanged when dir is null/undefined", () => {
    expect(joinRelativeToDir(undefined, "prompt.md")).toBe("prompt.md");
    expect(joinRelativeToDir(null, "prompt.md")).toBe("prompt.md");
  });

  test("collapses `.` segments", () => {
    expect(joinRelativeToDir("projects/example", "./prompt.md")).toBe(
      "projects/example/prompt.md",
    );
    expect(joinRelativeToDir("projects/./example", "prompt.md")).toBe(
      "projects/example/prompt.md",
    );
  });

  test("collapses `..` segments walking up one level", () => {
    expect(
      joinRelativeToDir("projects/example", "../../shared/asset.png"),
    ).toBe("shared/asset.png");
  });

  test("collapses `..` to climb into sibling directories", () => {
    expect(joinRelativeToDir("projects/example", "../other/prompt.md")).toBe(
      "projects/other/prompt.md",
    );
  });

  test("collapses multiple consecutive `..` segments", () => {
    expect(joinRelativeToDir("a/b/c", "../../x")).toBe("a/x");
  });

  test("collapses empty segments caused by double slashes", () => {
    expect(joinRelativeToDir("projects//example", "prompt.md")).toBe(
      "projects/example/prompt.md",
    );
    expect(joinRelativeToDir("projects/example", "foo//bar")).toBe(
      "projects/example/foo/bar",
    );
  });

  test("silently ignores `..` that would escape the root", () => {
    // popping past the start is a no-op; matches the adapter's behavior
    expect(joinRelativeToDir("a", "../../../x")).toBe("x");
    expect(joinRelativeToDir("", "../../x")).toBe("x");
  });

  test("handles paths that are pure `..` chains", () => {
    expect(joinRelativeToDir("a/b", "..")).toBe("a");
    expect(joinRelativeToDir("a/b", "../..")).toBe("");
  });

  test("preserves filenames containing dots", () => {
    expect(
      joinRelativeToDir("projects/example", "multipleChoice.prompt.md"),
    ).toBe("projects/example/multipleChoice.prompt.md");
  });

  test("handles an empty path gracefully", () => {
    expect(joinRelativeToDir("projects/example", "")).toBe("projects/example");
  });

  test("handles a null/undefined path gracefully", () => {
    expect(joinRelativeToDir("projects/example", null)).toBe("");
    expect(joinRelativeToDir("projects/example", undefined)).toBe("");
  });
});

describe("validatePromptString (delegates to stagebook promptFileSchema)", () => {
  test("accepts a valid multipleChoice prompt", () => {
    expect(() =>
      validatePromptString({
        filename: "x.prompt.md",
        promptString: validPrompt,
      }),
    ).not.toThrow();
  });

  test("accepts a valid openResponse prompt", () => {
    expect(() =>
      validatePromptString({
        filename: "x.prompt.md",
        promptString: validOpenResponse,
      }),
    ).not.toThrow();
  });

  test("accepts a valid noResponse prompt", () => {
    expect(() =>
      validatePromptString({
        filename: "x.prompt.md",
        promptString: validNoResponse,
      }),
    ).not.toThrow();
  });

  test("throws when the prompt string is empty", () => {
    expect(() =>
      validatePromptString({ filename: "empty.prompt.md", promptString: "" }),
    ).toThrow(/Invalid prompt file empty\.prompt\.md/);
  });

  test("throws when the type is invalid", () => {
    const bad = `---
type: madeUpType
---

Body

---

- x
`;
    expect(() =>
      validatePromptString({ filename: "bad.prompt.md", promptString: bad }),
    ).toThrow(/Invalid prompt file bad\.prompt\.md/);
  });

  test("throws when the file is missing the --- section delimiters", () => {
    const malformed = "No delimiters at all, just some text.";
    expect(() =>
      validatePromptString({
        filename: "malformed.prompt.md",
        promptString: malformed,
      }),
    ).toThrow(/Invalid prompt file malformed\.prompt\.md/);
  });

  test("includes the filename in the error message", () => {
    const bad = `---
type: nope
---

Body

---

- x
`;
    expect(() =>
      validatePromptString({
        filename: "projects/example/bad.prompt.md",
        promptString: bad,
      }),
    ).toThrow(/projects\/example\/bad\.prompt\.md/);
  });
});

describe("getTreatments (pipeline)", () => {
  beforeEach(() => {
    cdnFixture.treatments.clear();
    cdnFixture.prompts.clear();
  });

  // Minimal helper that fakes a prompt file content
  const fakePromptFile = (type = "multipleChoice") => {
    const body =
      type === "noResponse"
        ? `---\ntype: noResponse\n---\n\nBody.\n\n---\n`
        : `---\ntype: ${type}\n---\n\nBody.\n\n---\n\n- A\n- B\n`;
    return body;
  };

  test("returns all treatments when treatmentNames is empty", async () => {
    cdnFixture.treatments.set(
      "proj/cypress.treatments.yaml",
      `
treatments:
  - name: t1
    playerCount: 1
    gameStages:
      - name: stage1
        duration: 10
        elements:
          - type: submitButton
  - name: t2
    playerCount: 2
    gameStages:
      - name: stage1
        duration: 10
        elements:
          - type: submitButton
`,
    );

    const { treatmentsAvailable, introSequence } = await getTreatments({
      cdn: "prod",
      path: "proj/cypress.treatments.yaml",
      treatmentNames: [],
      introSequenceName: "none",
    });

    expect(introSequence).toBeUndefined();
    expect(treatmentsAvailable.map((t) => t.name)).toEqual(["t1", "t2"]);
  });

  test("filters to just the requested treatment names and validates them", async () => {
    cdnFixture.treatments.set(
      "proj/cypress.treatments.yaml",
      `
treatments:
  - name: t1
    playerCount: 1
    gameStages:
      - name: s
        duration: 10
        elements:
          - type: submitButton
  - name: t2
    playerCount: 1
    gameStages:
      - name: s
        duration: 10
        elements:
          - type: submitButton
`,
    );

    const { treatments } = await getTreatments({
      cdn: "prod",
      path: "proj/cypress.treatments.yaml",
      treatmentNames: ["t2"],
      introSequenceName: "none",
    });

    expect(treatments).toHaveLength(1);
    expect(treatments[0].name).toBe("t2");
  });

  test("throws when a requested treatment name is not in the file", async () => {
    cdnFixture.treatments.set(
      "proj/cypress.treatments.yaml",
      `
treatments:
  - name: t1
    playerCount: 1
    gameStages:
      - name: s
        duration: 10
        elements:
          - type: submitButton
`,
    );

    await expect(
      getTreatments({
        cdn: "prod",
        path: "proj/cypress.treatments.yaml",
        treatmentNames: ["does_not_exist"],
        introSequenceName: "none",
      }),
    ).rejects.toThrow(/does_not_exist not found/);
  });

  test("returns the named intro sequence", async () => {
    cdnFixture.treatments.set(
      "proj/cypress.treatments.yaml",
      `
introSequences:
  - name: intro_a
    introSteps:
      - name: step1
        elements:
          - type: submitButton
  - name: intro_b
    introSteps:
      - name: step1
        elements:
          - type: submitButton
treatments:
  - name: t1
    playerCount: 1
    gameStages:
      - name: s
        duration: 10
        elements:
          - type: submitButton
`,
    );

    const { introSequence } = await getTreatments({
      cdn: "prod",
      path: "proj/cypress.treatments.yaml",
      treatmentNames: [],
      introSequenceName: "intro_b",
    });

    expect(introSequence.name).toBe("intro_b");
  });

  test("throws when the requested intro sequence is missing", async () => {
    cdnFixture.treatments.set(
      "proj/cypress.treatments.yaml",
      `
introSequences:
  - name: intro_a
    introSteps:
      - name: step1
        elements:
          - type: submitButton
treatments:
  - name: t1
    playerCount: 1
    gameStages:
      - name: s
        duration: 10
        elements:
          - type: submitButton
`,
    );

    await expect(
      getTreatments({
        cdn: "prod",
        path: "proj/cypress.treatments.yaml",
        treatmentNames: [],
        introSequenceName: "intro_missing",
      }),
    ).rejects.toThrow(/intro_missing not found/);
  });

  test("rejects a treatment that fails stagebook's treatmentSchema", async () => {
    // playerCount is required by treatmentSchema; omit it so validation fails.
    cdnFixture.treatments.set(
      "proj/cypress.treatments.yaml",
      `
treatments:
  - name: bad
    gameStages:
      - name: s
        duration: 10
        elements:
          - type: submitButton
`,
    );

    await expect(
      getTreatments({
        cdn: "prod",
        path: "proj/cypress.treatments.yaml",
        treatmentNames: [],
        introSequenceName: "none",
      }),
    ).rejects.toThrow(/Invalid treatment/);
  });

  test("hydrates shorthand prompt and fetches it relative to the treatment file", async () => {
    const cdnModule = await import("./providers/cdn");
    cdnFixture.treatments.set(
      "proj/example/cypress.treatments.yaml",
      `
treatments:
  - name: t1
    playerCount: 1
    gameStages:
      - name: s
        duration: 10
        elements:
          - hello.prompt.md
          - type: submitButton
`,
    );
    cdnFixture.prompts.set("proj/example/hello.prompt.md", fakePromptFile());

    const { treatments } = await getTreatments({
      cdn: "prod",
      path: "proj/example/cypress.treatments.yaml",
      treatmentNames: ["t1"],
      introSequenceName: "none",
    });

    expect(treatments[0].gameStages[0].elements[0]).toMatchObject({
      type: "prompt",
      file: "hello.prompt.md",
      name: "hello.prompt.md",
    });
    // Verify getText was called with the resolved (relative-to-treatment) path.
    const calledPaths = cdnModule.getText.mock.calls.map((c) => c[0].path);
    expect(calledPaths).toContain("proj/example/hello.prompt.md");
  });

  test("resolves `..` segments in prompt file paths relative to the treatment file", async () => {
    const cdnModule = await import("./providers/cdn");
    cdnModule.getText.mockClear();
    cdnFixture.treatments.set(
      "a/b/c/study.treatments.yaml",
      `
treatments:
  - name: t1
    playerCount: 1
    gameStages:
      - name: s
        duration: 10
        elements:
          - type: prompt
            file: ../shared/hello.prompt.md
          - type: submitButton
`,
    );
    cdnFixture.prompts.set("a/b/shared/hello.prompt.md", fakePromptFile());

    await getTreatments({
      cdn: "prod",
      path: "a/b/c/study.treatments.yaml",
      treatmentNames: ["t1"],
      introSequenceName: "none",
    });

    const calledPaths = cdnModule.getText.mock.calls.map((c) => c[0].path);
    expect(calledPaths).toContain("a/b/shared/hello.prompt.md");
  });

  test("throws when a prompt element's hideTime exceeds the stage duration", async () => {
    cdnFixture.treatments.set(
      "proj/example/cypress.treatments.yaml",
      `
treatments:
  - name: t1
    playerCount: 1
    gameStages:
      - name: s
        duration: 5
        elements:
          - type: prompt
            file: hello.prompt.md
            hideTime: 999
          - type: submitButton
`,
    );
    cdnFixture.prompts.set("proj/example/hello.prompt.md", fakePromptFile());

    // Either stagebook's schema or our runtime prompt-fetch check can catch
    // this; both are valid points of failure. Assert it's rejected either way.
    await expect(
      getTreatments({
        cdn: "prod",
        path: "proj/example/cypress.treatments.yaml",
        treatmentNames: ["t1"],
        introSequenceName: "none",
      }),
    ).rejects.toThrow(/Invalid treatment|Failed to validate treatment/);
  });

  test("throws when a prompt file cannot be parsed by stagebook", async () => {
    cdnFixture.treatments.set(
      "proj/example/cypress.treatments.yaml",
      `
treatments:
  - name: t1
    playerCount: 1
    gameStages:
      - name: s
        duration: 10
        elements:
          - type: prompt
            file: broken.prompt.md
          - type: submitButton
`,
    );
    cdnFixture.prompts.set(
      "proj/example/broken.prompt.md",
      "this prompt has no YAML frontmatter or sections",
    );

    await expect(
      getTreatments({
        cdn: "prod",
        path: "proj/example/cypress.treatments.yaml",
        treatmentNames: ["t1"],
        introSequenceName: "none",
      }),
    ).rejects.toThrow(/Failed to validate treatment t1/);
  });
});

// ---------------------------------------------------------------------------
// Template expansion — covers the wiring between getTreatments and
// stagebook's fillTemplates. Replaces structural coverage that cypress
// 14_Templates.js carried end-to-end. Stagebook owns the expansion
// correctness tests; these assertions only verify our pipeline hands the
// YAML to fillTemplates and feeds the result through treatmentSchema.
// ---------------------------------------------------------------------------
describe("getTreatments template expansion (stagebook integration)", () => {
  beforeEach(() => {
    cdnFixture.treatments.clear();
    cdnFixture.prompts.clear();
  });

  const fakePromptFile = (type = "multipleChoice") =>
    `---\ntype: ${type}\n---\n\nBody.\n\n---\n\n- A\n- B\n`;

  // Same shape as cypress/fixtures/mockCDN/projects/example/templates.treatments.yaml.
  // Produces 6 treatments (3 d0 × 2 d1) whose names interpolate both axes.
  const templatesYaml = `
templates:
  - templateName: treatmentTemplate
    templateDesc: replaces an entire treatment
    templateContent:
      name: \${name}
      playerCount: 2
      groupComposition:
        - position: 0
          title: "\${name} p0"
          conditions:
            - reference: prompt.introMultipleChoiceWizards
              comparator: isOneOf
              value: \${p0_introMultipleChoiceWizardsValues}
        - position: 1
          title: "\${name} p1"
          conditions:
            - reference: prompt.introMultipleChoiceWizards
              comparator: equals
              value: \${p1_introMultipleChoiceWizardsValue}
      gameStages:
        - name: "Outer stage"
          duration: 300
          elements:
            - type: prompt
              name: outerPrompt
              file: hello.prompt.md
            - type: submitButton

treatments:
  - template: treatmentTemplate
    fields:
      name: "t_d0_\${d0}_d1_\${d1}"
    broadcast:
      d0:
        - p1_introMultipleChoiceWizardsValue: Dr. Strange
        - p1_introMultipleChoiceWizardsValue: Albus Dumbledore
        - p1_introMultipleChoiceWizardsValue: Merlin
      d1:
        - p0_introMultipleChoiceWizardsValues: [Gandalf, Eskarina Smith]
        - p0_introMultipleChoiceWizardsValues: [Harry Dresden, Harry Potter]
`;

  test("expands d0/d1 broadcast axes into a cartesian set of named treatments", async () => {
    cdnFixture.treatments.set("proj/templates.treatments.yaml", templatesYaml);
    cdnFixture.prompts.set("proj/hello.prompt.md", fakePromptFile());

    const { treatmentsAvailable } = await getTreatments({
      cdn: "prod",
      path: "proj/templates.treatments.yaml",
      treatmentNames: [],
      introSequenceName: "none",
    });

    // 3 d0 × 2 d1 = 6 treatments, all with interpolated names.
    const names = treatmentsAvailable.map((t) => t.name).sort();
    expect(names).toEqual([
      "t_d0_0_d1_0",
      "t_d0_0_d1_1",
      "t_d0_1_d1_0",
      "t_d0_1_d1_1",
      "t_d0_2_d1_0",
      "t_d0_2_d1_1",
    ]);
  });

  test("substitutes group-composition condition values from broadcast axes", async () => {
    cdnFixture.treatments.set("proj/templates.treatments.yaml", templatesYaml);
    cdnFixture.prompts.set("proj/hello.prompt.md", fakePromptFile());

    const { treatmentsAvailable } = await getTreatments({
      cdn: "prod",
      path: "proj/templates.treatments.yaml",
      treatmentNames: [],
      introSequenceName: "none",
    });

    // Pick the same treatment cypress 14 asserts on: d0=2 (Merlin), d1=0
    // (Gandalf/Eskarina). Both axes must resolve inside the conditions array.
    const target = treatmentsAvailable.find((t) => t.name === "t_d0_2_d1_0");
    expect(target, "t_d0_2_d1_0 should exist after expansion").toBeDefined();

    const p0Condition = target.groupComposition[0].conditions[0];
    const p1Condition = target.groupComposition[1].conditions[0];

    expect(p0Condition.reference).toBe("prompt.introMultipleChoiceWizards");
    expect(p0Condition.comparator).toBe("isOneOf");
    expect(p0Condition.value).toEqual(["Gandalf", "Eskarina Smith"]);

    expect(p1Condition.reference).toBe("prompt.introMultipleChoiceWizards");
    expect(p1Condition.comparator).toBe("equals");
    expect(p1Condition.value).toBe("Merlin");
  });

  test("named treatment from template pipeline passes validateTreatment end-to-end", async () => {
    cdnFixture.treatments.set("proj/templates.treatments.yaml", templatesYaml);
    cdnFixture.prompts.set("proj/hello.prompt.md", fakePromptFile());

    const { treatments } = await getTreatments({
      cdn: "prod",
      path: "proj/templates.treatments.yaml",
      treatmentNames: ["t_d0_2_d1_0"],
      introSequenceName: "none",
    });

    expect(treatments).toHaveLength(1);
    expect(treatments[0].name).toBe("t_d0_2_d1_0");
    expect(treatments[0].playerCount).toBe(2);
    // The outer gameStage prompt should have been resolved & hydrated.
    expect(treatments[0].gameStages[0].elements[0]).toMatchObject({
      type: "prompt",
      file: "hello.prompt.md",
      name: "outerPrompt",
    });
  });
});
