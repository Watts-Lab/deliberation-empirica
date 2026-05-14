/* eslint-disable no-use-before-define */
/* eslint-disable no-restricted-syntax */

import * as fs from "fs";
import * as Sentry from "@sentry/node";
import { TajribaEvent } from "@empirica/core/admin";
import { ClassicListenersCollector } from "@empirica/core/admin/classic";
import { error, warn, info, log } from "@empirica/core/console";
import { promptFileSchema } from "stagebook";
import {
  closeRoom,
  createRoom,
  dailyCheck,
  stopRecording,
} from "./providers/dailyco";
import { makeDispatcher } from "./preFlight/dispatch";
import { getTreatments } from "./getTreatments";
import { getParticipantData } from "./postFlight/exportParticipantData";
import { preregisterSample } from "./preFlight/preregister";
import { exportScienceData } from "./postFlight/exportScienceData";
import {
  exportPaymentData,
  printPaymentData,
} from "./postFlight/exportPaymentData";
import {
  toArray,
  selectOldestBatch,
  getOpenBatches,
  isArrayOfStrings,
} from "./utils";
import { makeRecordingsFolder } from "./utils/recordingsFolder";
import { getQualtricsData } from "./providers/qualtrics";
import { getEtherpadText, createEtherpad } from "./providers/etherpad";
import { fetchAssetText } from "./utils/fetchAssetText";
import { buildSharedNotepadRecord } from "./postFlight/sharedNotepadRecord";
import {
  validateBatchConfig,
  ValidationError,
} from "./preFlight/validateBatchConfig.ts";
import { extractBatchConfig } from "./preFlight/extractBatchConfig.ts";
import { shouldCreateDispatcher } from "./preFlight/dispatcherGate.ts";
import {
  checkGithubAuth,
  pushDataToGithub,
  validateConfigReposAccess,
} from "./providers/github";
import { postFlightReport } from "./postFlight/postFlightReport";
import { checkRequiredEnvironmentVariables } from "./preFlight/preFlightChecks";
import {
  isManagerLaunched,
  initManagerRuntime,
  registerOutput,
  setCtx as setManagerCtx,
  setStatus as setManagerStatus,
  startTicking,
} from "./manager/index.mjs";
import { advanceManagerStatusOnBatchStatusChange } from "./manager/batchStatusBridge.mjs";
import { reportTerminalError } from "./manager/reportTerminalError.mjs";
import { enrichErrorForReport } from "./manager/enrichErrorForReport.mjs";
import { makeManagerRuntimeLogger } from "./manager/runtimeLogger.mjs";
import { logPlayerCounts } from "./utils/logging";
import { captureLifecycleError } from "./sentryLifecycleCapture";

export const Empirica = new ClassicListenersCollector();

const dispatchers = new Map(); // keys are batch ids, values are dispatcher functions for that batch
const dispatchTimers = new Map(); // keys are batch ids, values are timer objects unique to the batch
const playersForParticipant = new Map();
const paymentIDForParticipantID = new Map();
const online = new Map();
const gamesStarted = new Set();

// `enrichErrorForReport` + `scrubUrl` live in
// `./manager/enrichErrorForReport.mjs` — extracted so they're
// directly unit-testable without pulling this file's Empirica /
// Tajriba transitive deps.

// ------------------- Server start callback ---------------------

Empirica.on("start", async () => {
  try {
    checkRequiredEnvironmentVariables();
    // GitHub auth is the solo-dev save path. Under
    // USE_MANAGER_SAVE=true the legacy `DELIBERATION_MACHINE_USER_TOKEN`
    // is FORBIDDEN by `managerLaunchedEnv` (preflight rejects its
    // presence as configuration drift) — calling `checkGithubAuth`
    // here would always emit a noisy "token not set" warning under
    // manager mode. Skip it; the manager owns the data destination.
    if (!isManagerLaunched()) {
      await checkGithubAuth();
    }
    // Bootstrap the manager-runtime tick channel under
    // USE_MANAGER_SAVE=true. No-op in solo-dev mode (returns null
    // and no ticks fire). Started AFTER env preflight so a broken
    // manager-mode env fails loudly via the schema check rather
    // than tripping `JWT_VERIFY_SECRET required` from inside the
    // bootstrap. `startTicking` is also a no-op when the runtime
    // wasn't initialized, keeping solo-dev unaffected.
    //
    // Per-batch `setCtx(ctx)` happens in `Empirica.on("batch")`
    // below; until then the tick payload omits `state.participants`,
    // which is contract-valid (the field is optional).
    //
    // Pass through the runtime's existing console logger so each tick
    // result (acked / retry / discarded / fetch-failed) and any
    // `lastUsedAt` write failures are visible in the runtime's own
    // log stream. Without this, every `logger?.info?.(...)` /
    // `logger?.warn?.(...)` call inside `initManagerRuntime` no-ops
    // — which masked a production bug surfaced 2026-05-08 where
    // ticks were silently failing (manager observed `lastTickAt: null`,
    // runtime emitted no log lines).
    //
    // `initManagerRuntime` calls its logger with the pino-style
    // `(obj, msg)` arity. `@empirica/core/console`'s `info`/`warn`/
    // `error` are variadic (`(...args)`) — they'll *accept* that
    // arity without throwing, but they'd emit the object and the
    // message as two unrelated positional args, losing the
    // human-readable message. `makeManagerRuntimeLogger` is the
    // adapter: it joins `(obj, msg)` into a single `<msg> <json>`
    // string before forwarding to the console.
    initManagerRuntime({
      logger: makeManagerRuntimeLogger({ info, warn, error }),
    });
    startTicking();
  } catch (err) {
    // Env-validation failure (preFlightChecks throw), legacy-GitHub
    // auth failure, or manager-runtime bootstrap failure
    // (initManagerRuntime throws on missing MANAGER_INSTANCE_TOKEN /
    // JWT_VERIFY_SECRET) all funnel through here. Pre-#183 the catch
    // only logged via `error()` — events died with the container.
    // Capture+flush so the runtime image's "silent SIGTERM" stops
    // being a class of incident.
    error("Error starting server:", err);
    await captureLifecycleError(err, { stage: "server-start" });
  }

  info("Startup sequence complete");
  info(`Test Controls are: ${process?.env?.TEST_CONTROLS}`);
});

