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
  it("accepts a participant detail with attrs", () => {
    const d = participantDetail.parse({
      id: "p-1",
      bucket: "inLobby",
      attrs: { connected: true, name: "alice" },
    });
    expect(d.bucket).toBe("inLobby");
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
