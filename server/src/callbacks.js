/* eslint-disable no-restricted-syntax */
/*

*/

import { TajribaEvent } from "@empirica/core/admin";
import { ClassicListenersCollector } from "@empirica/core/admin/classic";
import { CloseRoom, CreateRoom } from "./meetingRoom";
import { makeDispatcher } from "./dispatch";
import { getTreatments, getResourceLookup } from "./getTreatments";
import { getParticipantData } from "./exportParticipantData";
import { exportScienceData } from "./exportScienceData";
import { exportPaymentData } from "./exportPaymentData";
import { assignPositions } from "./assignPositions";

export const Empirica = new ClassicListenersCollector();

const dispatchers = new Map(); // keys are batch ids, values are dispatcher functions for that batch
const dispatchTimers = new Map(); // keys are batch ids, values are timer objects unique to the batch
const playersForParticipant = new Map();
const paymentIDForParticipantID = new Map();
const online = new Map();

// ------------------- Helper functions -------------------------
function toArray(maybeArray) {
  // different from Array.from() in that it won't break apart strings
  if (maybeArray instanceof Array) return maybeArray;
  return [maybeArray];
}

// ------------------- Batch callbacks ---------------------------
// Batch lifecycle:
// 1. Batch Created/initialized
// 2. Batch Started
// 3. Batch "Launched"
// 4. Batch no longer accepting players
// 5. Batch Closed
// Batches can also be "failed" or "terminated"