// ------------------- Batch callbacks ---------------------------
// Batch lifecycle:
// 1. Batch Created (batch.get("status") === "created")
// 2. Batch Started (batch.get("status") === "running")
// 3. Batch "Launched"
// 4. Batch no longer accepting players (batch.get("afterLastEntry") === true)
// 5. Batch Closed (batch.get("status") === "terminated")
// Batches can also be "failed"
// Currently not using status "closed" (change on upgrade empirica https://github.com/empiricaly/empirica/issues/213)

Empirica.on("batch", async (ctx, { batch }) => {
  // Hand the AdminContext to the manager runtime so subsequent
  // ticks can derive participant progression via
  // summarizePlayerProgression(ctx). Idempotent — `setCtx` just
  // updates a closure-captured reference. No-op in solo-dev mode.
  setManagerCtx(ctx);

  // Batch created
  // When batch is first created:
  // - load and validate treatments
  // - check that all of the data/resources that will be needed are accessible

  // Ideally, we should find and raise any issues with
  // the treatment, assets, or config here,
  // before the batch is even started.

  // Note that because this is async, other things can be happening in the background,
  // for instance, the admin starts the game. this can put the game in a bad state,
  // if it is depending on this to be done first.

  // Empirica's "config" attribute carries either the classic-admin
  // wrapper `{config, ...other}` (solo-dev) or the synthesized config
  // directly (manager-launched, per deliberation-lab/manager
  // src/lib/spawn.ts). `extractBatchConfig` discriminates by the same
  // `study_id` sentinel `validateBatchConfig` uses and returns the
  // inner config either way; `validateBatchConfig` then picks the
  // right schema for the discriminated shape.
  const unvalidatedConfig = extractBatchConfig(batch.get("config"));

  if (!batch.get("initialized")) {
    try {
      const config = validateBatchConfig(unvalidatedConfig);
      batch.set("validatedConfig", config);
      batch.set("name", config?.batchName);

      // Manager-launched batches arrive with `assetsRepoSha` pre-
      // computed (per ADR 0009 — manager pins the connected repo's
      // SHA at SS-10/SS-11/fork). Solo-dev researchers may supply it
      // for data-export reproducibility but aren't required to; if
      // absent we stamp "unknown" rather than reaching for a hard-
      // coded GitHub-API lookup of an unrelated assets repo.
      batch.set("assetsRepoSha", config.assetsRepoSha ?? "unknown");

      const checkVideo = config?.checkVideo ?? true; // default to true if not specified
      const checkAudio = (config?.checkAudio ?? true) || checkVideo; // default to true if not specified, force true if checkVideo is true
      if (checkVideo || checkAudio) {
        // create daily room to check we can write to the video storage bucket
        await dailyCheck(`test_${batch.id}`.slice(0, 20), config.videoStorage);
      }

      const { introSequence, treatments } = await getTreatments({
        assetBaseUrl: config.assetBaseUrl,
        path: config.treatmentFile,
        treatmentNames: config.treatments,
        introSequenceName: config.introSequence,
      });
      batch.set("treatments", treatments);
      batch.set("introSequence", introSequence);

      const timeInitialized = new Date(Date.now()).toISOString();
      batch.set("timeInitialized", timeInitialized);

      try {
        if (config.launchDate !== "immediate") {
          const launchDate = new Date(config.launchDate);
          log(
            `Batch ${config.batchName} will launch in ${
              (launchDate - Date.now()) / 1000 / 60
            } minutes at ${config.launchDate}`,
          );
        }
      } catch (err) {
        error(`Error parsing launch date ${config.launchDate}:`, err);
      }

      const batchLabel = `${timeInitialized
        .replaceAll(/-|:|\./g, "")
        .replace("T", "_")
        .slice(0, 13)}_${config?.batchName}`;
      batch.set("label", batchLabel);

      // set filenames for storing data
      const scienceDataFilename = `${process.env.DATA_DIR}/batch_${batchLabel}.scienceData.jsonl`;
      batch.set("scienceDataFilename", scienceDataFilename);
      fs.closeSync(fs.openSync(scienceDataFilename, "a")); // create an empty datafile

      const preregistrationDataFilename = `${process.env.DATA_DIR}/batch_${batchLabel}.preregistration.jsonl`;
      batch.set("preregistrationDataFilename", preregistrationDataFilename);

      const paymentDataFilename = `${process.env.DATA_DIR}/batch_${batchLabel}.payment.jsonl`;
      batch.set("paymentDataFilename", paymentDataFilename);

      const postFlightReportFilename = `${process.env.DATA_DIR}/batch_${batchLabel}.postFlightReport.jsonl`;
      batch.set("postFlightReportFilename", postFlightReportFilename);

      if (isManagerLaunched()) {
        // Manager-launched mode: register the output files with the
        // tick scheduler. Each tick reads the current content from
        // disk, hashes it, and rides one dirty file as the tick's
        // `save` payload (manager ADR 0005 §"Pass-through data flow").
        // No need for explicit GitHub-repo validation or a test
        // push — the manager validated repo access at App-install
        // time and owns the data destination. Per-batch
        // preregRepos/dataRepos are absent from the synthesized
        // batch config in this mode.
        //
        // NOTE: `payment.jsonl` is registered here even though the
        // legacy direct-Octokit path never pushed payment data —
        // solo-dev mode writes payment to disk but never elsewhere.
        // Manager mode exports four files where solo-dev pushed
        // three; the manager's destination commits payment data
        // alongside the others. This is intentional per ADR 0005
        // (payment is participant-deliverable evidence and belongs
        // in the data manifest).
        registerOutput({
          runtimePath: "scienceData.jsonl",
          diskPath: scienceDataFilename,
        });
        registerOutput({
          runtimePath: "preregistration.jsonl",
          diskPath: preregistrationDataFilename,
        });
        registerOutput({
          runtimePath: "payment.jsonl",
          diskPath: paymentDataFilename,
        });
        registerOutput({
          runtimePath: "postFlightReport.jsonl",
          diskPath: postFlightReportFilename,
        });
      } else {
        await validateConfigReposAccess({ config });
        // Now test write access by attempting to push a test file
        // to GitHub. This validates write permissions and actual
        // file operations against the per-batch researcher-specified
        // dataRepos. Only meaningful in solo-dev mode — in manager
        // mode the manager owns this gate.
        await pushDataToGithub({
          batch,
          delaySeconds: 0,
          throwErrors: true,
        });
      }

      batch.set("initialized", true);
      info(`Initialized Batch ${config.batchName} at ${timeInitialized}`);
    } catch (err) {
      // FAILS HERE
      error(
        `Failed to create batch with config:`,
        JSON.stringify(unvalidatedConfig),
        err,
      );
      batch.set("status", "failed");
      // Surface to the manager via the tick channel so the
      // researcher's dashboard sees the failure within seconds
      // rather than after the next 60s heartbeat. No-op in
      // solo-dev mode (no runtime cached, no tick channel).
      //
      // Discriminate kind so the manager routes correctly:
      // `ValidationError` (researcher mistyped a treatment YAML or
      // batch-config field) → `validation` → friendly renderer in
      // the researcher dashboard. Everything else (provider
      // unreachable, GitHub auth, internal bug) → `platform-error`
      // → platform-team Sentry triage. Per
      // contracts/tick.mjs:77-79 + manager interface-contract.md
      // §"Error surfacing: two pipelines".
      //
      // Stack truncated at 4 KB — manager treats `details` as
      // opaque so there's no schema cap, and a deep async stack
      // can run 10–30 KB which bloats the wire payload pointlessly.
      const isValidation = err instanceof ValidationError;
      const enriched = enrichErrorForReport(err);
      // Platform-errors get a Sentry event with the full stack +
      // contextual tags so the on-call can triage without having
      // to grep the container logs (which are gone by the time the
      // manager's failSpawn deletes the service). Validation
      // errors stay out of Sentry — they're researcher mistakes
      // surfaced cleanly in the dashboard, not platform-team
      // signal. The manager-facing `reportTerminalError` payload
      // is unchanged either way.
      if (!isValidation) {
        Sentry.captureException(err, {
          tags: {
            code: "BATCH_INIT_FAILED",
            batchId: batch.id,
            runtimeImageTag: process.env.CONTAINER_IMAGE_VERSION_TAG,
          },
          contexts: {
            batchConfig: {
              batchName: unvalidatedConfig?.batchName,
              treatmentFile: unvalidatedConfig?.treatmentFile,
              treatments: unvalidatedConfig?.treatments,
              instanceId: unvalidatedConfig?.instance_id,
              studyId: unvalidatedConfig?.study_id,
            },
            ...(enriched.httpContext ? { http: enriched.httpContext } : {}),
          },
        });
        // captureException queues but doesn't flush. The manager's
        // failSpawn deletes the runtime service within seconds of
        // a terminal-error tick landing, so the buffered Sentry
        // event would be lost when the container dies. Bounded
        // wait for the flush — these are exactly the events we
        // can least afford to lose.
        await Sentry.flush(2000);
      }
      await reportTerminalError({
        code: isValidation ? "INVALID_BATCH_CONFIG" : "BATCH_INIT_FAILED",
        kind: isValidation ? "validation" : "platform-error",
        message: enriched.message,
        batchId: batch.id,
        details: {
          stack: err?.stack?.slice(0, 4096),
          ...(enriched.httpContext ? { http: enriched.httpContext } : {}),
        },
      });
    }
  }

  // this bit will run on a server restart or on batch creation.
  //
  // Three initial-status shapes arrive here, all of which must
  // create the dispatcher:
  //
  //  - `"initializing"` — handshake-aware manager (post-#203):
  //    addScopes writes `config` + `status="initializing"`
  //    atomically; status flips to "running" later via
  //    setAttributes, AFTER the manager observes our
  //    `runtimeReady` signal.
  //  - `undefined` — pre-handshake manager OR a manager that has
  //    not yet been redeployed against this runtime: addScopes
  //    writes only `config`. The gate must still create the
  //    dispatcher in this case to keep backward compat working.
  //  - `"created"` — solo-dev (classic-admin's CreateBatch UI sets
  //    status atomically with config).
  //
  // `shouldCreateDispatcher` admits all three (and "running" on
  // server restart); only `"terminated"`/`"failed"` are excluded.
  // See deliberation-lab/deliberation-lab#162 +
  // deliberation-lab/manager#203 for the cross-repo design.
  const config = batch.get("validatedConfig");
  if (
    shouldCreateDispatcher({
      status: batch.get("status"),
      hasDispatcher: dispatchers.has(batch.id),
    })
  ) {
    try {
      dispatchers.set(
        batch.id,
        makeDispatcher({
          treatments: batch.get("treatments"),
          payoffs: config?.payoffs || undefined,
          knockdowns: config?.knockdowns || undefined,
          requiredFractionOfMaximumPayoff:
            config?.requiredFractionOfMaximumPayoff || 0.9,
          maxIter: config?.dispatchMaxIter || 3000,
          minIter: config?.dispatchMinIter || 100,
        }),
        // todo: the dispatcher is stateful in that the payoffs get updated,
        // but currently we don't save the payoffs outside the closure,
        // so a server restart will reset the payoffs.
      );

      // Signal the manager (and any other observer) that this
      // batch is fully initialized: config validated, treatments
      // resolved, dispatcher in place. The manager-side spawn
      // pipeline subscribes to this attribute and only flips
      // status="running" once it's true (see
      // deliberation-lab/manager#203). Idempotent — server
      // restarts re-enter this block and re-set to true, which
      // is a no-op on the wire.
      //
      // This must be set AFTER `dispatchers.set` succeeds. The
      // ordering is what makes the handshake meaningful: if
      // `makeDispatcher` throws, the catch logs "Failed to set
      // dispatcher" and `runtimeReady` stays unset, so the
      // manager never admits players to a broken batch.
      batch.set("runtimeReady", true);
    } catch (err) {
      error(`Failed to set dispatcher of existing batch with id ${batch.id}`);
      error(err);
      // Per #164: surface dispatcher-construction failure to the
      // manager handshake. The failure happens inside
      // `makeDispatcher` (or, less commonly, `dispatchers.set`);
      // control jumps here BEFORE `batch.set("runtimeReady", true)`
      // executes, so runtimeReady stays unset — that part of the
      // handshake works correctly. The gap is on the status side:
      // status stays at whatever the manager wrote at addScopes
      // ("initializing"), so the manager hits a generic
      // RUNTIME_READY_TIMEOUT instead of a structured
      // RUNTIME_INIT_FAILED. Setting status to "failed" + emitting
      // a terminal-error tick routes the manager to the same
      // surfaced-error path as a config-validation failure (the
      // existing batch-init catch above). Mirrors that pattern.
      batch.set("status", "failed");
      // Always platform-error here — dispatcher construction is
      // internal (`makeDispatcher` in preFlight/dispatch), not
      // researcher-supplied config. Capture to Sentry with the
      // same tag shape as the batch-init catch above so a single
      // triage workflow covers both.
      const enrichedDispatch = enrichErrorForReport(err);
      Sentry.captureException(err, {
        tags: {
          code: "DISPATCHER_INIT_FAILED",
          batchId: batch.id,
          runtimeImageTag: process.env.CONTAINER_IMAGE_VERSION_TAG,
        },
        contexts: {
          batchConfig: {
            batchName: config?.batchName,
            treatmentFile: config?.treatmentFile,
            // Project to just names — `batch.get("treatments")`
            // returns resolved Treatment objects which can be
            // MB-scale (full stage/element trees) and we only need
            // identity for triage. unvalidatedConfig's
            // `treatments` field is already a string[].
            treatments: Array.isArray(batch.get("treatments"))
              ? batch
                  .get("treatments")
                  .map((t) => (typeof t === "string" ? t : t?.name))
                  .filter(Boolean)
              : undefined,
            instanceId: config?.instance_id,
            studyId: config?.study_id,
          },
          ...(enrichedDispatch.httpContext
            ? { http: enrichedDispatch.httpContext }
            : {}),
        },
      });
      // Bounded flush before the manager's failSpawn potentially
      // deletes the service. See the batch-init catch above.
      await Sentry.flush(2000);
      await reportTerminalError({
        code: "DISPATCHER_INIT_FAILED",
        kind: "platform-error",
        message: enrichedDispatch.message,
        batchId: batch.id,
        details: {
          stack: err?.stack?.slice(0, 4096),
          ...(enrichedDispatch.httpContext
            ? { http: enrichedDispatch.httpContext }
            : {}),
        },
      });
    }
  }
});

