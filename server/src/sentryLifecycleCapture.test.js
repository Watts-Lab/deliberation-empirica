// Smoke + unit coverage for the lifecycle-stage Sentry helpers (#183).
// The integration assertion ("force a boot failure, Sentry event
// lands") collapses to: when env validation throws and the
// `Empirica.on("start")` catch fires `captureLifecycleError`, does
// Sentry's capture pipeline see it? We test that by feeding the
// helper a representative thrown error and verifying the mock's
// `captureException` + `flush` were both called with the right
// shape. Adjacent helpers (`flushSentry`, `normalizeRejectionReason`)
// are unit-tested as pure surfaces.

import { describe, test, expect, beforeEach, vi } from "vitest";

const captureException = vi.fn();
const flush = vi.fn().mockResolvedValue(true);

vi.mock("@sentry/node", () => ({
  captureException: (...args) => captureException(...args),
  flush: (...args) => flush(...args),
}));

// Import under test AFTER the mock — otherwise the real SDK gets
// bound to the helper's import slot.
const { captureLifecycleError, flushSentry, normalizeRejectionReason } =
  await import("./sentryLifecycleCapture");

beforeEach(() => {
  captureException.mockClear();
  flush.mockClear();
  flush.mockResolvedValue(true);
  delete process.env.CONTAINER_IMAGE_VERSION_TAG;
});

describe("captureLifecycleError", () => {
  test("captures the error with a stage tag", async () => {
    const err = new Error("boom");
    await captureLifecycleError(err, { stage: "server-start" });

    expect(captureException).toHaveBeenCalledTimes(1);
    const [capturedErr, opts] = captureException.mock.calls[0];
    expect(capturedErr).toBe(err);
    expect(opts.tags.stage).toBe("server-start");
  });

  test("includes the runtime image tag from env", async () => {
    process.env.CONTAINER_IMAGE_VERSION_TAG = "v0.1.42";
    await captureLifecycleError(new Error("x"), { stage: "uncaughtException" });

    const [, opts] = captureException.mock.calls[0];
    expect(opts.tags.runtimeImageTag).toBe("v0.1.42");
  });

  test("flushes for a bounded window so events don't die with the container", async () => {
    await captureLifecycleError(new Error("x"), { stage: "any" });

    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith(2000);
  });

  test("flushes AFTER capturing so the event is queued before the wait", async () => {
    const order = [];
    captureException.mockImplementation(() => order.push("capture"));
    flush.mockImplementation(async () => {
      order.push("flush");
      return true;
    });

    await captureLifecycleError(new Error("x"), { stage: "any" });

    expect(order).toEqual(["capture", "flush"]);
  });

  test("passes through contexts when provided, matching #181 precedent", async () => {
    await captureLifecycleError(new Error("x"), {
      stage: "server-start",
      contexts: { http: { method: "POST", status: 400 } },
    });

    const [, opts] = captureException.mock.calls[0];
    expect(opts.contexts).toEqual({ http: { method: "POST", status: 400 } });
  });

  test("omits contexts key entirely when not provided", async () => {
    await captureLifecycleError(new Error("x"), { stage: "any" });

    const [, opts] = captureException.mock.calls[0];
    expect(opts).not.toHaveProperty("contexts");
  });

  test("simulates the boot-failure path: preflight throw routed through the helper", async () => {
    // Stand-in for the `Empirica.on("start")` catch: env validation
    // throws, the catch funnels through captureLifecycleError. This
    // is the contract #183 was filed to enforce.
    const bootFailure = new Error(
      "Manager-launched env validation failed: JWT_VERIFY_SECRET: must be at least 1 character",
    );

    try {
      throw bootFailure;
    } catch (err) {
      await captureLifecycleError(err, { stage: "server-start" });
    }

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][0]).toBe(bootFailure);
    expect(flush).toHaveBeenCalledTimes(1);
  });
});

describe("flushSentry", () => {
  test("calls Sentry.flush with the bounded window", async () => {
    await flushSentry();

    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith(2000);
  });

  test("propagates flush rejection to the caller (handler decides whether to swallow)", async () => {
    flush.mockRejectedValueOnce(new Error("transport down"));

    await expect(flushSentry()).rejects.toThrow("transport down");
  });
});

describe("normalizeRejectionReason", () => {
  test("returns Error instances unchanged", () => {
    const err = new TypeError("foo");
    expect(normalizeRejectionReason(err)).toBe(err);
  });

  test("wraps a string reason in a new Error", () => {
    const result = normalizeRejectionReason("string rejection");
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("string rejection");
  });

  test("wraps an object reason via String()", () => {
    const result = normalizeRejectionReason({ foo: 1 });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("[object Object]");
  });

  test("wraps undefined / null without throwing", () => {
    expect(normalizeRejectionReason(undefined).message).toBe("undefined");
    expect(normalizeRejectionReason(null).message).toBe("null");
  });

  test("subclasses of Error pass through unchanged", () => {
    class CustomErr extends Error {}
    const err = new CustomErr("custom");
    expect(normalizeRejectionReason(err)).toBe(err);
  });
});
