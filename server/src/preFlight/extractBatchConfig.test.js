import { describe, test, expect } from "vitest";
import { extractBatchConfig } from "./extractBatchConfig.ts";

// Minimal manager-launched-shaped config. The full
// `synthesizedBatchConfig` schema requires more fields, but the
// extractor doesn't validate — it just discriminates on `study_id`
// presence and hands the result to validateBatchConfig downstream.
// Keep these fixtures lean so they don't drift if the contract
// schema evolves.
const managerLaunchedShape = {
  study_id: "s-test-1",
  instance_id: "i-test-1",
  batch_id: "b-test-1",
  batchName: "manager-launched-test",
  treatments: ["t1"],
  assetBaseUrl: "https://cdn.example.com/abc",
  assetsRepoSha: "deadbeef",
  treatmentFile: "study.treatments.yaml",
};

const soloDevWrapperShape = {
  config: {
    batchName: "solo-dev-test",
    treatments: ["t1"],
    treatmentFile: "study.treatments.yaml",
  },
  // Classic-admin bundles other UI-side fields alongside `config`.
  // The extractor must ignore them and dive into `.config`.
  someOtherField: "ignored",
  anotherField: 42,
};

describe("extractBatchConfig", () => {
  test("manager-launched shape (study_id present): returns the flat value as-is", () => {
    const result = extractBatchConfig(managerLaunchedShape);
    expect(result).toBe(managerLaunchedShape);
    // The whole object passes through, including manager-only
    // identity fields. Downstream validateBatchConfig discriminates
    // by the same sentinel and parses against synthesizedBatchConfig.
    expect(result.study_id).toBe("s-test-1");
    expect(result.instance_id).toBe("i-test-1");
    expect(result.batch_id).toBe("b-test-1");
  });

  test("solo-dev wrapper shape: returns the inner .config", () => {
    const result = extractBatchConfig(soloDevWrapperShape);
    expect(result).toBe(soloDevWrapperShape.config);
    expect(result.batchName).toBe("solo-dev-test");
    // The other wrapper fields are not visible in the result.
    expect(result.someOtherField).toBeUndefined();
  });

  test("study_id is empty string: treated as solo-dev (matches validateBatchConfig's discriminator)", () => {
    // A researcher who accidentally types `study_id: ""` on a solo
    // config should NOT be routed through the manager-launched path
    // (that would surface a confusing strict()-mode error from the
    // synthesized schema). validateBatchConfig.ts:84 picks the
    // soloDev schema in this case for the same reason.
    const wrapped = {
      config: { batchName: "x", study_id: "" },
    };
    const result = extractBatchConfig(wrapped);
    expect(result).toBe(wrapped.config);
  });

  test("study_id is null: treated as solo-dev", () => {
    const wrapped = {
      config: { batchName: "x" },
      study_id: null,
    };
    const result = extractBatchConfig(wrapped);
    expect(result).toBe(wrapped.config);
  });

  test("study_id at top of WRAPPER (not the config) is honored as manager-launched", () => {
    // Defensive: a manager-launched flat config can include a `config`
    // field of its own (e.g., the batch-config schema may have nested
    // optional fields named `config` in the future). Top-level
    // study_id wins — we don't dive into `.config` if the top-level
    // already looks manager-shaped.
    const flat = {
      study_id: "s-1",
      batchName: "manager",
      config: { surprise: "this should not be returned" },
    };
    const result = extractBatchConfig(flat);
    expect(result).toBe(flat);
    expect(result.study_id).toBe("s-1");
  });

  test("undefined input: returns undefined (let validator surface 'Required')", () => {
    // If the runtime ever calls `batch.get(\"config\")` before the
    // attribute is set, we want a clear downstream Zod error from
    // validateBatchConfig (\"Required\") rather than a TypeError
    // exploding inside the destructure. Also exercised by callbacks.js
    // when the batch attribute genuinely hasn't been written yet.
    expect(extractBatchConfig(undefined)).toBeUndefined();
  });

  test("null input: returns undefined (let validator surface 'Required')", () => {
    expect(extractBatchConfig(null)).toBeUndefined();
  });

  test("primitive input: returns undefined (no crash)", () => {
    // Empirica attributes are always JSON-serialized; the value here
    // would be the parsed result. Defensive against an upstream
    // serializer regression that produced a string or number.
    expect(extractBatchConfig("not an object")).toBeUndefined();
    expect(extractBatchConfig(42)).toBeUndefined();
    expect(extractBatchConfig(true)).toBeUndefined();
  });
});
