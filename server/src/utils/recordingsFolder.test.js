import { describe, test, expect } from "vitest";
import { makeRecordingsFolder } from "./recordingsFolder";

describe("makeRecordingsFolder", () => {
  test("concatenates first 20 chars of batch label and last 6 chars of game id", () => {
    expect(
      makeRecordingsFolder("my-batch-label-abc-extra", "abcdef123456ghijkl"),
    ).toBe("my-batch-label-abc-eghijkl");
  });

  test("stays within the 28-char Daily.co budget for typical inputs", () => {
    // Cypress 06 used a 16-player batch label with timestamp suffix —
    // realistic worst case is something like "cytest_06_<timestamp>".
    const folder = makeRecordingsFolder(
      "cytest_06_load_2026_04_24",
      "ABCDEFGH123456789",
    );
    // Daily room names are capped at 41 chars including a
    // ~13-char "deliberation" prefix; the unprefixed portion must be
    // ≤ 28 chars.
    expect(folder.length).toBeLessThanOrEqual(28);
  });

  test("never exceeds 26 chars regardless of input length", () => {
    // Pathologically long inputs still respect the slice contract.
    const veryLongLabel = "a".repeat(500);
    const veryLongId = "b".repeat(500);
    const folder = makeRecordingsFolder(veryLongLabel, veryLongId);
    // 20 (label slice) + 6 (id slice) = 26.
    expect(folder).toHaveLength(26);
  });

  test("is deterministic — same inputs produce the same folder", () => {
    expect(makeRecordingsFolder("label", "gameid_xyz")).toBe(
      makeRecordingsFolder("label", "gameid_xyz"),
    );
  });

  test("two games in the same batch get distinct folders when their ids differ in the last 6 chars", () => {
    expect(
      makeRecordingsFolder("shared-batch-label", "aaaaaaaa_111111"),
    ).not.toBe(makeRecordingsFolder("shared-batch-label", "aaaaaaaa_222222"));
  });

  test("collides if two game ids share the same last-6 suffix", () => {
    // Documents the (deliberate) trade-off: the algorithm uses the
    // last 6 chars only, so two games with identical suffixes would
    // collide. Empirica game ids are sufficiently random in their
    // last 6 chars that this is acceptable for the small batches
    // this platform runs; pinning the behavior here means a future
    // refactor that changes the contract is forced to update this
    // test rather than silently changing collision odds.
    expect(makeRecordingsFolder("label", "alpha_xyz123")).toBe(
      makeRecordingsFolder("label", "beta_xyz123"),
    );
  });

  test("works for short batch labels (< 20 chars) without padding", () => {
    expect(makeRecordingsFolder("short", "abcdef123456")).toBe("short123456");
    // Length is whatever-the-label-is + 6, no padding inserted.
    expect(makeRecordingsFolder("short", "abcdef123456")).toHaveLength(
      "short".length + 6,
    );
  });

  test("works for short game ids (< 6 chars) — slice(-6) returns the whole string", () => {
    expect(makeRecordingsFolder("label", "abc")).toBe("labelabc");
  });
});
