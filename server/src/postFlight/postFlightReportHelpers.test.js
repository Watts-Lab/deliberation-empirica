import { describe, test, expect } from "vitest";
import {
  valueCounts,
  valuePercentages,
  summarizeNumericArray,
  sumFieldAcross,
  filterFreeTextResponses,
} from "./postFlightReportHelpers";

// ---------- valueCounts ----------

describe("valueCounts", () => {
  test("counts string occurrences", () => {
    expect(valueCounts(["a", "b", "a", "c", "a"])).toEqual({
      a: 3,
      b: 1,
      c: 1,
    });
  });

  test("counts numeric occurrences (values become stringified keys)", () => {
    expect(valueCounts([1, 2, 1, 1, 3])).toEqual({ 1: 3, 2: 1, 3: 1 });
  });

  test("returns empty object for an empty array", () => {
    expect(valueCounts([])).toEqual({});
  });

  test("counts boolean occurrences", () => {
    expect(valueCounts([true, false, true, true])).toEqual({
      true: 3,
      false: 1,
    });
  });
});

// ---------- valuePercentages ----------

describe("valuePercentages", () => {
  test("returns fractions that sum to 1 for non-empty input", () => {
    const pct = valuePercentages(["a", "b", "a", "b"]);
    expect(pct).toEqual({ a: 0.5, b: 0.5 });
    expect(Object.values(pct).reduce((acc, v) => acc + v, 0)).toBeCloseTo(1);
  });

  test("handles singleton values", () => {
    expect(valuePercentages(["x"])).toEqual({ x: 1 });
  });

  test("returns empty object for an empty array (no NaN)", () => {
    expect(valuePercentages([])).toEqual({});
  });
});

// ---------- summarizeNumericArray (median-bug regression guard) ----------

describe("summarizeNumericArray", () => {
  test("returns max/min/mean/median for a simple array", () => {
    expect(summarizeNumericArray([1, 2, 3])).toEqual({
      max: 3,
      min: 1,
      mean: 2,
      median: 2,
    });
  });

  test("computes median with numeric sort (regression: default sort is lexical)", () => {
    // Default Array.sort() sorts as strings: [1, 2, 10] → ["1", "10", "2"]
    // which would pick "10" at index 1 as median. Correct median is 2.
    const result = summarizeNumericArray([1, 2, 10]);
    expect(result.median).toBe(2);
    expect(result.max).toBe(10);
    expect(result.min).toBe(1);
  });

  test("computes median as midpoint average for even-length arrays", () => {
    expect(summarizeNumericArray([1, 2, 3, 4]).median).toBe(2.5);
    expect(summarizeNumericArray([10, 100, 1000, 10000]).median).toBe(550);
  });

  test("returns null sentinels for empty / null / undefined input", () => {
    const expected = { max: null, min: null, mean: null, median: null };
    expect(summarizeNumericArray([])).toEqual(expected);
    expect(summarizeNumericArray(null)).toEqual(expected);
    expect(summarizeNumericArray(undefined)).toEqual(expected);
  });

  test("ignores non-finite entries (NaN, Infinity, strings)", () => {
    expect(
      summarizeNumericArray([1, 2, NaN, 3, Infinity, -Infinity, "x"])
    ).toEqual({
      max: 3,
      min: 1,
      mean: 2,
      median: 2,
    });
  });

  test("returns null sentinels when all entries are non-finite", () => {
    expect(summarizeNumericArray([NaN, Infinity, "x"])).toEqual({
      max: null,
      min: null,
      mean: null,
      median: null,
    });
  });

  test("handles a single-element array", () => {
    expect(summarizeNumericArray([42])).toEqual({
      max: 42,
      min: 42,
      mean: 42,
      median: 42,
    });
  });

  test("does not mutate the input array", () => {
    const input = [3, 1, 2];
    summarizeNumericArray(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

// ---------- sumFieldAcross ----------

describe("sumFieldAcross", () => {
  test("sums a field across summaries", () => {
    const summaries = [
      { max: 5, mean: 3 },
      { max: 10, mean: 7 },
      { max: 2, mean: 1 },
    ];
    expect(sumFieldAcross(summaries, "max")).toBe(17);
    expect(sumFieldAcross(summaries, "mean")).toBe(11);
  });

  test("treats null as 0 (so one missing phase doesn't poison the sum)", () => {
    const summaries = [{ max: 5 }, { max: null }, { max: 10 }];
    expect(sumFieldAcross(summaries, "max")).toBe(15);
  });

  test("treats undefined as 0", () => {
    expect(sumFieldAcross([{ max: 1 }, {}, { max: 3 }], "max")).toBe(4);
  });

  test("returns 0 for an empty array", () => {
    expect(sumFieldAcross([], "anything")).toBe(0);
  });
});

// ---------- filterFreeTextResponses ----------

describe("filterFreeTextResponses", () => {
  test("drops common 'no response' values (case-insensitive, trimmed)", () => {
    expect(
      filterFreeTextResponses([
        "no",
        "No",
        "  NONE  ",
        "nothing",
        "nan",
        "NaN",
      ])
    ).toEqual([]);
  });

  test("keeps meaningful responses unchanged", () => {
    expect(
      filterFreeTextResponses([
        "The audio cut out",
        "No issues to report", // has content beyond "no"
      ])
    ).toEqual(["The audio cut out", "No issues to report"]);
  });

  test("drops undefined, null, empty strings", () => {
    expect(filterFreeTextResponses([undefined, null, "", "  "])).toEqual([]);
  });

  test("returns empty array for empty / null input", () => {
    expect(filterFreeTextResponses([])).toEqual([]);
    expect(filterFreeTextResponses(null)).toEqual([]);
    expect(filterFreeTextResponses(undefined)).toEqual([]);
  });

  test("handles a mix of kept / dropped responses", () => {
    expect(
      filterFreeTextResponses([
        "no",
        "valid answer",
        undefined,
        "another valid one",
        "  none  ",
      ])
    ).toEqual(["valid answer", "another valid one"]);
  });
});
