/* eslint-disable no-use-before-define */
/* eslint-disable no-restricted-syntax */

import * as fs from "fs";
import { TajribaEvent } from "@empirica/core/admin";
import { ClassicListenersCollector } from "@empirica/core/admin/classic";
import { CloseRoom, CreateRoom, DailyCheck } from "./meetingRoom";
import { makeDispatcher } from "./dispatch";
import { getTreatments, getResourceLookup } from "./getTreatments";
import { getParticipantData } from "./exportParticipantData";
import { preregisterSample } from "./preregister";
import { exportScienceData } from "./exportScienceData";
import { exportPaymentData } from "./exportPaymentData";
import { assignPositions } from "./assignPositions";
import {
  toArray,
  selectOldestBatch,
  getOpenBatches,
  isArrayOfStrings,
} from "./utils";
import { getQualtricsData } from "./qualtricsFetch";
import { validateConfig } from "./validateConfig";
import { checkGithubAuth, pushDataToGithub } from "./github";

export const Empirica = new ClassicListenersCollector();

const dispatchers = new Map(); // keys are batch ids, values are dispatcher functions for that batch
const dispatchTimers = new Map(); // keys are batch ids, values are timer objects unique to the batch
const playersForParticipant = new Map();
const paymentIDForParticipantID = new Map();
const online = new Map();

// Make sure there is try-catch on every callback we wrote
// Check that all asyncs are resolved before catching
// Somehow make minimal replicable example

// ------------------- Server start callback ---------------------

Empirica.on("start", (ctx) => {
  console.log("Starting server");
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

  if (!batch.get("initialized")) {
    console.log(`Test Controls are: ${process?.env?.TEST_CONTROLS}`);

    const { config } = batch.get("config");
    
    try {
      // Check required environment variables
      // TODO: move this to onStart callback when https://github.com/empiricaly/empirica/issues/307 is resolved
      const requiredEnvVars = [
        "DAILY_APIKEY",
        "QUALTRICS_API_TOKEN",
        "QUALTRICS_DATACENTER",
        "DELIBERATION_MACHINE_USER_TOKEN",
        "DATA_DIR",
        "GITHUB_PRIVATE_DATA_OWNER",
        "GITHUB_PRIVATE_DATA_REPO",
        "GITHUB_PRIVATE_DATA_BRANCH",
        "GITHUB_PUBLIC_DATA_OWNER",
        "GITHUB_PUBLIC_DATA_REPO",
        "GITHUB_PUBLIC_DATA_BRANCH",
      ];
      
      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          throw new Error(`Missing required environment variable ${envVar}`);
        }
      }
      
      validateConfig(config);

      if (!checkGithubAuth()) {
        throw new Error("Github authentication failed");
      }

      const checkVideo = config?.checkVideo ?? true; // default to true if not specified
      const checkAudio = (config?.checkAudio ?? true) || checkVideo; // default to true if not specified, force true if checkVideo is true
      if (checkVideo || checkAudio) {
        // create daily room here to check if everything is runnable
        // if invalid videoStorageLocation, throw an error here
        await DailyCheck(
          `test_${batch.id}`.slice(0, 20),
          config.videoStorageLocation
        );
      }

      const lookup = await getResourceLookup();
      ctx.globals.set("resourceLookup", lookup);
      ctx.globals.set("videoStorageLocation", config.videoStorageLocation);

      const { introSequence, treatments } = await getTreatments({
        cdn: config.cdn,
        path: config.treatmentFile,
        treatmentNames: config.treatments,
        introSequenceName: config.introSequence,
      });

      batch.set("name", config?.batchName);
      const timeInitialized = Date.now();
      batch.set("timeInitialized", timeInitialized);
      batch.set("treatments", treatments);
      batch.set("introSequence", introSequence);

      const scienceDataDir = `${process.env.DATA_DIR}/scienceData`; // TODO: move this to empirica starts up callback
      if (!fs.existsSync(scienceDataDir))
        fs.mkdirSync(scienceDataDir, { recursive: true });

      const scienceDataFilename = `${scienceDataDir}/batch_${timeInitialized}_${config?.batchName}.jsonl`;
      batch.set("scienceDataFilename", scienceDataFilename);
      fs.closeSync(fs.openSync(scienceDataFilename, "a")); // create an empty datafile
      await pushDataToGithub({ batch, delaySeconds: 0, throwErrors: true }); // test pushing it to github

      const preregistrationDataDir = `${process.env.DATA_DIR}/preregistrationData`; // TODO: move this to empirica starts up callback
      if (!fs.existsSync(preregistrationDataDir))
        fs.mkdirSync(preregistrationDataDir, { recursive: true });

      batch.set(
        "preregistrationDataFilename",
        `${preregistrationDataDir}/batch_${timeInitialized}_${config?.batchName}.preregistration.jsonl`
      );

      const paymentDataDir = `${process.env.DATA_DIR}/paymentData`;
      if (!fs.existsSync(paymentDataDir))
        fs.mkdirSync(paymentDataDir, { recursive: true });

      batch.set(
        "paymentDataFilename",
        `${paymentDataDir}/batch_${timeInitialized}_${config?.batchName}.payment.jsonl`
      );

      batch.set("initialized", true);
      console.log(
        `Initialized Batch ${config.batchName} at ${timeInitialized}`
      );
    } catch (err) {
      console.log(
        `Failed to create batch with config:`,
        JSON.stringify(config),
        err
      );
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
      console.log(
        `Failed to set dispatcher of existing batch with id ${batch.id}`
      );
      console.log(err);
      console.log(
        "Note: this doesn't affect existing participants but no new participants can join"
      );
    }
  } 
});