Empirica.on("batch", "status", async (ctx, { batch, status }) => {
  info(`Batch ${batch.id} changed status to "${status}"`);

  try {
    if (status === "terminated" || status === "failed") {
      await closeBatch({ ctx, batch });
      setCurrentlyRecruitingBatch({ ctx });
    }

    if (status === "running") {
      setCurrentlyRecruitingBatch({ ctx });
    }
  } finally {
    // Bridge batch.status → manager-runtime TickStatus (per dl#158).
    // Wrapped in `finally` so a `closeBatch` rejection STILL drives
    // the tick stream forward — without this, an exception during
    // post-flight would leave the runtime emitting
    // `status: "running"` forever and re-introduce the orphan-
    // service problem the bridge exists to fix. The mapping
    // (terminated → draining, failed → failed) lives in the helper
    // so the (batch-status → tick-status) contract has a unit-test
    // surface that doesn't require Empirica's
    // ClassicListenersCollector. No-op when the manager runtime
    // isn't initialized (solo-dev mode) — the `setStatus` import
    // itself guards on `cachedRuntime`.
    advanceManagerStatusOnBatchStatusChange({ status, setManagerStatus });
  }
});

function setCurrentlyRecruitingBatch({ ctx }) {
  // select the oldest batch as the currently recruiting one.
  // If there are none open, set recruiting batch to undefined

  const openBatches = getOpenBatches(ctx);
  if (openBatches.length === 0) {
    warn("No open batches. Resetting recruiting batch.");
    ctx.globals.set("recruitingBatchConfig", undefined);
    ctx.globals.set("recruitingBatchIntroSequence", undefined);
    return;
  }

  const batch = selectOldestBatch(openBatches);
  if (!batch.get("initialized")) {
    batch.set("status", "failed");
    error(
      `Batch ${batch.id} was not finished initializing, setting status to failed. Try again.`,
    );
    // Same out-of-band error reporting as the batch-init catch:
    // surface the failure to the manager immediately. Different
    // code so manager-side dashboards can distinguish "init threw"
    // from "init never finished before the server picked the
    // batch up again on restart."
    reportTerminalError({
      code: "BATCH_NOT_INITIALIZED",
      message: `Batch ${batch.id} was not finished initializing on server restart`,
      batchId: batch.id,
    }).catch((reportErr) => {
      error("reportTerminalError itself failed:", reportErr);
    });
  }
  const config = batch?.get("validatedConfig");
  const introSequence = batch?.get("introSequence");
  if (config.introSequence !== "none" && !introSequence) {
    error("Error: expected intro sequence but none found");
  }
  info(`Currently recruiting for batch: ${batch?.get("label")}`);
  info("batch config: ", config);
  // info("batch introSequence: ", introSequence);

  // Hydrate a single `cdnURL` field on the client-facing config from
  // the per-batch `assetBaseUrl`. The client treats it as the asset-
  // resolution prefix and doesn't need to know how it was provisioned
  // (researcher-supplied in solo-dev, manager-mirrored S3 in multi-
  // tenant — same shape either way).
  const configWithCdnURL = {
    ...config,
    cdnURL: config.assetBaseUrl,
  };
  ctx.globals.set("recruitingBatchConfig", configWithCdnURL);
  ctx.globals.set("recruitingBatchIntroSequence", introSequence);
}

