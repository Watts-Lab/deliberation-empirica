/* eslint-disable no-use-before-define */
/* eslint-disable no-restricted-syntax */

import * as fs from "fs";
import { TajribaEvent } from "@empirica/core/admin";
import { ClassicListenersCollector } from "@empirica/core/admin/classic";
import { error, warn, info, log } from "@empirica/core/console";
import {
  closeRoom,
  createRoom,
  dailyCheck,
  startRecording,
  stopRecording,
} from "./providers/dailyco";
import { makeDispatcher } from "./preFlight/dispatch";
import { getTreatments, getResourceLookup } from "./getTreatments";
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
import { getQualtricsData } from "./providers/qualtrics";
import { getEtherpadText, createEtherpad } from "./providers/etherpad";
import { validateBatchConfig } from "./preFlight/validateBatchConfig.ts";
import { checkGithubAuth, pushDataToGithub, validateRepoAccess } from "./providers/github";
import { postFlightReport } from "./postFlight/postFlightReport";
import { checkRequiredEnvironmentVariables } from "./preFlight/preFlightChecks";
import { logPlayerCounts } from "./utils/logging";

export const Empirica = new ClassicListenersCollector();

const dispatchers = new Map(); // keys are batch ids, values are dispatcher functions for that batch
const dispatchTimers = new Map(); // keys are batch ids, values are timer objects unique to the batch
const playersForParticipant = new Map();
const paymentIDForParticipantID = new Map();
const online = new Map();
const gamesStarted = new Set();

// ------------------- Server start callback ---------------------

