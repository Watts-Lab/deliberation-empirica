/* eslint-disable no-use-before-define */
/* eslint-disable no-restricted-syntax */

import { TajribaEvent } from "@empirica/core/admin";
import { ClassicListenersCollector } from "@empirica/core/admin/classic";
import { CloseRoom, CreateRoom } from "./meetingRoom";
import { makeDispatcher } from "./dispatch";
import { getTreatments, getResourceLookup } from "./getTreatments";
import { getParticipantData } from "./exportParticipantData";
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

// Empirica.on("start", async (ctx) => { });

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
    console.log(`Node Environment: ${process?.env?.NODE_ENV2}`);

    const { config } = batch.get("config");

    try {
      const lookup = await getResourceLookup();
      ctx.globals.set("resourceLookup", lookup);

      // Todo: validate config

      const { introSequence, treatments } = await getTreatments(
        config.treatmentFile,
        config.useTreatments,
        config.useIntroSequence
      );

      batch.set("name", config?.batchName);
      batch.set("treatments", treatments);
      batch.set("introSequence", introSequence);
      batch.set("initialized", true);
      console.log(`Initialized Batch ${config.batchName} with id ${batch.id}`);
    } catch (err) {
      console.log(`Failed to create batch with config:`);
      console.log(JSON.stringify(config));
      console.log(err);
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

Empirica.on("batch", "status", (ctx, { batch, status }) => {
  console.log(`Batch ${batch.id} changed status to "${status}"`);

  // batch start
  /*
  if (status === "running") {
    const { config } = batch.get("config");
    // TODO: this will run on restart, check that batch has not been closed already?

    // const msUntilLastEntry = Date.parse(config?.lastEntryDate) - Date.now();
    // if (msUntilLastEntry) {
    //   // default to always accepting participants
    //   setTimeout(() => {
    //     console.log("value set at:", Date.now());
    //     batch.set("afterLastEntry", true);
    //   }, msUntilLastEntry);
    // }

    // const msUntilClose = Date.parse(config?.closeDate) - Date.now();
    // if (msUntilClose) {
    //   // default to not automatically closing batch
    //   console.log(
    //     `Automatically close batch in ${msUntilClose / 1000} seconds`
    //   );
    //   setTimeout(() => batch.set("status", "terminated"), msUntilClose); // Todo: make this "closed" when we automatic batch closure is disabled
    // }
  }
  */

  if (status === "terminated" || status === "failed") {
    closeBatch({ ctx, batch });
  }

  // batch end (currently on last game end)
  if (status === "ended" && !batch.get("closed")) {
    console.log("don't let it end till we're ready, reopening!");
    batch.set("status", "running"); // don't close early (waiting for https://github.com/empiricaly/empirica/issues/213)
  }

  setCurrentlyRecruitingBatch({ ctx });
});

// Empirica.on("batch", "afterLastEntry", (ctx, { batch, afterLastEntry }) => {
//   console.log("callback fired at:", Date.now());

//   if (!afterLastEntry) return;
//   console.log(`Last entry for batch ${batch.id}`);
//   setCurrentlyRecruitingBatch({ ctx });
// });

function setCurrentlyRecruitingBatch({ ctx }) {
  // select the oldest batch as the currently recruiting one.
  // If there are none open, set recruiting batch to undefined

  const openBatches = getOpenBatches(ctx);
  const currentlyRecruiting = selectOldestBatch(openBatches);
  const config = currentlyRecruiting?.get("config")?.config;
  console.log("Currently recruiting for batch: ", currentlyRecruiting?.id);
  ctx.globals.set("recruitingBatchConfig", config);
}

function closeBatch({ ctx, batch }) {
  // close out players, shut down batch
  const games = ctx.scopesByKind("game");
  const batchPlayers = ctx.scopesByKindMatching("player", "batchId", batch.id);
  if (!batchPlayers)
    console.log(`No players found to close for batch ${batch.id}`);

  batchPlayers?.forEach((player) => {
    if (!player.get("closedOut")) {
      // only run once
      player.set("exitStatus", "incomplete");
      const game = games?.get(player.get("gameId"));
      closeOutPlayer({ player, batch, game });
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
    const { gameStages, assignPositionsBy } = game.get("treatment");

    const identifiers = assignPositions({ players, assignPositionsBy });
    const round = game.addRound({ name: "main" });
    gameStages.forEach((stage) => round.addStage(stage));

    const room = await CreateRoom(game.id); // Todo, omit this on a batch config option?

    game.set("dailyUrl", room?.url);
    game.set("dailyRoomName", room?.name);

    console.log(`Game is now starting with players: ${identifiers}`);
  } catch (err) {
    console.log(`Failed to initialize game with:`);
    console.log(" - starting players:", game.players);
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
      const { config } = batch.get("config");

      player.set("batchId", batch?.id);
      player.set("introSequence", batch?.get("introSequence"));
      player.set("launchDate", config?.launchDate);
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
        // this is in a function, so can do guard clause w/ return instead of if
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

Empirica.on("player", "introDone", (ctx, { player }) => {
  if (player.get("gameId")) return;
  // TODO: set a player timer (5-10 mins?) that takes care
  // of the player if they don't get assigned a game within a certain amount of time.

  // const { batch } = player;

  const batchId = player.get("batchId");
  const batches = ctx.scopesByKind("batch");
  const batch = batches?.get(batchId);

  debounceRunDispatch({ batch, ctx });
  console.log(`player ${player.id} introDone`);
});

function closeOutPlayer({ player, batch, game }) {
  if (player.get("closedOut")) return;
  // Close the player either when they finish all steps,
  // or when we declare the batch over by timeout or
  // manual closure

  exportScienceData({ player, batch, game });
  exportPaymentData({ player, batch });
  // TODO: save updates to player data
  player.set("closedOut", true);
}

Empirica.on("player", "playerComplete", (ctx, { player }) => {
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
  closeOutPlayer({ player, batch, game });
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
