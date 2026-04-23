import { describe, test, expect, vi } from "vitest";
import { collectExportErrors } from "./exportErrors";

function makePlayer(attrs = {}) {
  return { get: vi.fn((k) => attrs[k]) };
}
function makeBatch({ id = "b1" } = {}) {
  return { id };
}
function makeGame({ id = "g1" } = {}) {
  return { id };
}

describe("collectExportErrors", () => {
  test("returns empty array when IDs match", () => {
    const player = makePlayer({ batchId: "b1", gameId: "g1" });
    expect(
      collectExportErrors({
        player,
        batch: makeBatch({ id: "b1" }),
        game: makeGame({ id: "g1" }),
      })
    ).toEqual([]);
  });

  test("reports a batch-ID mismatch", () => {
    const player = makePlayer({ batchId: "expected", gameId: "g1" });
    const errors = collectExportErrors({
      player,
      batch: makeBatch({ id: "actual" }),
      game: makeGame({ id: "g1" }),
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Batch ID: actual.*expected/);
  });

  test("reports a game-ID mismatch", () => {
    const player = makePlayer({ batchId: "b1", gameId: "expected" });
    const errors = collectExportErrors({
      player,
      batch: makeBatch({ id: "b1" }),
      game: makeGame({ id: "actual" }),
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Game ID actual.*expected/);
  });

  test("reports both batch- and game-ID mismatches in one call", () => {
    const player = makePlayer({
      batchId: "expectedBatch",
      gameId: "expectedGame",
    });
    const errors = collectExportErrors({
      player,
      batch: makeBatch({ id: "actualBatch" }),
      game: makeGame({ id: "actualGame" }),
    });
    expect(errors).toHaveLength(2);
    expect(errors.some((e) => /Batch ID/.test(e))).toBe(true);
    expect(errors.some((e) => /Game ID/.test(e))).toBe(true);
  });
});