async function closeBatch({ ctx, batch }) {
  // close out players, shut down batch
  info(`Closing batch ${batch.id}`);
  const games = ctx.scopesByKind("game");
  const batchPlayers = ctx.scopesByKindMatching("player", "batchId", batch.id);
  if (!batchPlayers) {
    warn(`No players found to close for batch ${batch.id}`);
    return;
  }

  await Promise.all(
    batchPlayers?.map(async (player) => {
      if (!player.get("closedOut")) {
        // only run once
        player.set("exitStatus", "incomplete");
        const game = games?.get(player.get("gameId"));
        await closeOutPlayer({ player, batch, game });
        log(`Closing incomplete player ${player.id}.`);
      }
    }),
  );

  await postFlightReport({ batch });
  printPaymentData({ batch });

  dispatchTimers.delete(batch.id);
  info(`Batch ${batch.id} closed`);
  logPlayerCounts(ctx);
}

// ------------------- Game callbacks ---------------------------
// Game lifecycle

Empirica.on("game", async (ctx, { game }) => {
  if (game.get("initialized") || game.get("status") === "failed") return;
  // on game created
  // add indicated players to game, then start it

  try {
    const players = ctx.scopesByKind("player");
    const startingPlayersIds = toArray(game.get("startingPlayersIds"));
    if (!isArrayOfStrings(startingPlayersIds)) {
      error("startingPlayerIds not array of strings. got", startingPlayersIds);
    }
    for (const id of startingPlayersIds) {
      if (players.has(id)) {
        const player = players.get(id);
        player.set("gameId", game.id);
        // eslint-disable-next-line no-await-in-loop
        await game.assignPlayer(player);
      } else {
        error(`Error: unknown player id ${id}`);
      }
    }

    game.set("initialized", true);
    game.start();
  } catch (err) {
    // if game initialization fails, return participants to subject pool
    // for reassignment, and then rerun dispatcher
    error(`Failed to initialize game with:`);
    error(" - starting players:", toArray(game.get("startingPlayersIds")));
    error("Error:", err);
    scrubGame({ ctx, game });
  }
});