Empirica.on("batch", async (ctx, { batch }) => {
  // Batch created

  // Ideally, we should find and raise any issues with
  // the treatment, assets, or config here,
  // before the batch is even started.

  if (!batch.get("initialized")) {
    console.log(`Test Controls are ${process.env.TEST_CONTROLS}`);
    console.log(`Node Environment: ${process.env.NODE_ENV2}`);

    const { config } = batch.get("config");

    try {
      const lookup = await getResourceLookup();
      ctx.globals.set("resourceLookup", lookup);

      const { introSequence, treatments } = await getTreatments(
        config.treatmentFile,
        config.useTreatments,
        config.useIntroSequence
      );

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
  const treatments = batch.get("treatments");
  if (!batch.get("closed") && !dispatchers.has(batch.id)) {
    dispatchers.set(batch.id, makeDispatcher({ treatments }));
  }
});

function selectOldestBatch(batches) {
  let currentOldestBatch = batches[0];
  // eslint-disable-next-line no-restricted-syntax
  for (const comparisonBatch of batches) {
    if (
      Date.parse(currentOldestBatch.get("createdAt")) >
      Date.parse(comparisonBatch.get("createdAt"))
    )
      currentOldestBatch = comparisonBatch;
  }
  return currentOldestBatch;
}

Empirica.on("batch", "status", (ctx, { batch }) => {
  // batch start
  if (batch.get("status") !== "running") return;

  if (!batch.get("started")) {
    const { config } = batch.get("config");
    const launchDate = Date.parse(config.launchDate) || undefined;
    const lastEntryDate =
      Date.parse(config.lastEntryDate) ||
      launchDate + 30 * 60 * 1000 ||
      Date.now() + 30 * 60 * 1000; // if neither launchDate nor lastEntryDate is specified
    const closeDate =
      Date.parse(config.closeDate) ||
      launchDate + 90 * 60 * 1000 ||
      Date.now() + 90 * 60 * 1000; // if neither launchDate nor closeDate is specified

    const newConfig = { ...config, lastEntryDate, closeDate };
    batch.set("batchConfig", newConfig); //TODO: this name may be confused with the normal config, should update.
    // TODO: remove these as separate items and just fetch them from the updated batch config
    batch.set("launchDate", launchDate);
    batch.set("lastEntryDate", lastEntryDate);
    batch.set("closeDate", closeDate);

    console.log(`Starting batch ${batch.id}`);
    batch.set("started", true);
  }

  // this will run on a server restart to set up timers even if the batch has already been started
  const now = Date.now();
  const launchTimeout = batch.get("launchDate") - now;
  const lastEntryTimeout = batch.get("lastEntryDate") - now;
  const closeTimeout = batch.get("closeDate") - now;

  batch.set("launched", launchTimeout <= 0);
  batch.set("acceptingParticipants", lastEntryTimeout > 0);
  batch.set("closed", closeTimeout <= 0);

  if (launchTimeout > 0)
    setTimeout(() => batch.set("launched", true), launchTimeout);
  if (lastEntryTimeout > 0)
    setTimeout(
      () => batch.set("acceptingParticipants", false),
      lastEntryTimeout
    );
  if (closeTimeout > 0)
    setTimeout(() => batch.set("closed", true), closeTimeout);
});

Empirica.on("batch", "launched", (ctx, { batch }) => {
  if (!batch.get("launched")) return;
  console.log(`Batch  ${batch.id} launched`);
});

Empirica.on("batch", "acceptingParticipants", (ctx) => {
  // if any batches are accepting participants, this flag stays true
  // todo: could simplify this and just make a "recruitingBatch" variable
  // that is undefined if there are no batches currently accepting participants.
  const openBatches = ctx.scopesByKindMatching(
    "batch",
    "acceptingParticipants",
    true
  );
  ctx.globals.set("batchesAcceptingParticipants", openBatches.length > 0);

  if (openBatches.length > 0) {
    const currentlyRecruiting = selectOldestBatch(openBatches);
    // TODO: only update if there is a change? does this matter?
    ctx.globals.set(
      "recruitingBatchConfig",
      openBatches.length > 0
        ? currentlyRecruiting.get("batchConfig")
        : undefined
    );
  }
});

Empirica.on("batch", "status", (ctx, { batch }) => {
  // deal with failure conditions
  const status = batch.get("status"); // {running, ended, terminated, failed}
  console.log(`Batch ${batch.id} changed status to "${status}"`);

  if (status === "running") return;

  if (status === "terminated" || status === "failed") {
    batch.set("acceptingParticipants", false);
    batch.set("closed", true);
  }

  if (status === "ended" && !batch.get("closed")) {
    console.log("don't let it end till we're ready, reopening!");
    batch.set("status", "running"); // don't close early (waiting for https://github.com/empiricaly/empirica/issues/213)
  }
});

Empirica.on("batch", "closed", (ctx, { batch }) => {
  // when the closeDate has been reached
  // close out players, shut down batch
  if (!batch.get("closed")) return;

  console.log(`Closing batch ${batch.id}`);

  const batchPlayers = ctx.scopesByKindMatching("player", "batchId", batch.id);
  batchPlayers.forEach((player) => {
    player.set("exitStatus", "incomplete");

    // get the game this player is assigned to
    const games = ctx.scopesByKind("game");
    const game = games.get(player.get("gameId"));

    if (!player.get("dataExported")) {
      // eslint-disable-next-line no-use-before-define
      closeOutPlayer({ player, batch, game });
      console.log(`Closing incomplete player ${player.id}.`);
    }
  });

  dispatchTimers.delete(batch.id);
  batch.set("status", "ended");
  console.log(`Batch ${batch.id} closed`);
});

// ------------------- Game callbacks ---------------------------

function scrubGame({ ctx, game }) {
  game.set("status", "failed");

  const players = ctx.scopesByKind("player");
  const startingPlayersIds = toArray(game.get("startingPlayersIds"));
  for (const id of startingPlayersIds) {
    if (players.has(id)) {
      const player = players.get(id);
      player.set("gameId", undefined);
      player.set("assigned", false);
      player.set("position", undefined);
    }
  }
  console.log("Game Scrubbed");
  // Todo: rerun dispatcher here
}

Empirica.on("game", async (ctx, { game }) => {
  if (game.get("initialized") || game.get("status") === "failed") return;
  // on game created
  // add indicated players to game, then start it

  try {
    const players = ctx.scopesByKind("player");
    const startingPlayersIds = toArray(game.get("startingPlayersIds"));
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
    console.log(" - starting players:", game.get("startingPlayersIds"));
    console.log("Error:", err);
    scrubGame({ ctx, game });
  }
});

Empirica.on("game", "start", async (ctx, { game, start }) => {
  if (!start) return;
  // on game start
  try {
    const { players } = game;
    console.log("Game treatment", game.get("treatment"));
    const { gameStages, assignPositionsBy } = game.get("treatment");

    console.log("game Stages:", gameStages);
    const identifiers = assignPositions({ players, assignPositionsBy });
    const round = game.addRound({ name: "main" });
    gameStages.forEach((stage) => round.addStage(stage));

    const { name, url } = await CreateRoom(game.id); // Todo, omit this on a batch config option?
    game.set("dailyUrl", url);
    game.set("dailyRoomName", name);
    console.log(`Created Daily room with name ${name} at url ${url}`);
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
    const openBatches = ctx.scopesByKindMatching(
      "batch",
      "acceptingParticipants",
      true
    );

    if (!player.get("initialized") && openBatches) {
      const playerBatch = selectOldestBatch(openBatches);

      player.set("batchId", playerBatch?.id);
      player.set("introSequence", playerBatch?.get("introSequence"));
      player.set("launchDate", playerBatch?.get("launchDate"));
      player.set("timeArrived", Date.now());

      // get any data we have on this participant from prior activities
      const platformId = paymentIDForParticipantID?.get(participantID);
      const participantData = await getParticipantData({ platformId });
      player.set("participantData", participantData);

      playersForParticipant.set(participantID, player);
      player.set("initialized", true);
      console.log(
        `initialized player ${player.id} in batch ${playerBatch?.id}"`
      );
    }
  } catch (err) {
    console.log(`Error initializing player ${participantID}:`, err);
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
  if (dispatchTimers.has(batch.id)) return;
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

  const batchId = player.get("batchId");
  const batches = ctx.scopesByKind("batch");
  const batch = batches?.get(batchId);

  debounceRunDispatch({ batch, batchId, ctx });
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
  if (!player.get("playerComplete")) return;
  // fires when participant finishes the QC survey

  const batches = ctx.scopesByKind("batch");
  const batch = batches?.get(player.get("batchId"));
  const games = ctx.scopesByKind("game");
  const game = games?.get(player.get("gameId"));

  console.log(`Player ${player.id} done`);
  player.set("exitStatus", "complete");

  closeOutPlayer({ player, batch, game });
});
