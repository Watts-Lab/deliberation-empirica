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
import { makeDispatcher } from "./dispatch";
import { getTreatments, getResourceLookup } from "./getTreatments";
import { getParticipantData } from "./postFlight/exportParticipantData";
import { preregisterSample } from "./preFlight/preregister";
import { exportScienceData } from "./postFlight/exportScienceData";
import { exportPaymentData } from "./postFlight/exportPaymentData";
import { assignPositions } from "./assignPositions";
import {
  toArray,
  selectOldestBatch,
  getOpenBatches,
  isArrayOfStrings,
} from "./utils";
import { getQualtricsData } from "./providers/qualtrics";
import { getEtherpadText, createEtherpad } from "./providers/etherpad";
import { validateConfig } from "./validateConfig";
import { checkGithubAuth, pushDataToGithub } from "./providers/github";
import { postFlightReport } from "./postFlight/postFlightReport";
import { checkRequiredEnvironmentVariables } from "./preFlight/preFlightChecks";

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

  if (!batch.get("initialized")) {
    error(`Error test message from batch ${batch.id}`); // for cypress testing, to ensure we're parsing errors right
    const { config } = batch.get("config");

    try {
      validateConfig(config);
      batch.set("name", config?.batchName);

      const lookup = await getResourceLookup();
      ctx.globals.set("resourceLookup", lookup);

      const checkVideo = config?.checkVideo ?? true; // default to true if not specified
      const checkAudio = (config?.checkAudio ?? true) || checkVideo; // default to true if not specified, force true if checkVideo is true
      if (checkVideo || checkAudio) {
        // create daily room to check we can write to videoStorageLocation
        await dailyCheck(
          `test_${batch.id}`.slice(0, 20),
          config.videoStorageLocation,
          config.awsRegion
        );
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

      const batchLabel = `${timeInitialized
        .replaceAll(/-|:|\./g, "")
        .replace("T", "_")
        .slice(0, 13)}_${config?.batchName}`;
      batch.set("label", batchLabel);

      // set filenames for storing data
      const scienceDataFilename = `${process.env.DATA_DIR}/batch_${batchLabel}.scienceData.jsonl`;
      batch.set("scienceDataFilename", scienceDataFilename);
      fs.closeSync(fs.openSync(scienceDataFilename, "a")); // create an empty datafile
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
      error(`Failed to create batch with config:`, JSON.stringify(config), err);
      batch.set("status", "failed");
    }
  }

  // this bit will run on a server restart or on batch creation
  if (
    (batch.get("status") === "created" || batch.get("status") === "running") &&
    !dispatchers.has(batch.id)
  ) {
    try {
      const treatments = batch.get("treatments");
      dispatchers.set(batch.id, makeDispatcher({ treatments }));
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
  const config = batch?.get("config")?.config;
  const introSequence = batch?.get("introSequence");
  if (config.introSequence && !introSequence) {
    error("Error: expected intro sequence but none found");
  }
  info(`Currently recruiting for batch: ${batch?.get("label")}`);
  info("batch config: ", config);
  info("batch introSequence: ", introSequence);

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

  dispatchTimers.delete(batch.id);
  info(`Batch ${batch.id} closed`);
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
    ).toISOString()}, started: ${game.get("timeStarted")}`
  );
  // on game start
  try {
    const { players } = game;
    const treatment = game.get("treatment");
    const { gameStages, assignPositionsBy } = treatment;
    const batches = ctx.scopesByKind("batch");
    const batch = batches?.get(players[0].get("batchId"));
    const { config } = batch.get("config");

    players.forEach((player) => {
      preregisterSample({ player, batch, game });
    });

    const identifiers = assignPositions({
      players,
      assignPositionsBy,
      treatment,
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
      const room = await createRoom(
        roomName,
        config?.videoStorageLocation,
        config?.awsRegion
      );
      game.set("dailyUrl", room?.url);
      game.set("dailyRoomName", room?.name);
    }

    game.set("timeGameStarted", new Date(Date.now()).toISOString());
    info(`Game is now starting with players: ${identifiers}`);
  } catch (err) {
    error(`Failed to start game: ${game.id}`, err);
    scrubGame({ ctx, game });
  }
});

Empirica.onGameEnded(({ game }) => {
  game.set("timeGameEnded", new Date(Date.now()).toISOString());

  if (game.get("dailyRoomName")) {
    const recordingData = closeRoom(game.get("dailyRoomName"));
    game.set("recordingsPath", recordingData?.s3Key);
    info(
      `Recordings for game: ${game.id} saved in S3 bucket at path ${recordingData?.s3key}`
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

// Empirica.onStageStart(({ stage }) => {
Empirica.on("stage", "callStarted", async (ctx, { stage, callStarted }) => {
  if (!callStarted) return;
  console.log(`Stage ${stage.get("index")} call started`);

  info(`Stage ${stage.get("index")}: ${stage.get("name")}`);
  const discussion = stage?.get("discussion");
  const { config } = stage.currentGame.batch.get("config");
  const videoStorageLocation = config?.videoStorageLocation;

  if (discussion?.chatType === "video" && videoStorageLocation !== "none") {
    const dailyRoomName = stage.currentGame.get("dailyRoomName");
    console.log(
      `callStarted Callback for stage ${stage.id} room ${dailyRoomName}`
    );
    startRecording(dailyRoomName);
  }
});

Empirica.onStageEnded(({ stage }) => {
  const discussion = stage?.get("discussion");
  const callStarted = stage?.get("callStarted");
  const { config } = stage.currentGame.batch.get("config");
  const videoStorageLocation = config?.videoStorageLocation;

  if (!discussion || !callStarted || !videoStorageLocation) return;

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
  const paymentID = paymentIDForParticipantID.get(player.participantID);
  info(`Player ${paymentID} connected.`);
}

function playerDisconnected(player) {
  player.set("connected", false);
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
      const { config } = batch.get("config");

      player.set("batchId", batch.id);
      player.set("batchLabel", batch.get("label"));
      player.set("timeArrived", new Date(Date.now()).toISOString());
      player.set("exitCodeStem", config?.exitCodeStem || "NCD");

      // get any data we have on this participant from prior activities
      const platformId = paymentIDForParticipantID?.get(participantID);
      const participantData = await getParticipantData({ platformId });
      player.set("participantData", participantData);

      playersForParticipant.set(participantID, player);
      player.set("initialized", true);
      info(`initialized player ${player.id} in batch ${batch?.id}"`);
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
    info(`runDispatch`);
    const players = ctx.scopesByKind("player");
    const dispatcher = dispatchers.get(batch.id);

    const playersReady = []; // ready to be assigned to a game
    const playersWaiting = []; // still in intro steps
    const playersAssigned = []; // assigned to games

    players.forEach((player) => {
      if (player.get("connected")) {
        // TODO: this is in a function, so should do guard clause w/ return instead of if
        if (player.get("gameId") || player.get("assigned")) {
          playersAssigned.push(player.id);
        } else if (player.get("introDone")) {
          playersReady.push(player.id);
        } else {
          playersWaiting.push(player.id);
        }
      }
    });

    const dispatchList = dispatcher({
      playersReady,
      playersAssigned,
      playersWaiting,
    });

    dispatchList.forEach(({ treatment, playerIds }) => {
      // todo: can also do this as a keymap, so:
      // batch.addGame({treatmentName: treatment.name, treatment: treatment})
      // this is a reasonable approach here because we can set options like "immutable"
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
          value: playerIds,
          immutable: true,
        },
      ]);

      playerIds.forEach((id) => {
        // make sure we don't double-assign players
        // because assigning to games is async and may take time
        const player = players.get(id);
        player.set("assigned", true);
      });

      info(
        `Adding game with treatment ${treatment.name}, players ${playerIds}`
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
    const { config } = batch.get("config");
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
});

Empirica.on("player", "introDone", (ctx, { player }) => {
  if (player.get("gameId")) return;

  info(`player ${player.id} introDone`);
  player.set("timeIntroDone", new Date(Date.now()).toISOString());

  // can't get the batch from the game object because player is not yet assigned to a game
  const batchId = player.get("batchId");
  const batches = ctx.scopesByKind("batch");
  const batch = batches?.get(batchId);
  debounceRunDispatch({ batch, ctx });
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

  info(`Player ${player.id} done`);
  player.set("exitStatus", "complete");
  player.set("timeComplete", new Date(Date.now()).toISOString());
  await closeOutPlayer({ player, batch, game });
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