Empirica.on("game", "start", async (ctx, { game, start }) => {
  if (!start) return;
  // prevent this callback from running multiple times for the same batch
  if (gamesStarted.has(game.id)) {
    warn(
      `Game ${game.id} already started, skipping second game start callback`,
    );
    return;
  }
  gamesStarted.add(game.id);

  warn(
    `Game ${game.id} on game start callback. Now: ${new Date(
      Date.now(),
    ).toISOString()}, started: ${game.get("timeGameStarted")}`,
  );
  // on game start
  try {
    const { players } = game;
    const treatment = game.get("treatment");
    const { gameStages } = treatment;
    const batches = ctx.scopesByKind("batch");
    const batch = batches.get(players[0].get("batchId"));
    const config = batch.get("validatedConfig");

    players.forEach((player) => {
      preregisterSample({ player, batch, game });
    });

    const round = game.addRound({ name: "main" });
    gameStages.forEach((stage) => round.addStage(stage));

    const checkVideo = config?.checkVideo ?? true; // default to true if not specified
    const checkAudio = (config?.checkAudio ?? true) || checkVideo; // default to true if not specified, force true if checkVideo is true
    if (checkVideo || checkAudio) {
      info("Creating daily room for game", game.id);
      const roomName = makeRecordingsFolder(batch.get("label"), game.id);
      game.set("recordingsFolder", roomName);
      const room = await createRoom(roomName, config.videoStorage);
      game.set("dailyUrl", room?.url);
      game.set("dailyRoomName", room?.name);
      game.set("recordingEnabled", config.videoStorage !== "none");
    }

    game.set("timeGameStarted", new Date(Date.now()).toISOString());
    info(`Game is now starting with players ${players.map((p) => p.id)}`);
  } catch (err) {
    error(`Failed to start game: ${game.id}`, err);
    scrubGame({ ctx, game });
  }
});

