import { describe, expect, it } from "vitest";
import { tickResponse } from "../tick-response.mjs";

describe("tickResponse", () => {
  it("accepts an ok response with ackedSequence + commitSha", () => {
    const r = tickResponse.parse({
      ok: true,
      ackedSequence: 5,
      commitSha: "abc123",
    });
    if (r.ok) expect(r.ackedSequence).toBe(5);
  });

  it("accepts an ok response with ackedSequence only (no save → no commit)", () => {
    const r = tickResponse.parse({ ok: true, ackedSequence: 7 });
    expect(r.ok).toBe(true);
  });

  it("accepts a retryable failure", () => {
    const r = tickResponse.parse({
      ok: false,
      retryable: true,
      code: "RATE_LIMITED",
      message: "try again",
    });
    if (!r.ok) {
      expect(r.retryable).toBe(true);
      expect(r.code).toBe("RATE_LIMITED");
    }
  });

  it("accepts a non-retryable failure", () => {
    const r = tickResponse.parse({
      ok: false,
      retryable: false,
      code: "RUNTIME_PROTOCOL_VIOLATION_PREMATURE_COMPLETE",
    });
    if (!r.ok) expect(r.retryable).toBe(false);
  });

  it("rejects an ok response missing ackedSequence", () => {
    expect(() => tickResponse.parse({ ok: true })).toThrow();
  });

  it("rejects a fail response missing code", () => {
    expect(() => tickResponse.parse({ ok: false, retryable: true })).toThrow();
  });
});
