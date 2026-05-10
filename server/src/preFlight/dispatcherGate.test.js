import { describe, test, expect } from "vitest";
import { shouldCreateDispatcher } from "./dispatcherGate.ts";

// All 14 cells of the {status × hasDispatcher} matrix that the
// callbacks.js gate has to handle (7 status values × 2 hasDispatcher
// values). These tests pin the predicate so future changes (e.g.,
// adding a new status value, tightening the gate) surface here
// rather than as silent runtime breakage.
//
// The test that motivated this whole helper: `status=undefined` +
// `hasDispatcher=false` MUST return true. Without it, manager-launched
// batches at scope-creation time fall into the "skip" branch (status
// is not yet set by the manager), the dispatcher is never created,
// and `runDispatch` later crashes with `TypeError: dispatcher is not
// a function`. This was the v0.1.6 production bug surfaced by the
// first end-to-end manager smoke test.

describe("shouldCreateDispatcher", () => {
  describe("when no dispatcher exists yet", () => {
    test("status undefined → CREATE (manager-launched, scope just created, status not yet set)", () => {
      expect(
        shouldCreateDispatcher({ status: undefined, hasDispatcher: false }),
      ).toBe(true);
    });

    test('status "initializing" → CREATE (manager-launched under handshake protocol)', () => {
      expect(
        shouldCreateDispatcher({
          status: "initializing",
          hasDispatcher: false,
        }),
      ).toBe(true);
    });

    test('status "created" → CREATE (classic-admin: CreateBatch UI sets this atomically with config)', () => {
      expect(
        shouldCreateDispatcher({ status: "created", hasDispatcher: false }),
      ).toBe(true);
    });

    test('status "running" → CREATE (server-restart of an already-admitting batch)', () => {
      expect(
        shouldCreateDispatcher({ status: "running", hasDispatcher: false }),
      ).toBe(true);
    });

    test('status "terminated" → SKIP (dead batch, dispatcher would never be called)', () => {
      expect(
        shouldCreateDispatcher({ status: "terminated", hasDispatcher: false }),
      ).toBe(false);
    });

    test('status "failed" → SKIP (dead batch, init failed earlier in this handler invocation)', () => {
      expect(
        shouldCreateDispatcher({ status: "failed", hasDispatcher: false }),
      ).toBe(false);
    });

    test("unknown future status → CREATE (default-allow; terminal states are the explicit deny-list)", () => {
      // Defensive: if Empirica or a future protocol introduces a new
      // status value, the gate defaults to "create" rather than
      // silently dropping the dispatcher. The wrong direction would
      // be silent breakage; the right direction is "fail visibly later
      // if the dispatcher is wrong" (which never happens because
      // makeDispatcher doesn't depend on status).
      expect(
        shouldCreateDispatcher({
          status: "unknown-future-state",
          hasDispatcher: false,
        }),
      ).toBe(true);
    });
  });

  describe("when a dispatcher already exists", () => {
    // Idempotency: don't replace a working dispatcher under any
    // circumstances. The `dispatchers` map is in-memory, so this
    // branch is the protection against the handler firing twice for
    // the same batch (race against `setAttributes` triggering kind +
    // attribute listeners in some sequence). The "false" return
    // says "skip" — the existing dispatcher stays.
    test.each([
      undefined,
      "initializing",
      "created",
      "running",
      "terminated",
      "failed",
    ])("status %s → SKIP (don't replace existing dispatcher)", (status) => {
      expect(shouldCreateDispatcher({ status, hasDispatcher: true })).toBe(
        false,
      );
    });
  });
});
