// Bootstrap for the manager-launched runtime tick channel. Wires
// together the scheduler, tick client, status state machine, and
// content-hash store with values pulled from env vars + the
// per-Instance JWT.
//
// Call `initManagerRuntime({ getCtx })` once at server startup; it
// returns the runtime handle (or null when USE_MANAGER_SAVE !==
// "true"). `getCtx` is called fresh on each tick so the callbacks
// wiring can supply the current Empirica `ctx` once it's available
// — typically captured by an early `Empirica.on("batch")` handler
// (`ctx` is passed to handlers, not available at server start).
// `setCtx(newCtx)` is the in-process equivalent for callers that
// prefer to push rather than pull.
//
// Call `startTicking()` once a tick should fire. Until then ticks
// are silent; the in-flight guard ensures a startTicking after
// init won't double-fire if the bootstrap was idempotent. Call
// `stopTicking()` on shutdown.
//
// Solo-dev mode (USE_MANAGER_SAVE absent or "false") is a no-op:
// every export is safe to call but does nothing. The legacy direct-
// Octokit save path (server/src/providers/github.js) keeps running.

import * as Sentry from "@sentry/node";
import { tickPayload } from "@deliberation-lab/contracts/tick";
import { TickClient } from "./tickClient.mjs";
import { TickScheduler } from "./tickScheduler.mjs";
import { TickStatus } from "./tickStatus.mjs";
import { ContentHashStore } from "./contentHashStore.mjs";
import { verifyManagerToken, assertInstanceMatch } from "./jwtVerifier.mjs";
import { summarizePlayerProgression } from "../state/summarizePlayerProgression.mjs";

let cachedRuntime = null;

export function isManagerLaunched() {
  return process.env.USE_MANAGER_SAVE === "true";
}

// Build a tick payload from the runtime's current state. Pure
// function; the scheduler calls this each cadence. Sequence is
// passed in (the bootstrap owns the counter so sequence advances
// only on ack — same `peekNextTick` pattern as the manager's
// mock-runtime).
export function buildTickPayload({ sequence, status, ctx }) {
  const payload = {
    sequence,
    status: status.current(),
  };
  if (ctx) {
    const progression = summarizePlayerProgression(ctx);
    // Total participant count is the sum of all bucket counts. The
    // tick contract makes `count` optional (per migration window in
    // contracts/buckets.mjs); we always emit it so the manager's
    // BL-4 dashboard has a number even before details fully populate.
    const count = Object.values(progression.buckets).reduce((a, b) => a + b, 0);
    payload.state = {
      participants: {
        count,
        buckets: progression.buckets,
        details: progression.details,
      },
    };
  }
  return tickPayload.parse(payload);
}

