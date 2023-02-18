/*

*/

import { TajribaEvent } from "@empirica/core/admin";
import { ClassicListenersCollector } from "@empirica/core/admin/classic";
import * as fs from "fs";
import { CloseRoom, CreateRoom, GetRoom } from "./meetingRoom";
import { makeDispatcher } from "./dispatch";
import { getTreatments, getResourceLookup } from "./getTreatments";
import { getParticipantData } from "./participantData";
import { exportPlayerData } from "./dataStorage";

// import { toJSON } from "flatted";

const empiricaDir = process.env.EMPIRICA_DIR;
// process.env.DEPLOY_ENVIRONMENT === "dev" ? "/build/.empirica" : "/.empirica";

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

// function updateBatchInfo(ctx, batch, updates) {
//   // maintains a batch info on the globals, as we don't have a "useBatch" hook
//   const batchInfoGlobalKey = `batchInfo_${batch.id}`;
//   const batchInfo = ctx.globals.get(batchInfoGlobalKey) || {};
//   const newBatchInfo = { ...batchInfo, ...updates };
//   ctx.globals.set(batchInfoGlobalKey, newBatchInfo);
// }

Empirica.on("batch", async (ctx, { batch }) => {
  // Batch created

  if (!batch.get("initialized")) {
    const lookup = await getResourceLookup();
    ctx.globals.set("resourceLookup", lookup);

    const { config } = batch.get("config");
    try {
      // Todo: validate config file here

      const treatmentFile = `${empiricaDir}/${config.treatmentFile}`;
      const { introSequence, treatments } = await getTreatments(
        treatmentFile,
        config.useTreatments,
        config.useIntroSequence
      );
      batch.set("treatments", treatments);
      batch.set("introSequence", introSequence);

      // Todo: check all resource paths from all treatments resolve
      // Todo: compute minimum and maximum payout for all treatments
      // Todo: set payment, start time info for oldest open batch

      console.log(`Initialized Batch ${batch.id}`);
      batch.set("initialized", true);
    } catch (err) {
      console.log(`Failed to create batch with config:`);
      console.log(JSON.stringify(config));
      console.log(err);
      batch.set("status", "failed");
    }
  }
  // this bit will run on a server restart or on batch creation
  const treatments = batch.get("treatments");
  if (!dispatchers.has(batch.id)) {
    // todo: maybe don't build dispatchers for closed games?
    console.log("building dispatcher");
    dispatchers.set(batch.id, makeDispatcher({ treatments }));
  }
});

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
  const openBatches = ctx.scopesByKindMatching(
    "batch",
    "acceptingParticipants",
    true
  );
  ctx.globals.set("batchesAcceptingParticipants", openBatches.length > 0);

  if (openBatches.length > 0) {
    // The oldest currently recruiting batch is the one that will get players assigned to it
    let oldestBatch = openBatches[0];
    // eslint-disable-next-line no-restricted-syntax
    for (const b of openBatches) {
      if (
        Date.parse(oldestBatch.get("createdAt")) >
        Date.parse(b.get("createdAt"))
      )
        oldestBatch = b;
    }
    // TODO: only update if there is a change? does this matter?
    ctx.globals.set(
      "recruitingBatchConfig",
      openBatches.length > 0 ? oldestBatch.get("batchConfig") : undefined
    );
  }
});

Empirica.on("batch", "status", (ctx, { batch }) => {
  // deal with failure conditions
  const status = batch.get("status"); // {running, ended, terminated, failed}
  if (status === "running") return;

  if (status === "terminated" || status === "failed") {
    batch.set("acceptingParticipants", false);
    batch.set("closed");
  }

  if (status === "ended" && !batch.get("closed")) {
    batch.set("status", "running"); // don't close early (waiting for https://github.com/empiricaly/empirica/issues/213)
  }

  console.log(`Batch ${batch.id} ended with status "${status}"`);
});

