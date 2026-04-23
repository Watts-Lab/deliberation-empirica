import { describe, test, expect } from "vitest";
import { computeKnockdownDetails, condenseBatchConfig } from "./batchConfig";

// ---------- computeKnockdownDetails ----------

describe("computeKnockdownDetails", () => {
  test("summarizes a single number", () => {
    expect(computeKnockdownDetails(0.5)).toMatchObject({
      shape: [1],
      sum: 0.5,
      max: 0.5,
      min: 0.5,
    });
  });

  test("summarizes a 1D array", () => {
    const d = computeKnockdownDetails([0.1, 0.2, 0.3]);
    expect(d.shape).toEqual([3]);
    expect(d.sum).toBeCloseTo(0.6);
    expect(d.max).toBe(0.3);
    expect(d.min).toBe(0.1);
  });

  test("summarizes a 2D matrix", () => {
    const d = computeKnockdownDetails([
      [1, 2],
      [3, 4],
    ]);
    expect(d.shape).toEqual([2, 2]);
    expect(d.sum).toBe(10);
    expect(d.max).toBe(4);
    expect(d.min).toBe(1);
  });

  test("returns null for unrecognized input types", () => {
    expect(computeKnockdownDetails(null)).toBeNull();
    expect(computeKnockdownDetails(undefined)).toBeNull();
    expect(computeKnockdownDetails({ not: "valid" })).toBeNull();
  });

  // The helper doesn't validate element types — it ships whatever JS
  // coercion produces. Pin this so the exported shape is visible and any
  // future hardening (e.g. returning null or throwing) is a deliberate
  // decision, not a silent contract change.
  test("pins current (coerced) behavior when the array contains non-numbers", () => {
    const d = computeKnockdownDetails([1, 2, "foo"]);
    expect(d.shape).toEqual([3]);
    // `1 + 2 + "foo"` coerces to the string "3foo" during reduce
    expect(d.sum).toBe("3foo");
    // derived stats then fail numeric coercion → NaN
    expect(Number.isNaN(d.std)).toBe(true);
    expect(Number.isNaN(d.max)).toBe(true);
    expect(Number.isNaN(d.min)).toBe(true);
  });

  // Ragged 2D input currently derives shape from input[0].length, which is
  // wrong when inner arrays have different lengths. Stats are still computed
  // from the flattened data. Pin this so the export shape change is visible.
  test("pins current (imperfect) handling of ragged 2D arrays", () => {
    const d = computeKnockdownDetails([
      [1, 2, 3],
      [4, 5],
    ]);
    expect(d.shape).toEqual([2, 3]); // uses input[0].length; 5 actual cells
    expect(d.sum).toBe(15);
    expect(d.max).toBe(5);
    expect(d.min).toBe(1);
  });
});

// ---------- condenseBatchConfig ----------

describe("condenseBatchConfig", () => {
  test("returns 'missing' when batchConfig is absent", () => {
    expect(condenseBatchConfig(undefined)).toBe("missing");
    expect(condenseBatchConfig(null)).toBe("missing");
  });

  test("replaces knockdowns with knockdownDetails on a cloned object", () => {
    const original = { name: "x", knockdowns: [0.5, 0.6] };
    const result = condenseBatchConfig(original);
    expect(result.knockdownDetails).toMatchObject({ shape: [2] });
    expect(result.knockdowns).toBeUndefined();
    // original must not be mutated
    expect(original.knockdowns).toEqual([0.5, 0.6]);
    expect(original.knockdownDetails).toBeUndefined();
  });

  test("leaves `knockdowns: 'none'` alone", () => {
    const result = condenseBatchConfig({ name: "x", knockdowns: "none" });
    expect(result.knockdowns).toBe("none");
    expect(result.knockdownDetails).toBeUndefined();
  });

  test("preserves other fields verbatim", () => {
    const result = condenseBatchConfig({
      name: "x",
      knockdowns: 0.9,
      extra: { nested: true },
    });
    expect(result.name).toBe("x");
    expect(result.extra).toEqual({ nested: true });
  });
});