// Initialize the runtime if USE_MANAGER_SAVE=true. Reads env, decodes
// the JWT, and instantiates all the pieces. Returns the runtime
// handle, or null in solo-dev mode. Idempotent.
export function initManagerRuntime({
  getCtx = () => null,
  fetchImpl,
  setIntervalImpl,
  clearIntervalImpl,
  setTimeoutImpl,
  clearTimeoutImpl,
  logger = null,
  // Sentry impl is injectable so unit tests can assert captures
  // without initializing a real Sentry client. Defaults to the
  // module-loaded Sentry the runtime calls everywhere else.
  sentryImpl = Sentry,
} = {}) {
  if (!isManagerLaunched()) return null;
  if (cachedRuntime) return cachedRuntime;

  const token = process.env.MANAGER_INSTANCE_TOKEN;
  if (!token) {
    throw new Error(
      "MANAGER_INSTANCE_TOKEN env var is required when USE_MANAGER_SAVE=true",
    );
  }
  const instanceId = process.env.INSTANCE_ID;
  if (!instanceId) {
    throw new Error(
      "INSTANCE_ID env var is required when USE_MANAGER_SAVE=true",
    );
  }
  const managerUrl = process.env.MANAGER_URL;
  if (!managerUrl) {
    throw new Error(
      "MANAGER_URL env var is required when USE_MANAGER_SAVE=true",
    );
  }

  const claims = verifyManagerToken(token);
  assertInstanceMatch(claims, instanceId);

  const status = new TickStatus("running");
  const hashStore = new ContentHashStore();
  const client = new TickClient({
    managerUrl,
    instanceId,
    instanceToken: token,
    fetchImpl,
  });

  // Sequence counter — advances on `acked` or `discarded` outcomes,
  // stays put on `retry` / `fetch-failed` so the next tick re-emits
  // the same sequence (matches the manager-mock peek/ack semantics).
  // Mutable getter+setter on the runtime so callbacks-side code can
  // swap the ctx supplier without re-initing.
  let nextSequence = 0;
  let getCtxFn = getCtx;

  const onTick = async () => {
    const payload = buildTickPayload({
      sequence: nextSequence,
      status,
      ctx: getCtxFn(),
    });
    const result = await client.send(payload);
    if (result.outcome === "acked") {
      // Defense-in-depth: the manager echoes the sequence it just
      // ack'd; if it doesn't match what we sent, log loudly and
      // resync from `ackedSequence + 1` so we don't drift silently
      // into an off-by-one. Manager treats replays of an already-
      // ack'd sequence as no-ops, so resyncing forward is safe.
      if (
        typeof result.ackedSequence === "number" &&
        result.ackedSequence !== payload.sequence
      ) {
        logger?.warn?.(
          {
            sentSequence: payload.sequence,
            ackedSequence: result.ackedSequence,
          },
          "tick: ackedSequence mismatch — resyncing from manager's value",
        );
        nextSequence = result.ackedSequence + 1;
      } else {
        nextSequence += 1;
      }
    } else if (result.outcome === "discarded") {
      // Manager rejected this payload as unrecoverable — usually a
      // runtime bug (malformed tick, premature `complete`, contract
      // violation) or an upstream-infrastructure blip producing a
      // non-JSON / non-conformant response. Either way the next
      // tick won't repair the same payload, so we advance the
      // cursor and capture to Sentry with full context. Per
      // manager interface-contract.md §"Error surfacing: two
      // pipelines" these are platform-developer-actionable; the
      // researcher can't fix them and shouldn't see them.
      sentryImpl?.captureMessage?.("manager rejected tick (non-retryable)", {
        level: "error",
        tags: {
          instance_id: instanceId,
          batch_id: claims.batch_id,
          study_id: claims.study_id,
          workspace_id: claims.workspace_id,
          runtime_version: process.env.CONTAINER_IMAGE_VERSION_TAG,
          tick_outcome: "discarded",
          tick_code: result.code,
        },
        extra: {
          sentSequence: payload.sequence,
          sentStatus: payload.status,
          code: result.code,
          message: result.message,
          httpStatus: result.httpStatus,
          validationIssues: result.validationIssues,
        },
      });
      nextSequence += 1;
    }
    logger?.info?.(
      {
        sequence: payload.sequence,
        status: payload.status,
        outcome: result.outcome,
      },
      "tick: result",
    );
    return result;
  };

  const scheduler = new TickScheduler({
    instanceId,
    onTick,
    setIntervalImpl,
    clearIntervalImpl,
    setTimeoutImpl,
    clearTimeoutImpl,
    logger,
  });

  cachedRuntime = {
    status,
    hashStore,
    client,
    scheduler,
    instanceId,
    claims,
    getSequence: () => nextSequence,
    setCtx: (ctx) => {
      getCtxFn = () => ctx;
    },
    setGetCtx: (fn) => {
      getCtxFn = fn;
    },
  };
  return cachedRuntime;
}

// Convenience accessors for the wired-in callbacks. All no-ops when
// the runtime isn't initialized (solo-dev mode).
export function startTicking() {
  if (cachedRuntime) cachedRuntime.scheduler.start();
}
export function stopTicking() {
  if (cachedRuntime) cachedRuntime.scheduler.stop();
}
export function setStatus(next) {
  if (cachedRuntime) cachedRuntime.status.set(next);
}
export function setCtx(ctx) {
  if (cachedRuntime) cachedRuntime.setCtx(ctx);
}
export function fireTickNow() {
  if (cachedRuntime) return cachedRuntime.scheduler.tickOnce();
  return Promise.resolve(null);
}
export function getRuntime() {
  return cachedRuntime;
}

// Test-only: drop the cached runtime so subsequent inits start
// fresh. Production code should never call this — exposed under a
// distinct name so it's grep-able when auditing for accidental
// production use.
export function resetManagerRuntimeForTests() {
  cachedRuntime?.scheduler?.stop?.();
  cachedRuntime = null;
}