Empirica.on("batch", "status", async (ctx, { batch, status }) => {
  console.log(`Batch ${batch.id} changed status to "${status}"`);

  if (status === "terminated" || status === "failed") {
    await closeBatch({ ctx, batch });
  }

  setCurrentlyRecruitingBatch({ ctx });
});

function setCurrentlyRecruitingBatch({ ctx }) {
  // select the oldest batch as the currently recruiting one.
  // If there are none open, set recruiting batch to undefined

  const openBatches = getOpenBatches(ctx);
  const currentlyRecruitingBatch = selectOldestBatch(openBatches);
  const config = currentlyRecruitingBatch?.get("config")?.config;
  const introSequence = currentlyRecruitingBatch?.get("introSequence");
  console.log(
    "Currently recruiting for batch: ",
    currentlyRecruitingBatch?.id,
    "with config: ",
    config
  );
  ctx.globals.set("recruitingBatchConfig", config);
  ctx.globals.set("recruitingBatchIntroSequence", introSequence);
}

async function closeBatch({ ctx, batch }) {
  // close out players, shut down batch
  const games = ctx.scopesByKind("game");
  const batchPlayers = ctx.scopesByKindMatching("player", "batchId", batch.id);
  if (!batchPlayers) {
    console.log(`No players found to close for batch ${batch.id}`);
    return;
  }

  batchPlayers?.forEach(async (player) => {
    if (!player.get("closedOut")) {
      // only run once
      player.set("exitStatus", "incomplete");
      const game = games?.get(player.get("gameId"));
      await closeOutPlayer({ player, batch, game, GHPush: false }); // don't push to github, we'll do it below
      console.log(`Closing incomplete player ${player.id}.`);
    }
  });

  dispatchTimers.delete(batch.id);
  console.log(`Batch ${batch.id} closed`);
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
      console.log(
        "startingPlayerIds not array of strings. got",
        startingPlayersIds
      );
    }
    for (const id of startingPlayersIds) {
      if (players.has(id)) {
        const player = players.get(id);
        player.set("gameId", game.id);
        // eslint-disable-next-line no-await-in-loop
        await game.assignPlayer(player);
      } else {
        console.log(`Error: unknown player id ${id}`);
      }
    }

    game.set("initialized", true);
    game.start();
  } catch (err) {
    // if game initialization fails, return participants to subject pool
    // for reassignment, and then rerun dispatcher
    console.log(`Failed to initialize game with:`);
    console.log(
      " - starting players:",
      toArray(game.get("startingPlayersIds"))
    );
    console.log("Error:", err);
    scrubGame({ ctx, game });
  }
});

Empirica.on("game", "start", async (ctx, { game, start }) => {
  if (!start) return;
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

    const videoStorageLocation = ctx.globals.get("videoStorageLocation");
    console.log(`videoStorageLocation: ${videoStorageLocation}`);

    const checkVideo = config?.checkVideo ?? true; // default to true if not specified
    const checkAudio = (config?.checkAudio ?? true) || checkVideo; // default to true if not specified, force true if checkVideo is true
    if (checkVideo || checkAudio) {
      // Todo: add condition for when audiocheck and videocheck are off
      const room = await CreateRoom(game.id, videoStorageLocation); // Todo, omit this on a batch config option?
      game.set("dailyUrl", room?.url);
      game.set("dailyRoomName", room?.name);
    }

    game.set("timeStarted", Date.now());
    console.log(`Game is now starting with players: ${identifiers}`);
  } catch (err) {
    console.log(`Failed to start game:`);
    console.log(err);
    scrubGame({ ctx, game });
  }
});

Empirica.onGameEnded(({ game }) => {
  CloseRoom(game.get("dailyRoomName"));
});