Empirica.on("game", "ended", async (ctx, { game, ended }) => {
  if (!ended) return;

  game.set("timeGameEnded", new Date(Date.now()).toISOString());
  const { players } = game;
  players.forEach((player) => {
    if (player.get("connected")) player.set("gameFinished", true);
  });

  info("Game ended:", game.id);
  logPlayerCounts(ctx);

  if (game.get("dailyRoomName")) {
    const recordingData = await closeRoom(game.get("dailyRoomName"));
    game.set("recordingsPath", recordingData?.s3Key);
    info(
      `Recordings for game: ${game.id} saved with info ${JSON.stringify(
        recordingData,
      )}`,
    );
  }
});

function scrubGame({ ctx, game }) {
  game.set("status", "failed");
  log(`Game ${game.id} Scrubbed`);

  const players = ctx.scopesByKind("player");
  const startingPlayersIds = toArray(game.get("startingPlayersIds"));
  for (const id of startingPlayersIds) {
    if (players?.has(id)) {
      const player = players?.get(id);
      log(`Resetting player ${player.id}`);
      player?.set("gameId", undefined);
      player?.set("assigned", false);
      player?.set("position", undefined);
    }
  }
  // eslint-disable-next-line prefer-destructuring
  // const batch = game.batch; // this is a "getter", not an attribute ? (does destructuring)
  const { batch } = game;
  debounceRunDispatch({ batch, ctx });
}

// ------------------- Round callbacks ---------------------------

// Empirica.onRoundStart(({ round }) => { });

// Empirica.onRoundEnded(({ round }) => { });

// ------------------- Stage callbacks ---------------------------

// Recording is started client-side via callObject.startRecording() (issue #949).
// stopRecording is called unconditionally for video stages with recording enabled;
// Daily returns 400 (no active recording) harmlessly if nobody joined.
Empirica.onStageEnded(({ stage }) => {
  const discussion = stage?.get("discussion");
  const config = stage.currentGame.batch.get("validatedConfig");

  if (discussion?.chatType === "video" && config.videoStorage !== "none") {
    stopRecording(stage.currentGame.get("dailyRoomName")).catch((err) => {
      error(`Failed to stop recording for stage end: ${err.message}`);
    });
  }
});

// ------------------- Player callbacks ---------------------------

//
// Player connect/disconnect
//
// Todo: update when this issue is resolved: https://github.com/empiricaly/empirica/issues/257
//