Empirica.on("batch", "closed", (ctx, { batch }) => {
  // when the closeDate has been reached
  // close out players, shut down batch
  if (!batch.get("closed")) return;

  const batchPlayers = ctx.scopesByKindMatching("player", "batchId", batch.id);
  batchPlayers.forEach((player) => {
    player.set("exitStatus", "incomplete");
    // eslint-disable-next-line no-use-before-define
    if (!player.get("dataExported")) closeOutPlayer({ player, batch });
  });

  batch.set("status", "ended");
  console.log(`Batch ${batch.id} closed`);
});

// ------------------- Game callbacks ---------------------------

Empirica.on("game", async (ctx, { game }) => {
  if (game.get("initialized")) return;
  const players = ctx.scopesByKind("player");

  // add indicated players to game
  const startingPlayersIds = toArray(game.get("startingPlayersIds"));
  // eslint-disable-next-line no-restricted-syntax
  for (const id of startingPlayersIds) {
    if (players.has(id)) {
      const player = players.get(id);
      player.set("gameId", game.id);
      // eslint-disable-next-line no-await-in-loop
      await game.assignPlayer(player);
    } else {
      console.log(`unknown player id ${id}`);
    }
  }

  game.set("initialized", true);
  game.start();
});

Empirica.onGameStart(async ({ game }) => {
  const { players } = game;
  const { gameStages, assignPositionsBy } = game.get("treatment");

  // Assign positions
  let scores = [];
  if (assignPositionsBy === undefined || assignPositionsBy === "random") {
    scores = players.map(() => Math.random());
  }
  const positions = Array.from(Array(scores.length).keys()).sort(
    (a, b) => scores[a] - scores[b]
  );
  // console.log(`Scores: ${scores}, positions: ${positions}`);

  const identifers = [];
  players.forEach((player, index) => {
    identifers.push(player.id);
    player.set("position", positions[index]);
  });

  const round = game.addRound({ name: "main" });

  gameStages.forEach((stage, index) => {
    let elements = [];
    if (stage.elements) {
      const elementArray = toArray(stage.elements);

      elements = elementArray.map((item) => {
        if (typeof item === "string" || item instanceof String) {
          return {
            file: item,
            name: item,
            type: "prompt",
            promptString: fs.readFileSync(`/topics/${item}`, {
              encoding: "utf8",
            }),
          };
        }
        if (item instanceof Object && "type" in item) {
          const newItem = { ...item };
          if (item.type === "prompt" && "file" in item) {
            newItem.name = item.name || item.file;
            newItem.promptString = fs.readFileSync(`/topics/${item.file}`, {
              encoding: "utf8",
            });
          }
          return newItem;
        }
        return item;
      });
    }

    round.addStage({
      name: stage.name || `stage${index}`,
      duration: stage.duration || 2000,
      chatType: stage.chatType || "none",
      elements,
    });
  });

  console.log(`game is now starting with players: ${identifers}`);

  // Todo: stub room creation when testing...
  const { name, url } = await CreateRoom(game.id);
  if (!url) {
    console.log(`Room creation with name ${game.id} failed!`);
  } else {
    game.set("dailyUrl", url);
    game.set("dailyRoomName", name);
    console.log(`Created Daily room with name ${name} at url ${url}`);
  }
});

Empirica.onGameEnded(({ game }) => {
  CloseRoom(game.get("dailyRoomName"));
  // Todo: save video information
});

// ------------------- Round callbacks ---------------------------
// Empirica.onRoundStart(({ round }) => { });

/*
Empirica.onRoundEnded(({ round }) => {
  CloseRoom(round.id);
});
*/

// ------------------- Stage callbacks ---------------------------

