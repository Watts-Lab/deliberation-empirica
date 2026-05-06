import { describe, expect, it } from "vitest";
import { tickPayload, tickStatus, tickSave, tickError } from "../tick.mjs";

describe("tickStatus", () => {
  it("accepts the four runtime-reportable states", () => {
    for (const s of ["running", "draining", "complete", "failed"]) {
      expect(tickStatus.parse(s)).toBe(s);
    }
  });

  it("rejects manager-derived states the runtime never reports", () => {
    for (const s of [
      "sealed",
      "awaiting-teardown",
      "preparing",
      "provisioning",
    ]) {
      expect(() => tickStatus.parse(s)).toThrow();
    }
  });
});

describe("tickSave", () => {
  const validBase = {
    path: "science.jsonl",
    contentHash: "a".repeat(64),
    contentBase64: "aGVsbG8=",
  };

  it("accepts a well-formed save", () => {
    const ok = tickSave.parse(validBase);
    expect(ok.path).toBe("science.jsonl");
  });

  it("accepts nested relative paths", () => {
    const ok = tickSave.parse({ ...validBase, path: "exports/science.jsonl" });
    expect(ok.path).toBe("exports/science.jsonl");
  });

  it("rejects a non-sha256 contentHash", () => {
    expect(() =>
      tickSave.parse({ ...validBase, contentHash: "not-a-hash" }),
    ).toThrow();
  });

  it("rejects an empty path", () => {
    expect(() => tickSave.parse({ ...validBase, path: "" })).toThrow();
  });

  it("rejects an absolute path (would let runtime escape destination prefix)", () => {
    expect(() =>
      tickSave.parse({ ...validBase, path: "/etc/passwd" }),
    ).toThrow();
  });

  it("rejects a path with `..` segment (path traversal)", () => {
    expect(() =>
      tickSave.parse({ ...validBase, path: "../escape.jsonl" }),
    ).toThrow();
    expect(() =>
      tickSave.parse({ ...validBase, path: "exports/../escape.jsonl" }),
    ).toThrow();
  });

  it("rejects a non-base64 contentBase64", () => {
    expect(() =>
      tickSave.parse({ ...validBase, contentBase64: "not base64!" }),
    ).toThrow();
  });
});

describe("tickError", () => {
  const validErr = {
    id: "e-1",
    kind: "validation",
    code: "TREATMENT_FILE_NOT_FOUND",
    retryable: false,
    message: "treatment file missing",
  };

  it("accepts a well-formed validation error", () => {
    const e = tickError.parse(validErr);
    expect(e.kind).toBe("validation");
  });

  it("rejects an unknown kind", () => {
    expect(() => tickError.parse({ ...validErr, kind: "warning" })).toThrow();
  });

  it("requires retryable", () => {
    const { retryable: _omit, ...rest } = validErr;
    expect(() => tickError.parse(rest)).toThrow();
  });

  it("requires message (manager fallback when no per-code renderer exists)", () => {
    const { message: _omit, ...rest } = validErr;
    expect(() => tickError.parse(rest)).toThrow();
  });
});

describe("tickPayload", () => {
  it("accepts a steady-state running tick with state but no save", () => {
    const t = tickPayload.parse({
      sequence: 12,
      status: "running",
      state: { participants: { count: 3 } },
    });
    expect(t.sequence).toBe(12);
    expect(t.save).toBeUndefined();
  });

  it("accepts a save-bearing tick", () => {
    const t = tickPayload.parse({
      sequence: 13,
      status: "draining",
      save: {
        path: "payment.jsonl",
        contentHash: "f".repeat(64),
        contentBase64: "Zm9v",
      },
    });
    expect(t.save?.path).toBe("payment.jsonl");
  });

  it("rejects negative sequence", () => {
    expect(() =>
      tickPayload.parse({ sequence: -1, status: "running" }),
    ).toThrow();
  });

  it("accepts arbitrary additional state fields via passthrough", () => {
    const t = tickPayload.parse({
      sequence: 0,
      status: "running",
      state: { participants: { count: 0 }, somethingFutureRuntime: true },
    });
    expect(t.state?.somethingFutureRuntime).toBe(true);
  });
});
