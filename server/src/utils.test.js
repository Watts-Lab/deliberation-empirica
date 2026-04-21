import { describe, test, expect, vi } from "vitest";
import {
  toArray,
  getOpenBatches,
  selectOldestBatch,
  isArrayOfStrings,
} from "./utils";

// ---------- toArray ----------

describe("toArray", () => {
  test("returns an array unchanged", () => {
    expect(toArray([1, 2, 3])).toEqual([1, 2, 3]);
    const original = [1, 2];
    expect(toArray(original)).toBe(original); // same reference
  });

  test("wraps a non-array value in a single-element array", () => {
    expect(toArray(42)).toEqual([42]);
    expect(toArray({ a: 1 })).toEqual([{ a: 1 }]);
  });

  test("wraps a string rather than spreading its characters", () => {
    // The whole reason this is called `toArray` and not `Array.from` — we
    // don't want "abc" to become ["a", "b", "c"].
    expect(toArray("abc")).toEqual(["abc"]);
  });

  test("wraps null/undefined in a single-element array", () => {
    expect(toArray(null)).toEqual([null]);
    expect(toArray(undefined)).toEqual([undefined]);
  });
});

// ---------- getOpenBatches ----------

describe("getOpenBatches", () => {
  function makeBatch(status) {
    return { get: vi.fn((key) => (key === "status" ? status : undefined)) };
  }
  function makeCtx(entries) {
    return {
      scopesByKind: vi.fn(() => new Map(entries)),
    };
  }

  test("returns only batches whose status is 'running'", () => {
    const running = makeBatch("running");
    const created = makeBatch("created");
    const terminated = makeBatch("terminated");
    const ctx = makeCtx([
      ["id-1", running],
      ["id-2", created],
      ["id-3", terminated],
    ]);
    expect(getOpenBatches(ctx)).toEqual([running]);
    expect(ctx.scopesByKind).toHaveBeenCalledWith("batch");
  });

  test("returns empty array when no batches are running", () => {
    const ctx = makeCtx([["id-1", makeBatch("created")]]);
    expect(getOpenBatches(ctx)).toEqual([]);
  });

  test("returns empty array when no batches exist at all", () => {
    const ctx = makeCtx([]);
    expect(getOpenBatches(ctx)).toEqual([]);
  });
});

// ---------- selectOldestBatch ----------

describe("selectOldestBatch", () => {
  function makeBatch(id, createdAt) {
    return {
      id,
      get: vi.fn((key) => (key === "createdAt" ? createdAt : undefined)),
    };
  }

  test("returns the batch with the earliest createdAt", () => {
    const b1 = makeBatch("b1", "2024-01-02T00:00:00Z");
    const b2 = makeBatch("b2", "2024-01-01T00:00:00Z"); // earlier
    const b3 = makeBatch("b3", "2024-01-03T00:00:00Z");
    expect(selectOldestBatch([b1, b2, b3])).toBe(b2);
  });

  test("returns the single element when only one batch is given", () => {
    const b = makeBatch("only", "2024-01-01T00:00:00Z");
    expect(selectOldestBatch([b])).toBe(b);
  });

  test("returns undefined when input is not an array", () => {
    expect(selectOldestBatch(null)).toBeUndefined();
    expect(selectOldestBatch(undefined)).toBeUndefined();
    expect(selectOldestBatch("not an array")).toBeUndefined();
  });

  test("handles identical createdAt timestamps deterministically", () => {
    const ts = "2024-01-01T00:00:00Z";
    const b1 = makeBatch("b1", ts);
    const b2 = makeBatch("b2", ts);
    // With equal timestamps the comparison `>` returns false, so the loop
    // keeps the first-seen batch. Pin the behavior so a change is visible.
    expect(selectOldestBatch([b1, b2])).toBe(b1);
  });

  test("survives a batch whose createdAt throws", () => {
    const good = makeBatch("good", "2024-01-01T00:00:00Z");
    const bad = {
      id: "bad",
      get: vi.fn(() => {
        throw new Error("createdAt explosion");
      }),
    };
    // Should not throw; the good batch should still be chosen.
    expect(() => selectOldestBatch([good, bad])).not.toThrow();
    expect(selectOldestBatch([good, bad])).toBe(good);
  });
});

// ---------- isArrayOfStrings ----------

describe("isArrayOfStrings", () => {
  test("returns true for an array of string literals", () => {
    expect(isArrayOfStrings(["a", "b", "c"])).toBe(true);
  });

  test("returns true for an empty array (vacuously)", () => {
    expect(isArrayOfStrings([])).toBe(true);
  });

  test("returns true for an array of String objects", () => {
    /* eslint-disable-next-line no-new-wrappers */
    expect(isArrayOfStrings([new String("x"), new String("y")])).toBe(true);
  });

  test("returns false when any element is not a string", () => {
    expect(isArrayOfStrings(["a", 1])).toBe(false);
    expect(isArrayOfStrings(["a", null])).toBe(false);
    expect(isArrayOfStrings([undefined])).toBe(false);
    expect(isArrayOfStrings([["nested"]])).toBe(false);
  });

  test("returns false for non-array inputs", () => {
    expect(isArrayOfStrings("just a string")).toBe(false);
    expect(isArrayOfStrings(null)).toBe(false);
    expect(isArrayOfStrings(undefined)).toBe(false);
    expect(isArrayOfStrings({})).toBe(false);
    expect(isArrayOfStrings(42)).toBe(false);
  });
});
