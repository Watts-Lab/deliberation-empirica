import { describe, expect, it } from "vitest";
import { synthesizedBatchConfig } from "../batch-config.mjs";

const baseConfig = {
  study_id: "stu_1",
  batch_id: "bat_1",
  instance_id: "inst_1",
  batchName: "pilot-1",
  assetBaseUrl: "https://cdn.example.com/abc-token-123",
  treatmentFile: "study.treatments.yaml",
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
