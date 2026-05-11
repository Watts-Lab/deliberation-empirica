import { describe, expect, it } from "vitest";
import {
  applyCommonInvariants,
  synthesizedBatchConfig,
  synthesizedBatchConfigShape,
} from "../batch-config.mjs";

const baseConfig = {
  study_id: "stu_1",
  batch_id: "bat_1",
  instance_id: "inst_1",
  batchName: "pilot-1",
  assetBaseUrl: "https://cdn.example.com/abc-token-123",
  treatmentFile: "study.stagebook.yaml",
  assetsRepoSha: "deadbeef",
  introSequence: "none",
  treatments: ["t-a"],
  payoffs: "equal",
  knockdowns: "none",
  exitCodes: "none",
  launchDate: "immediate",
  customIdInstructions: "none",
  platformConsent: "US",
  consentAddendum: "none",
  dispatchWait: 60,
  checkAudio: false,
  checkVideo: false,
  videoStorage: "none",
  debrief: "none",
};

describe("synthesizedBatchConfig", () => {
  it("accepts a minimal valid config", () => {
    const c = synthesizedBatchConfig.parse(baseConfig);
    expect(c.assetBaseUrl).toBe("https://cdn.example.com/abc-token-123");
  });

  it("rejects extra unknown keys (strict mode)", () => {
    expect(() =>
      synthesizedBatchConfig.parse({ ...baseConfig, cdn: "test" }),
    ).toThrow();
  });

  it("rejects a non-URL assetBaseUrl", () => {
    expect(() =>
      synthesizedBatchConfig.parse({
        ...baseConfig,
        assetBaseUrl: "not-a-url",
      }),
    ).toThrow();
  });

  it("rejects a treatmentFile that doesn't end in .yaml", () => {
    expect(() =>
      synthesizedBatchConfig.parse({
        ...baseConfig,
        treatmentFile: "study.json",
      }),
    ).toThrow();
  });

  it("tolerates omitted assetsRepoSha (optional in shared base; runtime stamps 'unknown')", () => {
    const { assetsRepoSha: _omit, ...rest } = baseConfig;
    expect(() => synthesizedBatchConfig.parse(rest)).not.toThrow();
  });

  it("rejects checkVideo without checkAudio", () => {
    expect(() =>
      synthesizedBatchConfig.parse({
        ...baseConfig,
        checkVideo: true,
        checkAudio: false,
      }),
    ).toThrow();
  });

  it("rejects payoffs/treatments length mismatch", () => {
    expect(() =>
      synthesizedBatchConfig.parse({
        ...baseConfig,
        treatments: ["t-a", "t-b"],
        payoffs: [1],
      }),
    ).toThrow();
  });

  it("accepts a knockdown matrix matching treatments length", () => {
    const c = synthesizedBatchConfig.parse({
      ...baseConfig,
      treatments: ["t-a", "t-b"],
      payoffs: [1, 1],
      knockdowns: [
        [0.01, 1],
        [1, 0.01],
      ],
    });
    expect(c.knockdowns).toEqual([
      [0.01, 1],
      [1, 0.01],
    ]);
  });

  it("rejects a knockdown matrix with wrong dimensions", () => {
    expect(() =>
      synthesizedBatchConfig.parse({
        ...baseConfig,
        treatments: ["t-a", "t-b"],
        payoffs: [1, 1],
        knockdowns: [[0.01, 1]],
      }),
    ).toThrow();
  });
});

describe("synthesizedBatchConfigShape", () => {
  // The shape is the same ZodObject before applyCommonInvariants is
  // composed on top. Exported so downstream consumers (e.g. the
  // manager UI campaign — manager#154) can derive sub-schemas via
  // .pick(), which Zod 4 forbids on refined objects.
  it("accepts the same minimal valid config the refined schema does", () => {
    const c = synthesizedBatchConfigShape.parse(baseConfig);
    expect(c.assetBaseUrl).toBe(baseConfig.assetBaseUrl);
  });

  it("preserves .strict() — rejects unknown keys", () => {
    expect(() =>
      synthesizedBatchConfigShape.parse({ ...baseConfig, cdn: "test" }),
    ).toThrow();
  });

  it("supports .pick() — Zod 4 allows it on the unrefined shape", () => {
    const tinyShape = synthesizedBatchConfigShape.pick({
      batchName: true,
      treatments: true,
    });
    expect(() =>
      tinyShape.parse({ batchName: "x", treatments: ["t-a"] }),
    ).not.toThrow();
  });

  it("does NOT enforce cross-field invariants — that's the role of synthesizedBatchConfig", () => {
    // Mismatched payoffs/treatments lengths is rejected by the
    // refined schema (applyCommonInvariants) but accepted by the
    // shape alone — reflecting that the shape is intentionally
    // structure-only.
    const mismatched = {
      ...baseConfig,
      treatments: ["t-a", "t-b"],
      payoffs: [1],
    };
    expect(() => synthesizedBatchConfigShape.parse(mismatched)).not.toThrow();
    expect(() => synthesizedBatchConfig.parse(mismatched)).toThrow();
  });

  it("synthesizedBatchConfig is exactly synthesizedBatchConfigShape + applyCommonInvariants", () => {
    // Equivalence: a non-trivial config that exercises the cross-field
    // invariants (payoffs array, knockdowns matrix, audio/video
    // dependency) must parse identically against both
    //   (a) synthesizedBatchConfig
    //   (b) applyCommonInvariants(synthesizedBatchConfigShape)
    // Guards against future drift if the shape and refined export
    // are ever maintained separately.
    const nontrivial = {
      ...baseConfig,
      treatments: ["t-a", "t-b"],
      payoffs: [1, 2],
      knockdowns: [
        [0.5, 1],
        [1, 0.5],
      ],
      checkAudio: true,
      checkVideo: true,
    };
    const composedAgain = applyCommonInvariants(synthesizedBatchConfigShape);
    const fromCanonical = synthesizedBatchConfig.parse(nontrivial);
    const fromRebuilt = composedAgain.parse(nontrivial);
    expect(fromRebuilt).toEqual(fromCanonical);

    // And a config that violates a cross-field invariant must be
    // rejected by both, with matching paths in the error.
    const violating = {
      ...baseConfig,
      treatments: ["t-a", "t-b"],
      payoffs: [1], // length mismatch
    };
    const canonicalIssues = synthesizedBatchConfig.safeParse(violating);
    const rebuiltIssues = composedAgain.safeParse(violating);
    expect(canonicalIssues.success).toBe(false);
    expect(rebuiltIssues.success).toBe(false);
    if (!canonicalIssues.success && !rebuiltIssues.success) {
      const canonicalPaths = canonicalIssues.error.issues
        .map((i) => i.path.join("."))
        .sort();
      const rebuiltPaths = rebuiltIssues.error.issues
        .map((i) => i.path.join("."))
        .sort();
      expect(rebuiltPaths).toEqual(canonicalPaths);
    }
  });
});
