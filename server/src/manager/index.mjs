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

import fs from "node:fs";
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
// mock-runtime). `save` is optional (a save-eligible file picked
// by `pickEligibleSave`); when present, the contract requires it
// match the `tickSave` shape, which is enforced via `tickPayload.parse`.
export function buildTickPayload({ sequence, status, ctx, save }) {
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
  if (save) {
    payload.save = save;
  }
  return tickPayload.parse(payload);
}

// Walk the registered output files, find the first whose current
// content differs from the last hash the manager ack'd, and return
// it shaped for the tick payload's `save` slot. Returns null if no
// tracked file is dirty (steady-state ticks carry no save).
//
// One save per tick is the contract (manager ADR 0005 §"Pass-through
// data flow") — multi-file post-flight bursts ride out-of-band ticks,
// one file per tick, per ADR 0005 §"Batch close". The first-dirty
// pick here is registration-order; the post-flight burst path
// (deliberation-lab#11 §3) will fire `fireTickNow` repeatedly so
// each successive tick picks the next dirty file.
//
// Files that don't exist on disk yet (e.g. `postFlightReport.jsonl`
// before post-flight runs) are skipped silently — there's nothing
// to save until the runtime writes them.
//
// Torn-write tolerance: `readFileSync` on a file that the
// post-flight callback is mid-`fs.writeFileSync` to could yield a
// partial buffer, hash to a different value, and ride the tick.
// That's correctness-safe: the manager dedupes by
// (instance_id, path, contentHash), and the next tick reads the
// now-complete file, hashes differently, and re-emits. The cost is
// one wasted tick slot per torn read; we accept that rather than
// adding a write-side coordination signal.
export function pickEligibleSave({ outputs, hashStore, fsImpl = fs }) {
  // `.some()` short-circuits when the callback returns true, giving
  // us early-exit-on-first-dirty without a `for`/`continue` loop
  // (which the repo's airbnb-base config disallows under
  // no-restricted-syntax / no-continue). Closure mutation is the
  // idiomatic escape hatch — `find` on the entries would fall short
  // because we'd lose the already-read content and either re-read
  // (twice the I/O) or carry it through a tuple.
  let save = null;
  Array.from(outputs).some(([runtimePath, { diskPath }]) => {
    let content;
    try {
      content = fsImpl.readFileSync(diskPath);
    } catch (err) {
      if (err && err.code === "ENOENT") return false;
      throw err;
    }
    // Normalize once. `fsImpl` is injectable; a string-returning stub
    // would otherwise propagate as garbage through `toString("base64")`
    // and trip `tickPayload.parse`'s base64 refinement at send time.
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
    // Hash once; reuse for both the dirty-check and the payload's
    // contentHash field. Doubles the CPU cost on dirty ticks otherwise
    // for a no-op (the hash is deterministic).
    const contentHash = ContentHashStore.hashContent(buf);
    if (hashStore.lastAcked(runtimePath) !== contentHash) {
      save = {
        path: runtimePath,
        contentHash,
        contentBase64: buf.toString("base64"),
      };
      return true;
    }
    return false;
  });
  return save;
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
  // Filesystem impl is injectable so save-pickup tests can register
  // virtual paths without writing real files. Production omits this
  // and uses node:fs.
  fsImpl = fs,
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

  // Fail-fast if the manager spawn pipeline didn't inject the HS256
  // verify secret. Its absence under USE_MANAGER_SAVE=true is config
  // drift, not normal operation — we'd rather refuse to start than
  // tick under an unverifiable token (per manager ADR 0010 +
  // deliberation-lab#109).
  if (!process.env.JWT_VERIFY_SECRET) {
    throw new Error(
      "JWT_VERIFY_SECRET env var is required when USE_MANAGER_SAVE=true; the manager's serviceCreate pipeline injects it (per manager ADR 0010 + deliberation-lab#109)",
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

  // Registered output files — runtime-relative path → { diskPath }.
  // Callbacks-side wiring registers the runtime's tracked output
  // files (science.jsonl, payment.jsonl, preregistration.jsonl,
  // postFlightReport.jsonl) once at batch init. The tick scheduler
  // walks this map on each tick to pick an eligible save.
  const outputs = new Map();

  const onTick = async () => {
    const save = pickEligibleSave({ outputs, hashStore, fsImpl });
    const payload = buildTickPayload({
      sequence: nextSequence,
      status,
      ctx: getCtxFn(),
      save,
    });
    const result = await client.send(payload);
    if (result.outcome === "acked") {
      // Save committed: record the hash so the next tick won't
      // re-emit the same content. Done BEFORE the sequence-advance
      // logic so a sequence-mismatch resync still records the ack.
      // (The manager dedupes on `(instance_id, path, contentHash)`,
      // so a redundant resend would be a no-op on its side, but
      // not recording wastes a tick slot.)
      if (payload.save) {
        hashStore.recordAck(payload.save.path, payload.save.contentHash);
      }
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
      // non-JSON / non-conformant response. The cursor advances
      // (next tick uses a fresh sequence) and Sentry captures the
      // full context. Per manager interface-contract.md §"Error
      // surfacing: two pipelines" these are platform-developer-
      // actionable; the researcher can't fix them and shouldn't
      // see them.
      //
      // We do NOT record the save's hash on `discarded`. The
      // tick-response contract is "hash advances only on ok:true"
      // (see ContentHashStore.recordAck JSDoc + manager ADR 0005
      // §"Ack semantics"). Some `discarded` causes are transient
      // (manager mid-deploy returns non-JSON for a bit; a
      // `INVALID_TICK_RESPONSE` from a contract-version skew that
      // gets fixed by a redeploy), and silently advancing the hash
      // would drop those saves on the floor. The trade-off is that
      // a *persistently* rejected save (e.g. exceeds a manager-
      // side size cap) will re-emit on every tick until manual
      // intervention; Sentry's per-tick capture surfaces the loop
      // for triage. If/when this becomes a real problem, a
      // separate "rejected hashes" mechanism keyed on specific
      // permanent-rejection codes is the cleaner answer than
      // conflating with `acked`.
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
    outputs,
    getSequence: () => nextSequence,
    setCtx: (ctx) => {
      getCtxFn = () => ctx;
    },
    setGetCtx: (fn) => {
      getCtxFn = fn;
    },
    // Register a tracked output file. `runtimePath` is the runtime-
    // relative path the manager will see on the tick `save.path`
    // (e.g. "science.jsonl"); the manager prepends its per-Batch
    // destination prefix before committing. `diskPath` is the
    // absolute filesystem location the runtime writes to (e.g.
    // ${DATA_DIR}/batch_xxx.scienceData.jsonl). The tick scheduler
    // reads from disk on every tick — no in-memory copy of the
    // file's content is held — so post-write changes are picked up
    // automatically without a separate "mark dirty" call.
    //
    // Path validation is intentionally STRICTER than the
    // `tickSave.path` contract (contracts/tick.mjs's
    // `safeRelativePath`): the contract forbids leading `/` and
    // `.`/`..` segments; we additionally reject empty segments
    // (e.g. `foo//bar.jsonl`). Empty segments are a registration-
    // time mistake — most filesystems normalize them away on read,
    // so the runtime would silently send under one path and the
    // researcher would expect another. Catching at registration
    // surfaces the bug at the call site; the contract-level checks
    // are still defense-in-depth at send time.
    //
    // Duplicate registrations throw rather than silently overwrite
    // — output paths are static for the Instance lifetime; a
    // double-register indicates a bootstrap bug (e.g. test pollution
    // or a callbacks-side handler firing twice).
    registerOutput: ({ runtimePath, diskPath }) => {
      if (!runtimePath || !diskPath) {
        throw new Error(
          "registerOutput: both runtimePath and diskPath are required",
        );
      }
      if (
        runtimePath.startsWith("/") ||
        runtimePath
          .split("/")
          .some((seg) => seg === "" || seg === "." || seg === "..")
      ) {
        throw new Error(
          `registerOutput: runtimePath "${runtimePath}" must be safe-relative — no leading slash, no "." or ".." segments, no empty segments (mirrors tickSave.path schema)`,
        );
      }
      if (outputs.has(runtimePath)) {
        throw new Error(
          `registerOutput: runtimePath "${runtimePath}" is already registered (was ${outputs.get(runtimePath).diskPath}; tried to set ${diskPath}). Output paths are static for the Instance lifetime.`,
        );
      }
      outputs.set(runtimePath, { diskPath });
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

// Register a tracked output file with the manager runtime. No-op in
// solo-dev mode (legacy direct-Octokit save path keeps running).
// Callbacks-side wiring uses this once per output file at batch init,
// so the tick scheduler can pick up changes from disk automatically.
//
// If `USE_MANAGER_SAVE=true` AND `cachedRuntime` is null, that's a
// bootstrap order bug: the runtime should have been initialized by
// now. Throwing surfaces the bug at the call site rather than
// letting the registration silently no-op (which would leave the
// runtime ticking with no save payloads — the manager would receive
// heartbeats but no data, and BL-14 verification would never fire).
export function registerOutput({ runtimePath, diskPath }) {
  if (cachedRuntime) {
    cachedRuntime.registerOutput({ runtimePath, diskPath });
    return;
  }
  if (isManagerLaunched()) {
    throw new Error(
      `registerOutput("${runtimePath}", "${diskPath}") called under USE_MANAGER_SAVE=true but the manager runtime hasn't been initialized. Call \`initManagerRuntime()\` at server boot before any callbacks-side registration.`,
    );
  }
}

// Test-only: drop the cached runtime so subsequent inits start
// fresh. Production code should never call this — exposed under a
// distinct name so it's grep-able when auditing for accidental
// production use.
export function resetManagerRuntimeForTests() {
  cachedRuntime?.scheduler?.stop?.();
  cachedRuntime = null;
}
