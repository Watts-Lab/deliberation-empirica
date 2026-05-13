// Sentry init MUST be the first import — see instrument.js. ESM
// imports hoist in order, so anything that throws at module-eval
// time (transitive deps of ./callbacks, for example) is captured
// once Sentry has been initialized here.
import "./instrument";

import { AdminContext } from "@empirica/core/admin";
import { info, setLogLevel, error } from "@empirica/core/console";
import {
  Classic,
  classicKinds,
  ClassicLoader,
} from "@empirica/core/admin/classic";
import minimist from "minimist";
import process from "process";
import { Empirica } from "./callbacks";
import {
  captureLifecycleError,
  flushSentry,
  normalizeRejectionReason,
} from "./sentryLifecycleCapture";

const argv = minimist(process.argv.slice(2), { string: ["token"] });

setLogLevel(argv.loglevel || "info");

(async () => {
  try {
    const ctx = await AdminContext.init(
      argv.url || "http://localhost:3000/query",
      argv.sessionTokenPath,
      "callbacks",
      argv.token,
      {},
      classicKinds,
    );

    ctx.register(ClassicLoader); // subscribes to players and batches
    ctx.register(
      Classic({
        disableAssignment: true,
        disableGameCreation: true,
        disableBatchAutoend: true,
      }),
    );
    ctx.register(Empirica);
    ctx.register((_) => {
      _.on("ready", () => {
        info("callbacks: started");
      });
    });
  } catch (err) {
    // `AdminContext.init` and the register() chain run before any
    // `Empirica.on("start")` handler fires — failures here never
    // reach the callback try/catch. Without this wrap, a Tajriba
    // connect failure / schema-init throw exits via the
    // unhandledRejection handler with no flush, and the event dies
    // in the runtime image. Per #183.
    //
    // We `process.exit(1)` here rather than re-throwing: an
    // unhandled rejection on the IIFE would route through the
    // `unhandledRejection` handler below and double-capture under a
    // different stage tag. A hard exit after flush is the only path
    // that produces exactly one Sentry event for one bootstrap
    // failure.
    error("Error during runtime bootstrap:", err);
    try {
      await captureLifecycleError(err, { stage: "runtime-bootstrap" });
    } catch (captureErr) {
      console.error("Sentry capture during bootstrap failed:", captureErr);
    }
    process.exit(1);
  }
})();

// Process-level safety net. Each handler:
//   1. Logs to stderr so the failure is visible in container logs even
//      if Sentry is down.
//   2. Captures + flushes (bounded) so the event lands before exit.
//   3. Wraps the capture in try/catch so a Sentry-side failure can't
//      cascade through the listener's returned promise back into the
//      `unhandledRejection` handler (which would loop on the same
//      Sentry call that just failed).
//   4. Calls `process.exit(...)` explicitly. Setting `process.exitCode`
//      alone isn't enough — a long-running server with active Empirica
//      websockets + manager-tick intervals never drains its event
//      loop, so the process would stay running in a corrupted state
//      (Node docs warn against this for `uncaughtException`
//      specifically; we mirror the posture for `unhandledRejection`
//      since neither is recoverable here).
process.on("uncaughtException", async (err) => {
  console.error("Uncaught Exception:", err);
  try {
    await captureLifecycleError(err, { stage: "uncaughtException" });
  } catch (captureErr) {
    console.error(
      "Sentry capture during uncaughtException failed:",
      captureErr,
    );
  }
  process.exit(1);
});

process.on("unhandledRejection", async (reason) => {
  console.error("Unhandled Promise Rejection. Reason: ", reason);
  try {
    await captureLifecycleError(normalizeRejectionReason(reason), {
      stage: "unhandledRejection",
    });
  } catch (captureErr) {
    console.error(
      "Sentry capture during unhandledRejection failed:",
      captureErr,
    );
  }
  process.exit(1);
});

// SIGTERM is Railway's pod-shutdown signal. Without flushing here,
// any captures queued in the last ~2s of process life (e.g. a
// `reportTerminalError` that fired moments before manager's
// `failSpawn` deleted the service) get dropped when Node exits.
// Railway gives us a bounded grace window after SIGTERM before
// SIGKILL — 2s flush is well inside it.
//
// Re-entrant guard: orchestrators can deliver SIGTERM more than once
// during a slow shutdown; without the guard, two flushes run in
// parallel and both call `process.exit`, which races. Exit 143 (=
// 128 + SIGTERM signal 15) is the Unix convention for "killed by
// SIGTERM" and keeps manager-side failure-detection from mistaking
// a signaled shutdown for a clean one.
let sigtermInProgress = false;
process.on("SIGTERM", async () => {
  if (sigtermInProgress) return;
  sigtermInProgress = true;
  info("Received SIGTERM, flushing Sentry then exiting");
  try {
    await flushSentry();
  } catch (flushErr) {
    console.error("Sentry.flush during SIGTERM failed:", flushErr);
  }
  process.exit(143);
});
