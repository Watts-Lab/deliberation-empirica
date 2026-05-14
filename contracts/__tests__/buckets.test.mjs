import { describe, expect, it } from "vitest";
import {
  BUCKETS,
  bucketCounts,
  bucketName,
  participantDetail,
  participantProgression,
} from "../buckets.mjs";

describe("BUCKETS", () => {
  it("matches the runtime's logPlayerCounts buckets", () => {
    expect(BUCKETS).toEqual([
      "completed",
      "inExitSequence",
      "inGame",
      "inLobby",
      "inCountdown",
      "inIntro",
      "disconnected",
      "unknown",
    ]);
  });
});

describe("bucketName", () => {
  it("accepts each bucket name", () => {
    for (const b of BUCKETS) expect(bucketName.parse(b)).toBe(b);
  });

  it("rejects an unknown bucket", () => {
    expect(() => bucketName.parse("inWaitingRoom")).toThrow();
  });
});

describe("bucketCounts", () => {
  it("accepts a complete zero-counts object", () => {
    const z = bucketCounts.parse({
      completed: 0,
      inExitSequence: 0,
      inGame: 0,
      inLobby: 0,
      inCountdown: 0,
      inIntro: 0,
      disconnected: 0,
      unknown: 0,
    });
    expect(z.completed).toBe(0);
  });

  it("rejects negative counts", () => {
    expect(() =>
      bucketCounts.parse({
        completed: -1,
        inExitSequence: 0,
        inGame: 0,
        inLobby: 0,
        inCountdown: 0,
        inIntro: 0,
        disconnected: 0,
        unknown: 0,
      }),
    ).toThrow();
  });

  it("rejects missing buckets", () => {
    expect(() => bucketCounts.parse({ completed: 0 })).toThrow();
  });
});

describe("participantDetail + participantProgression", () => {
  it("accepts a minimal participant detail (id + bucket only)", () => {
    const d = participantDetail.parse({ id: "p-1", bucket: "inLobby" });
    expect(d.bucket).toBe("inLobby");
  });

  it("accepts the full closed-shape detail (treatmentName, gameId, lastCompletedAt)", () => {
    const d = participantDetail.parse({
      id: "p-1",
      bucket: "completed",
      treatmentName: "abortion-control",
      gameId: "g-42",
      lastCompletedAt: "2026-05-14T16:42:00.000Z",
    });
    expect(d.treatmentName).toBe("abortion-control");
    expect(d.gameId).toBe("g-42");
    expect(d.lastCompletedAt).toBe("2026-05-14T16:42:00.000Z");
  });

  it("silently strips legacy `attrs` from pre-trim runtimes (back-compat via Zod .strip())", () => {
    // Older runtimes (and older copies of this module on the
    // manager mirror) emit `attrs: Record<string, unknown>`. Zod's
    // default `.strip()` mode drops the unknown key — no parse
    // error, and the wire-size win is realized once the runtime
    // stops emitting.
    const d = participantDetail.parse({
      id: "p-1",
      bucket: "inLobby",
      attrs: { connected: true, gameId: "g1", browserInfo: "lots of data" },
    });
    expect(d).not.toHaveProperty("attrs");
    expect(d.id).toBe("p-1");
  });

  it("rejects an empty treatmentName / gameId (absence is the unassigned sentinel)", () => {
    // `.min(1).optional()`: absent means "not yet assigned",
    // empty-string is a contract violation.
    expect(() =>
      participantDetail.parse({
        id: "p-1",
        bucket: "inLobby",
        treatmentName: "",
      }),
    ).toThrow();
    expect(() =>
      participantDetail.parse({
        id: "p-1",
        bucket: "inLobby",
        gameId: "",
      }),
    ).toThrow();
  });

  it("rejects non-ISO lastCompletedAt (datetime() catches both empty string + bad strings)", () => {
    expect(() =>
      participantDetail.parse({
        id: "p-1",
        bucket: "completed",
        lastCompletedAt: "yesterday",
      }),
    ).toThrow();
    expect(() =>
      participantDetail.parse({
        id: "p-1",
        bucket: "completed",
        lastCompletedAt: "",
      }),
    ).toThrow();
  });

  it("accepts a full progression snapshot", () => {
    const s = participantProgression.parse({
      count: 2,
      buckets: {
        completed: 1,
        inExitSequence: 0,
        inGame: 0,
        inLobby: 1,
        inCountdown: 0,
        inIntro: 0,
        disconnected: 0,
        unknown: 0,
      },
      details: [
        { id: "p-1", bucket: "completed" },
        { id: "p-2", bucket: "inLobby" },
      ],
    });
    expect(s.details).toHaveLength(2);
  });

  it("accepts a count-only snapshot (migration window before #73 lands)", () => {
    const s = participantProgression.parse({ count: 0 });
    expect(s.count).toBe(0);
    expect(s.buckets).toBeUndefined();
    expect(s.details).toBeUndefined();
  });
});