function playerConnected(player) {
  player.set("connected", true);
  player.append("connectionHistory", {
    time: new Date(Date.now()).toISOString(),
    connected: true,
  });
  const paymentID = paymentIDForParticipantID.get(player.participantID);
  info(`Player ${paymentID} connected.`);
}

function playerDisconnected(player) {
  player.set("connected", false);
  player.append("connectionHistory", {
    time: new Date(Date.now()).toISOString(),
    connected: false,
  });
  const paymentID = paymentIDForParticipantID.get(player.participantID);
  info(`Player ${paymentID} disconnected.`);
}

Empirica.on(TajribaEvent.ParticipantConnect, async (_, { participant }) => {
  // called for the first time when participants submit their ID
  online.set(participant.id, participant);
  paymentIDForParticipantID.set(participant.id, participant.identifier); // todo: shouldn't need to do this in next emprica version

  const player = playersForParticipant.get(participant.id);
  if (player) {
    playerConnected(player);
  }
});

Empirica.on(TajribaEvent.ParticipantDisconnect, (_, { participant }) => {
  online.delete(participant.id);

  const player = playersForParticipant.get(participant.id);
  if (player) {
    playerDisconnected(player);
  }
});

Empirica.on("player", async (ctx, { player }) => {
  // called for the first time when participants submit their ID
  const participantID = player.get("participantID");

  try {
    const openBatches = getOpenBatches(ctx);

    if (!player.get("initialized") && openBatches.length > 0) {
      // TODO: what should we do to rerun this if the player arrives before a batch is open?
      const batch = selectOldestBatch(openBatches); // assign to oldest open batch
      if (!batch) {
        error("error, have open batches but no batch found:", openBatches);
      }
      const config = batch.get("validatedConfig");

      player.set("batchId", batch.id);
      player.set("batchLabel", batch.get("label"));
      player.set("timeArrived", new Date(Date.now()).toISOString());
      player.set("exitCodes", config.exitCodes);

      // get any data we have on this participant from prior activities
      const platformId = paymentIDForParticipantID?.get(participantID);
      const participantData = await getParticipantData({ platformId });
      player.set("participantData", participantData);

      playersForParticipant.set(participantID, player);
      player.set("initialized", true);
      info(`initialized player ${player.id} in batch ${batch?.id}"`);
      logPlayerCounts(ctx);
    }
  } catch (err) {
    error(`Error initializing player ${participantID}:`, err);
    // Todo: What should we do if this fails? Try again?
  }

  if (online.has(participantID)) {
    playerConnected(player);
  }
});

function runDispatch({ batch, ctx }) {
  dispatchTimers.delete(batch.id);

  try {
    const players = ctx.scopesByKind("player");
    const dispatcher = dispatchers.get(batch.id);

    logPlayerCounts(ctx);

    // work out which players are available to be assigned to games
    const availablePlayers = [];
    players.forEach((player) => {
      if (
        player.get("connected") && // only assign connected players
        player.get("introDone") && // only assign players who completed the intro steps
        !player.get("gameId") && // don't assign players already in a game
        !player.get("assigned") // don't assign players already assigned
      )
        availablePlayers.push(player);
    });

    const { assignments, finalPayoffs } = dispatcher(availablePlayers);
    batch.set("finalPayoffs", finalPayoffs); // save payoffs to export in postFlightReport. Payoffs are maintained in the dispatch closure, so we don't need to use this except for reporting.

    assignments.forEach(({ treatment, positionAssignments }) => {
      batch.addGame([
        {
          key: "treatmentName",
          value: treatment.name,
          immutable: true,
        },
        {
          key: "treatment",
          value: treatment,
          immutable: true,
        },
        {
          key: "startingPlayersIds",
          value: positionAssignments.map((p) => p.playerId),
          immutable: true,
        },
      ]);

      positionAssignments.forEach(({ playerId, position }) => {
        // make sure we don't double-assign players. Can't just use whether they are
        // in a game, because games start async and may take time. This serves as an
        // extra level of protection.
        const player = players.get(playerId);
        player.set("assigned", true);
        player.set("position", position.toString());
        player.set("title", treatment.groupComposition?.[position]?.title);
        // Mirror `treatmentName` from the game scope onto the
        // player scope so `summarizePlayerProgression` can surface
        // it on the per-participant digest (dl#189). The game scope
        // gets `addGame([{key:"treatmentName"}, ...])` above; this
        // copy makes it accessible via `player.get("treatmentName")`
        // without traversing through `player.currentGame`.
        player.set("treatmentName", treatment.name);
      });

      info(
        `Adding game with treatment ${
          treatment.name
        }, players: ${positionAssignments.map((p) => p.playerId)}`,
      );
    });
  } catch (err) {
    error(
      "Error in dispatch or game creation, will try again after 'dispatchWait'.",
      err,
    );
    // eslint-disable-next-line no-use-before-define
    debounceRunDispatch({ batch, ctx });
  }
}

