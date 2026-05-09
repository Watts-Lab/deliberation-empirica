import { describe, expect, it, vi } from "vitest";
import { makeManagerRuntimeLogger } from "./runtimeLogger.mjs";

/**
 * Unit tests for the pino-style → Empirica-console logger adapter.
 *
 * The adapter exists because the runtime's manager-bridge code
 * (`initManagerRuntime` in index.mjs) calls
 * `logger?.info?.(obj, msg)` — pino's standard arity — but
 * Empirica's `@empirica/core/console` `info`/`warn`/`error` are
 * variadic and treat each arg positionally. Passing the bare
 * Empirica logger would emit `[obj] [msg]` as two opaque args; the
 * adapter joins them into a single "<msg> <json>" string so tick
 * lines are searchable + parseable.
 *
 * See manager logs around 2026-05-08 02:39 — a Running Instance
 * never showed any tick line in its runtime log stream because
 * `logger` defaulted to null and every `?.info?.()` no-op'd.
 */

describe("makeManagerRuntimeLogger", () => {
  it("transforms (obj, msg) → '<msg> <json>' on each level", () => {
    const info = vi.fn();
    const warn = vi.fn();
    const error = vi.fn();
    const logger = makeManagerRuntimeLogger({ info, warn, error });

    logger.info(
      { sequence: 0, status: "running", outcome: "acked" },
      "tick: result",
    );
    logger.warn({ instance_id: "i_1" }, "tick: skipped (previous in-flight)");
    logger.error({ err: "boom" }, "tick: result");

    expect(info).toHaveBeenCalledWith(
      'tick: result {"sequence":0,"status":"running","outcome":"acked"}',
    );
    expect(warn).toHaveBeenCalledWith(
      'tick: skipped (previous in-flight) {"instance_id":"i_1"}',
    );
    expect(error).toHaveBeenCalledWith('tick: result {"err":"boom"}');
  });

  it("forwards non-(obj, msg) calls verbatim", () => {
    const info = vi.fn();
    const logger = makeManagerRuntimeLogger({
      info,
      warn: vi.fn(),
      error: vi.fn(),
    });

    // String-only — log directly.
    logger.info("plain message");
    expect(info).toHaveBeenLastCalledWith("plain message");

    // Single object — fallback (no msg to lead with).
    logger.info({ k: 1 });
    expect(info).toHaveBeenLastCalledWith({ k: 1 });

    // Three+ args — variadic forwarding (Empirica console accepts).
    logger.info("a", "b", "c");
    expect(info).toHaveBeenLastCalledWith("a", "b", "c");
  });

  it("falls back to String(obj) for cyclic / non-serializable contexts", () => {
    const info = vi.fn();
    const logger = makeManagerRuntimeLogger({
      info,
      warn: vi.fn(),
      error: vi.fn(),
    });
    const cyclic = {};
    cyclic.self = cyclic;

    logger.info(cyclic, "cyclic context");

    // Doesn't throw; emits a string with the message in front.
    expect(info).toHaveBeenCalledTimes(1);
    const arg = info.mock.calls[0][0];
    expect(typeof arg).toBe("string");
    expect(arg.startsWith("cyclic context ")).toBe(true);
  });
});