Empirica.onStageStart(async ({ stage }) => {
  // Ensure daily room exists on start of video stages
  // const game = stage.currentGame;
  // if (stage.get("type") === "discussion") {
  //   const { url } = await GetRoom(game.id);
  //   if (!url) {
  //     console.log(
  //       `Expected room with name ${game.id} was not created. Attempting Recreation.`
  //     );
  //     const { newName, newUrl } = await CreateRoom(game.id);
  //     if (!newUrl) {
  //       console.log(
  //         `Failed to create room with name ${game.id}. Video stage cannot proceed properly.`
  //       );
  //     } else {
  //       game.set("dailyUrl", newUrl);
  //       game.set("dailyRoomName", newName);
  //       console.log(`Created Daily room with name ${newName} at url ${newUrl}`);
  //     }
  //   }
  // }
});

// Empirica.onStageEnded(({ stage }) => { });

// ------------------- Player callbacks ---------------------------

//
// Player connect/disconnect
//
// NOTE(np): my appologies for the hacky way we are doing this. There will be a
// dedicated event for this in the future.
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
  const player = playersForParticipant.get(participant.id);

  paymentIDForParticipantID.set(participant.id, participant.identifier); // todo: shouldn't need to do this in next emprica version
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
  console.log("On player");
  const openBatches = ctx.scopesByKindMatching(
    "batch",
    "acceptingParticipants",
    true
  );
  const participantID = player.get("participantID");

  if (!player.get("initialized") && openBatches) {
    // called for the first time when participants submit their ID

    // This could be combined with code above that also finds the oldestBatch...
    let batch = openBatches[0];
    // eslint-disable-next-line no-restricted-syntax
    for (const b of openBatches) {
      if (Date.parse(batch.get("createdAt")) > Date.parse(b.get("createdAt")))
        batch = b;
    }

    // player.set("participantData", getParticipantData({}));

    player.set("batchId", batch.id);
    player.set("introSequence", batch.get("introSequence"));
    player.set("launchDate", batch.get("launchDate"));
    player.set("initializedAt", Date.now());
    player.set("initialized", true);

    playersForParticipant.set(participantID, player);

    console.log(`initializing player ${player.id} in batch ${batch.id}"`);
  }

  if (online.has(participantID)) {
    playerConnected(player);
  }
});

function runDispatch(batchId, ctx) {
  dispatchTimers.delete(batchId);
  console.log(`runDispatch`);

  const players = ctx.scopesByKind("player");
  const batches = ctx.scopesByKind("batch");
  const batch = batches.get(batchId);
  const dispatcher = dispatchers.get(batchId);

  const playersReady = [];
  const playersWaiting = []; // still in intro steps
  const playersAssigned = [];
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
        value: treatment.factors,
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
}

Empirica.on("player", "introDone", (ctx, { player }) => {
  if (player.get("gameId")) return;

  // get the batch this player is assigned to
  const batchId = player.get("batchId");
  const batches = ctx.scopesByKind("batch");
  const batch = batches.get(batchId);

  // after the first player joins, wait {dispatchWait} seconds
  // before running dispatch to see if other players join
  if (!dispatchTimers.has(batchId)) {
    const dispatchWait = batch.get("config")?.dispatchWait || 5;
    console.log(`setting ${dispatchWait} second dispatch timer`);
    dispatchTimers.set(
      batchId,
      setTimeout(runDispatch, dispatchWait * 1000, batchId, ctx)
    );
  }

  // todo: set a player timer (5-10 mins?) that takes care
  // of the player if they don't get assigned a game within a certain amount of time.
  console.log(`player ${player.id} introDone`);
});

function closeOutPlayer({ player, batch }) {
  exportPlayerData({ player, batch });

  // TODO:
  // - pay participant bonus or record the need to
  // - record changes to player data
  player.set("dataExported", true); // export science data
}

Empirica.on("player", "playerComplete", (ctx, { player }) => {
  console.log(`Player ${player.id} done`);

  // get the batch this player is assigned to
  const batches = ctx.scopesByKind("batch");
  const batch = batches.get(player.get("batchId"));

  const games = ctx.scopesByKind("game");
  console.log("games", games);
  const game = games.get(player.get("gameId"));
  console.log("game", game);

  player.set("exitStatus", "complete");
  closeOutPlayer({ player, batch, game });
});