function debounceRunDispatch({ batch, ctx }) {
  if (dispatchTimers.has(batch.id) || batch.get("status") !== "running") return;
  // after trigger, wait {dispatchWait} seconds
  // before running dispatch to see if other players join
  // trigger could be either a player becoming ready, or
  // an error in a previous dispatch that triggers a retry

  try {
    const config = batch.get("validatedConfig");
    const dispatchWait = config?.dispatchWait || 5;
    info(`setting ${dispatchWait} second dispatch timer`);
    dispatchTimers.set(
      batch.id,
      setTimeout(runDispatch, dispatchWait * 1000, { batch, ctx }),
    );
  } catch (err) {
    error(`Uncaught error setting dispatch timer for batch ${batch.id}`);
  }
}

Empirica.on("player", "inCountdown", (ctx, { player, inCountdown }) => {
  if (!inCountdown) return;
  if (!player.get("timeEnteredCountdown")) {
    player.set("timeEnteredCountdown", new Date(Date.now()).toISOString());
  }
  logPlayerCounts(ctx);
});

Empirica.on("player", "introDone", (ctx, { player }) => {
  if (player.get("gameId")) return;

  logPlayerCounts(ctx);
  player.set("timeIntroDone", new Date(Date.now()).toISOString());

  // can't get the batch from the game object because player is not yet assigned to a game
  const batchId = player.get("batchId");
  const batches = ctx.scopesByKind("batch");
  const batch = batches?.get(batchId);
  debounceRunDispatch({ batch, ctx });
});

Empirica.on("player", "localClockTime", (ctx, { player, localClockTime }) => {
  // sometimes players local clocks are wrong, which can mess up their countdown
  // timer. Here we compute the (approximate) difference between the server clock and the
  // player's clock, and save as an offset that can be added to the player's own clock
  // reading to make countdowns happen at the right time.
  player.set("localClockOffsetMS", localClockTime - Date.now()); // positive if player's clock is ahead
});

async function closeOutPlayer({ player, batch, game }) {
  if (player.get("closedOut")) return;
  // Close the player either when they finish all steps,
  // or when we declare the batch over by timeout or manual closure
  // TODO: save information to participant record for future use

  await exportScienceData({ player, batch, game });
  const paymentDataFilename = exportPaymentData({ player, batch });
  player.set("paymentDataFilename", paymentDataFilename);
  player.set("closedOut", true);
}

Empirica.on("player", "playerComplete", async (ctx, { player }) => {
  if (!player.get("playerComplete") || player.get("closedOut")) return;
  // fires when participant finishes the QC survey

  const game = player.currentGame;
  const { batch } = game;
  if (!batch) {
    error(`Error: no batch found for game ${game.id}`);
    return;
  }

  player.set("exitStatus", "complete");
  player.set("timeComplete", new Date(Date.now()).toISOString());
  await closeOutPlayer({ player, batch, game });
  info(`Player ${player.id} done`);
  logPlayerCounts(ctx);
});

Empirica.on(
  "player",
  "qualtricsDataReady",
  async (ctx, { player, qualtricsDataReady }) => {
    // this should be ok with being called mutliple times (or concurrently/during prior execution)
    // assuming that `qualtricsDataReady` is "got" when the callback is enqueued - as it is just a single
    // attribute it will get set once without any waiting.
    if (!qualtricsDataReady) return;

    const { step, surveyId, sessionId } = qualtricsDataReady;
    const data = await getQualtricsData({ sessionId, surveyId, retries: 3 });

    const result = { ...qualtricsDataReady, data };
    player.set(`qualtrics_${step}`, result);
    player.set("qualtricsDataReady", false);
  },
);

Empirica.on("game", "newEtherpad", async (ctx, { game, newEtherpad }) => {
  if (!newEtherpad) return;
  const { padId, defaultText } = newEtherpad;
  const padURL = await createEtherpad({ padId, defaultText });
  if (!padURL) {
    error(`Error creating etherpad with id ${padId}`);
    return;
  }
  info(`Etherpad ready at ${padURL}`);
  game.set(padId, padURL);
  game.set("newEtherpad", undefined);
});

Empirica.on(
  "game",
  "etherpadDataReady",
  async (ctx, { game, etherpadDataReady }) => {
    if (!game.get("etherpadDataReady")) return;
    const { padId, padName, progressLabel, stageTimeElapsed } =
      etherpadDataReady;
    try {
      const text = await getEtherpadText({ padId });
      const config = game.batch?.get("validatedConfig");
      const treatmentPath = config?.treatmentFile || "";
      const lastSlash = treatmentPath.lastIndexOf("/");
      const treatmentFileDir =
        lastSlash >= 0 ? treatmentPath.slice(0, lastSlash) : "";
      const record = await buildSharedNotepadRecord({
        game,
        padName,
        progressLabel,
        stageTimeElapsed,
        text,
        treatmentFileDir,
        fetchPromptFile: ({ rawPath, treatmentFileDir: dir }) =>
          fetchAssetText({
            assetBaseUrl: config?.assetBaseUrl,
            rawPath,
            treatmentFileDir: dir,
          }),
        parsePromptFile: (s) => promptFileSchema.parse(s),
      });
      game.set(`prompt_${padName}`, record);
    } catch (e) {
      error(`Error persisting shared notepad ${padName}:`, e);
    } finally {
      game.set("etherpadDataReady", undefined);
    }
  },
);