Empirica.on("start", async (ctx) => {
  try {
    checkRequiredEnvironmentVariables();
    await checkGithubAuth();
  } catch (err) {
    error("Error starting server:", err);
  }

  ctx.globals.set("cdnList", {
    // test: "deliberation-assets",
    test: "http://localhost:9091",
    local: "http://localhost:9090",
    prod: "https://s3.amazonaws.com/assets.deliberation-lab.org",
  });

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

  const { config: unvalidatedConfig } = batch.get("config");

  if (!batch.get("initialized")) {
    error(`Error test message from batch ${batch.id}`); // for cypress testing, to ensure we're parsing errors right

    try {
      const config = validateBatchConfig(unvalidatedConfig);
      batch.set("validatedConfig", config);
      batch.set("name", config?.batchName);

      const lookup = await getResourceLookup();
      ctx.globals.set("resourceLookup", lookup);

      const checkVideo = config?.checkVideo ?? true; // default to true if not specified
      const checkAudio = (config?.checkAudio ?? true) || checkVideo; // default to true if not specified, force true if checkVideo is true
      if (checkVideo || checkAudio) {
        // create daily room to check we can write to the video storage bucket
        await dailyCheck(`test_${batch.id}`.slice(0, 20), config.videoStorage);
      }

      const { introSequence, treatments } = await getTreatments({
        cdn: config.cdn,
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
            } minutes at ${config.launchDate}`
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
      
      // Two-step GitHub repository validation approach:
      // 1. First, validate READ access (fast) - checks repository/branch existence
      // 2. Later, validate WRITE access during actual file operations (slower)
      //
      // This design provides fast failure for invalid repositories while still
      // validating write permissions when actually needed during data push.
      const dataRepos = config?.dataRepos || [];
      const preregRepos = config?.preregRepos || [];
      
      // Only add centralPrereg repo if not in test mode with invalid env vars
      // Design choice: In test mode, skip central repository validation when
      // GitHub environment variables are set to "none", but always validate
      // user-specified repositories since those are part of the experiment config
      if (config?.centralPrereg && !(process.env.TEST_CONTROLS === "enabled" &&
        (process.env.GITHUB_PRIVATE_DATA_OWNER === "none" ||
          process.env.GITHUB_PRIVATE_DATA_REPO === "none" ||
          process.env.GITHUB_PRIVATE_DATA_BRANCH === "none"))) {
        dataRepos.push({
          owner: process.env.GITHUB_PRIVATE_DATA_OWNER,
          repo: process.env.GITHUB_PRIVATE_DATA_REPO,
          branch: process.env.GITHUB_PRIVATE_DATA_BRANCH,
          directory: "scienceData",
        });
      }
      
      // Always validate user-specified data and preregistration repositories
      // even in test mode, since these are explicitly configured by the user
      const dataValidations = dataRepos.map(({ owner, repo, branch }) =>
        validateRepoAccess({ owner, repo, branch })
      );
      const preregValidations = preregRepos.map(({ owner, repo, branch }) =>
        validateRepoAccess({ owner, repo, branch })
      );
      
      // Wait for all repository validations to complete
      // If any validation fails, Promise.all will reject and throw an error,
      // causing the batch creation to fail immediately with a clear error message
      await Promise.all([...dataValidations, ...preregValidations]);
      
      // Now test write access by attempting to push a test file to GitHub
      // This validates write permissions and actual file operations
      await pushDataToGithub({ batch, delaySeconds: 0, throwErrors: true }); // test pushing it to github

      batch.set(
        "preregistrationDataFilename",
        `${process.env.DATA_DIR}/batch_${batchLabel}.preregistration.jsonl`
      );

      batch.set(
        "paymentDataFilename",
        `${process.env.DATA_DIR}/batch_${batchLabel}.payment.jsonl`
      );

      batch.set(
        "postFlightReportFilename",
        `${process.env.DATA_DIR}/batch_${batchLabel}.postFlightReport.jsonl`
      );

      batch.set("initialized", true);
      info(`Initialized Batch ${config.batchName} at ${timeInitialized}`);
    } catch (err) {
      // FAILS HERE
      error(
        `Failed to create batch with config:`,
        JSON.stringify(unvalidatedConfig),
        err
      );
      batch.set("status", "failed");
    }
  }

  // this bit will run on a server restart or on batch creation
  const config = batch.get("validatedConfig");
  if (
    (batch.get("status") === "created" || batch.get("status") === "running") &&
    !dispatchers.has(batch.id)
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
        })
        // todo: the dispatcher is stateful in that the payoffs get updated,
        // but currently we don't save the payoffs outside the closure,
        // so a server restart will reset the payoffs.
      );
    } catch (err) {
      error(
        `Failed to set dispatcher of existing batch with id ${batch.id}`,
        "Note: this doesn't affect existing participants but no new participants can join"
      );
      error(err);
    }
  }
});

Empirica.on("batch", "status", async (ctx, { batch, status }) => {
  info(`Batch ${batch.id} changed status to "${status}"`);

  if (status === "terminated" || status === "failed") {
    await closeBatch({ ctx, batch });
    setCurrentlyRecruitingBatch({ ctx });
  }

  if (status === "running") {
    setCurrentlyRecruitingBatch({ ctx });
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
      `Batch ${batch.id} was not finished initializing, setting status to failed. Try agian.`
    );
  }
  const config = batch?.get("validatedConfig");
  const introSequence = batch?.get("introSequence");
  if (config.introSequence !== "none" && !introSequence) {
    error("Error: expected intro sequence but none found");
  }
  info(`Currently recruiting for batch: ${batch?.get("label")}`);
  info("batch config: ", config);
  // info("batch introSequence: ", introSequence);

  ctx.globals.set("recruitingBatchConfig", config);
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
    })
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
      `Game ${game.id} already started, skipping second game start callback`
    );
    return;
  }
  gamesStarted.add(game.id);

  warn(
    `Game ${game.id} on game start callback. Now: ${new Date(
      Date.now()
    ).toISOString()}, started: ${game.get("timeGameStarted")}`
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
      // The daily room name can only have 41 characters,
      // including the "deliberation" prefix maybe with a separator (so we have 28(?) characters left)
      // see: https://docs.daily.co/reference/rest-api/rooms/create-room#name
      info("Creating daily room for game", game.id);
      const roomName = batch.get("label").slice(0, 20) + game.id.slice(-6);
      game.set("recordingsFolder", roomName);
      const room = await createRoom(roomName, config.videoStorage); // fails on this
      game.set("dailyUrl", room?.url);
      game.set("dailyRoomName", room?.name);
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
        recordingData
      )}`
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

Empirica.on("stage", "callStarted", async (ctx, { stage, callStarted }) => {
  if (!callStarted) return;
  const config = stage.currentGame.batch.get("validatedConfig");
  const discussion = stage?.get("discussion");

  if (discussion?.chatType === "video" && config.videoStorage !== "none") {
    const dailyRoomName = stage.currentGame.get("dailyRoomName");
    startRecording(dailyRoomName);
  }
});

Empirica.onStageEnded(({ stage }) => {
  const discussion = stage?.get("discussion");
  const callStarted = stage?.get("callStarted");
  const config = stage.currentGame.batch.get("validatedConfig");
  if (!discussion || !callStarted || config.videoStorage !== "none") return;
  stopRecording(stage.currentGame.get("dailyRoomName"));
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
      });

      info(
        `Adding game with treatment ${
          treatment.name
        }, players: ${positionAssignments.map((p) => p.playerId)}`
      );
    });
  } catch (err) {
    error(
      "Error in dispatch or game creation, will try again after 'dispatchWait'.",
      err
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
      setTimeout(runDispatch, dispatchWait * 1000, { batch, ctx })
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
  }
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
    const { padId, padName, record } = etherpadDataReady;
    const text = await getEtherpadText({ padId });
    record.value = text;
    game.set(`prompt_${padName}`, record);
    game.set("etherpadDataReady", undefined);
  }
);
