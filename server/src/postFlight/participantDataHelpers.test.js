import { describe, test, expect } from "vitest";
import {
  buildParticipantMetaLines,
  parseParticipantData,
} from "./participantDataHelpers";

describe("buildParticipantMetaLines", () => {
  test("produces two JSON lines for platformId and deliberationId", () => {
    const lines = buildParticipantMetaLines({
      platformId: "worker-7",
      deliberationId: "delib-abc",
      ts: "2024-01-01T00:00:00.000Z",
    });
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual({
      type: "meta",
      key: "platformId",
      val: "worker-7",
      ts: "2024-01-01T00:00:00.000Z",
    });
    expect(JSON.parse(lines[1])).toEqual({
      type: "meta",
      key: "deliberationId",
      val: "delib-abc",
      ts: "2024-01-01T00:00:00.000Z",
    });
  });

  test("the two lines share the same timestamp", () => {
    const lines = buildParticipantMetaLines({
      platformId: "x",
      deliberationId: "y",
      ts: "2024-01-01T12:00:00.000Z",
    });
    const a = JSON.parse(lines[0]);
    const b = JSON.parse(lines[1]);
    expect(a.ts).toBe(b.ts);
  });

  test("preserves string inputs verbatim (no trimming or lowercasing)", () => {
    const lines = buildParticipantMetaLines({
      platformId: "  Worker With Spaces  ",
      deliberationId: "UPPERCASE-UUID",
      ts: "t",
    });
    expect(JSON.parse(lines[0]).val).toBe("  Worker With Spaces  ");
    expect(JSON.parse(lines[1]).val).toBe("UPPERCASE-UUID");
  });
});

describe("parseParticipantData", () => {
  test("parses a single meta line into a keyed object", () => {
    const text = JSON.stringify({
      type: "meta",
      key: "platformId",
      val: "p-1",
      ts: "t",
    });
    expect(parseParticipantData(text)).toEqual({ platformId: "p-1" });
  });

  test("parses multiple meta lines in order", () => {
    const text = [
      JSON.stringify({ type: "meta", key: "platformId", val: "p1", ts: "t1" }),
      JSON.stringify({ type: "meta", key: "deliberationId", val: "d1", ts: "t1" }),
    ].join("\n");
    expect(parseParticipantData(text)).toEqual({
      platformId: "p1",
      deliberationId: "d1",
    });
  });

  test("later lines overwrite earlier ones for the same key", () => {
    const text = [
      JSON.stringify({ type: "meta", key: "platformId", val: "old", ts: "t1" }),
      JSON.stringify({ type: "meta", key: "platformId", val: "new", ts: "t2" }),
    ].join("\n");
    expect(parseParticipantData(text).platformId).toBe("new");
  });

  test("ignores non-meta record types", () => {
    const text = [
      JSON.stringify({ type: "meta", key: "platformId", val: "p1", ts: "t" }),
      JSON.stringify({ type: "event", payload: { ignored: true } }),
    ].join("\n");
    expect(parseParticipantData(text)).toEqual({ platformId: "p1" });
  });

  test("skips blank lines", () => {
    const text = [
      "",
      JSON.stringify({ type: "meta", key: "platformId", val: "p1", ts: "t" }),
      "",
      "   ",
      "",
    ].join("\n");
    expect(parseParticipantData(text)).toEqual({ platformId: "p1" });
  });

  test("skips malformed lines without throwing", () => {
    const text = [
      "this is not JSON",
      JSON.stringify({ type: "meta", key: "platformId", val: "p1", ts: "t" }),
      "{oops",
    ].join("\n");
    expect(parseParticipantData(text)).toEqual({ platformId: "p1" });
  });

  test("returns empty object for non-string input", () => {
    expect(parseParticipantData(null)).toEqual({});
    expect(parseParticipantData(undefined)).toEqual({});
    expect(parseParticipantData(42)).toEqual({});
  });

  test("returns empty object for empty string", () => {
    expect(parseParticipantData("")).toEqual({});
  });

  test("roundtrips with buildParticipantMetaLines", () => {
    // Creation → parse yields back what we started with.
    const lines = buildParticipantMetaLines({
      platformId: "worker-1",
      deliberationId: "delib-1",
      ts: "2024-01-01T00:00:00.000Z",
    });
    const parsed = parseParticipantData(lines.join("\n"));
    expect(parsed).toEqual({
      platformId: "worker-1",
      deliberationId: "delib-1",
    });
  });
});
