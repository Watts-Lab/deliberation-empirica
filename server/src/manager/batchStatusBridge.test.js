import { describe, expect, test, vi } from "vitest";
import { advanceManagerStatusOnBatchStatusChange } from "./batchStatusBridge.mjs";
import { TickStatus } from "./tickStatus.mjs";

/**
 * Bridges the Tajriba-side `batch.status` attribute (set by the
 * manager's early-close to `"terminated"`, or by Empirica itself
 * to `"failed"`) into the manager-runtime's internal `TickStatus`,
 * which the per-tick payload reflects.
 *
 * Without this bridge, `closeBatch` ran and the post-flight report
 * fired, but the runtime's tick stream kept reporting
 * `status: "running"` forever — silence detector never tripped,
 * Railway service never auto-cleaned. Reproduced live 2026-05-09;
 * see dl#158.
 *
 * Two-layer test plan:
 *
 *   - Mapping tests use `vi.fn()` to assert the helper calls
 *     `setManagerStatus` with the right *string*. Cheap and clearly
 *     express the (batch-status → tick-status) contract.
 *
 *   - Integration tests run the helper against a real `TickStatus`
 *     instance to catch state-machine violations. Necessary because
 *     `failed` is terminal in `tickStatus.mjs:TRANSITIONS` —
 *     mapping `batch.status="failed"` to `setStatus("draining")`
 *     would throw `"Invalid transition: failed → draining"` if
 *     `reportTerminalError` already advanced TickStatus to `"failed"`
 *     before Empirica emits the batch-status change. The mapping
 *     test on its own can't see that; integration tests do.
 */

describe("advanceManagerStatusOnBatchStatusChange — mapping", () => {
  test("on `terminated` → calls setManagerStatus('draining')", () => {
    const setManagerStatus = vi.fn();
    advanceManagerStatusOnBatchStatusChange({
      status: "terminated",
      setManagerStatus,
    });
    expect(setManagerStatus).toHaveBeenCalledTimes(1);
    expect(setManagerStatus).toHaveBeenCalledWith("draining");
  });

  test("on `failed` → calls setManagerStatus('failed') (NOT 'draining'; failed is terminal in TickStatus)", () => {
    const setManagerStatus = vi.fn();
    advanceManagerStatusOnBatchStatusChange({
      status: "failed",
      setManagerStatus,
    });
    expect(setManagerStatus).toHaveBeenCalledTimes(1);
    expect(setManagerStatus).toHaveBeenCalledWith("failed");
  });

  test("on `running` → no-op (already running at boot)", () => {
    const setManagerStatus = vi.fn();
    advanceManagerStatusOnBatchStatusChange({
      status: "running",
      setManagerStatus,
    });
    expect(setManagerStatus).not.toHaveBeenCalled();
  });

  test("on `created` → no-op (pre-running batch state)", () => {
    const setManagerStatus = vi.fn();
    advanceManagerStatusOnBatchStatusChange({
      status: "created",
      setManagerStatus,
    });
    expect(setManagerStatus).not.toHaveBeenCalled();
  });

  test("on an unknown future status → no-op (don't advance for a state we don't recognize)", () => {
    const setManagerStatus = vi.fn();
    advanceManagerStatusOnBatchStatusChange({
      status: "some-future-state",
      setManagerStatus,
    });
    expect(setManagerStatus).not.toHaveBeenCalled();
  });

  test("on `terminated` called twice → second call is a no-op transition (idempotency at the bridge layer documented; TickStatus enforces at the layer below)", () => {
    const setManagerStatus = vi.fn();
    advanceManagerStatusOnBatchStatusChange({
      status: "terminated",
      setManagerStatus,
    });
    advanceManagerStatusOnBatchStatusChange({
      status: "terminated",
      setManagerStatus,
    });
    // Bridge fires both times — TickStatus's same-state-set is a
    // no-op, so this is safe end-to-end.
    expect(setManagerStatus).toHaveBeenCalledTimes(2);
    expect(setManagerStatus).toHaveBeenNthCalledWith(1, "draining");
    expect(setManagerStatus).toHaveBeenNthCalledWith(2, "draining");
  });
});

describe("advanceManagerStatusOnBatchStatusChange — TickStatus state-machine integration", () => {
  // These exercise the (batch-status → setStatus-arg) mapping
  // against a real `TickStatus`, asserting the resulting transitions
  // are legal per `tickStatus.mjs:TRANSITIONS`. The bare-mock tests
  // above can't see state-machine validity; these can.

  test("running batch + terminated → TickStatus advances to draining", () => {
    const tickStatus = new TickStatus("running");
    advanceManagerStatusOnBatchStatusChange({
      status: "terminated",
      setManagerStatus: (s) => tickStatus.set(s),
    });
    expect(tickStatus.current()).toBe("draining");
  });

  test("running batch + failed → TickStatus advances to failed", () => {
    const tickStatus = new TickStatus("running");
    advanceManagerStatusOnBatchStatusChange({
      status: "failed",
      setManagerStatus: (s) => tickStatus.set(s),
    });
    expect(tickStatus.current()).toBe("failed");
  });

  test("ALREADY-failed runtime + batch.status=failed → no throw, stays failed (regression for `failed → draining` design bug caught in review)", () => {
    // `reportTerminalError` may have set TickStatus to `failed`
    // before Empirica emits the corresponding batch-status change.
    // The earlier draft mapped both `terminated` AND `failed` to
    // `"draining"`, which would have thrown
    // `"Invalid transition: failed → draining"` here.
    const tickStatus = new TickStatus("running");
    tickStatus.set("failed");
    expect(() =>
      advanceManagerStatusOnBatchStatusChange({
        status: "failed",
        setManagerStatus: (s) => tickStatus.set(s),
      }),
    ).not.toThrow();
    expect(tickStatus.current()).toBe("failed");
  });

  test("draining batch + terminated → TickStatus stays draining (re-emit of terminated during drain)", () => {
    const tickStatus = new TickStatus("running");
    tickStatus.set("draining");
    advanceManagerStatusOnBatchStatusChange({
      status: "terminated",
      setManagerStatus: (s) => tickStatus.set(s),
    });
    expect(tickStatus.current()).toBe("draining");
  });
});