function scrubGame({ ctx, game }) {
  game.set("status", "failed");
  console.log(`Game ${game.id} Scrubbed`);

  const players = ctx.scopesByKind("player");
  const startingPlayersIds = toArray(game.get("startingPlayersIds"));
  for (const id of startingPlayersIds) {
    if (players?.has(id)) {
      const player = players?.get(id);
      console.log(`Resetting player ${player.id}`);
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

// Empirica.onStageStart(async ({ stage }) => { });

// Empirica.onStageEnded(({ stage }) => { });

// ------------------- Player callbacks ---------------------------

//
// Player connect/disconnect
//
// Todo: update when this issue is resolved: https://github.com/empiricaly/empirica/issues/257
//

function playerConnected(player) {
  player.set("connected", true);
  const paymentID = paymentIDForParticipantID.get(player.participantID);
  console.log(`Player ${paymentID} connected.`);
}

function playerDisconnected(player) {
  player.set("connected", false);
  const paymentID = paymentIDForParticipantID.get(player.participantID);
  console.log(`Player ${paymentID} disconnected.`);
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
        console.log(
          "error, have open batches but no batch found:",
          openBatches
        );
      }

      player.set("batchId", batch.id);
      player.set("batchTimeInitialized", batch.get("timeInitialized"));
      player.set("timeArrived", Date.now());

      // get any data we have on this participant from prior activities
      const platformId = paymentIDForParticipantID?.get(participantID);
      const participantData = await getParticipantData({ platformId });
      player.set("participantData", participantData);

      playersForParticipant.set(participantID, player);
      player.set("initialized", true);
      console.log(`initialized player ${player.id} in batch ${batch?.id}"`);
    }
  } catch (err) {
    console.log(`Error initializing player ${participantID}:`, err);
    // Todo: What should we do if this fails? Try again?
  }

  if (online.has(participantID)) {
    playerConnected(player);
  }
});

function runDispatch({ batch, ctx }) {
  dispatchTimers.delete(batch.id);

  try {
    console.log(`runDispatch`);
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

      console.log(
        `Adding game with treatment ${treatment.name}, players ${playerIds}`
      );
    });
  } catch (err) {
    console.log(
      "Error in dispatch or game creation, will try again after 'dispatchWait'."
    );
    console.log("Error: ", err);
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
    console.log(`setting ${dispatchWait} second dispatch timer`);
    dispatchTimers.set(
      batch.id,
      setTimeout(runDispatch, dispatchWait * 1000, { batch, ctx })
    );
  } catch (err) {
    console.log(`Uncaught error setting dispatch timer for batch ${batch.id}`);
  }
}

Empirica.on("player", "inCountdown", (ctx, { player, inCountdown }) => {
  if (!inCountdown) return;
  if (!player.get("timeIntroSequenceDone")) {
    player.set("timeIntroSequenceDone", Date.now());
  }
});

Empirica.on("player", "introDone", (ctx, { player }) => {
  if (player.get("gameId")) return;

  if (!player.get("timeIntroSequenceDone")) {
    player.set("timeIntroSequenceDone", Date.now());
  }

  // TODO: set a player timer (5-10 mins?) that takes care
  // of the player if they don't get assigned a game within a certain amount of time.

  // const { batch } = player;
  try {
    const batchId = player.get("batchId");
    const batches = ctx.scopesByKind("batch");
    const batch = batches?.get(batchId);

    debounceRunDispatch({ batch, ctx });
    console.log(`player ${player.id} introDone`);
  } catch (err) {
    console.log(`Uncaught error in introDone callback for player ${player.id}`);
  }
});

async function closeOutPlayer({ player, batch, game }) {
  if (player.get("closedOut")) return;
  // Close the player either when they finish all steps,
  // or when we declare the batch over by timeout or manual closure
  //
  // This is a synchronous function, so after its completion we
  // can safely manipulate the files.

  await exportScienceData({ player, batch, game });
  const paymentDataFilename = exportPaymentData({ player, batch });
  // TODO: save updates to player data

  player.set("closedOut", true);
  player.set("paymentDataFilename", paymentDataFilename);
}

Empirica.on("player", "playerComplete", async (ctx, { player }) => {
  if (!player.get("playerComplete") || player.get("closedOut")) return;
  // fires when participant finishes the QC survey

  // const game = player.currentGame;
  // const { batch } = player;
  const batches = ctx.scopesByKind("batch");
  const batch = batches?.get(player.get("batchId"));
  const games = ctx.scopesByKind("game");
  const game = games?.get(player.get("gameId"));

  console.log(`Player ${player.id} done`);
  player.set("exitStatus", "complete");
  player.set("timeComplete", Date.now());
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
    const data = await getQualtricsData({ sessionId, surveyId });

    const result = { ...qualtricsDataReady, data };
    player.set(`qualtrics_${step}`, result);

    player.set("qualtricsDataReady", false);
  }
);
/*
Todo:
Test the callback value passing
create a loop on front end, with some extra callback, with 10-100 iterations,
set same key each time with a different value, check on server that all 
of the values are coming through as expected. Put a sleep in server-side callback
to simulate processing callback (ie, with external data source.)
*/
