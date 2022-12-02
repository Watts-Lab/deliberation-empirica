/*
Some callbacks have syntactic sugar (onGameStart, onStageStart etc). 
This sugar is define here: https://github.com/empiricaly/empirica/blob/b9cc5f2f1558b534f7b3852dd607e7627588de1b/lib/%40empirica/core/src/admin/classic/proxy.ts

The callbacks in general seem to follow the format:


Todo: need to check that there are batches before displaying intro screens

Todo: lots of the Maps won't be robust to server restarts
*/

import { TajribaEvent } from "@empirica/core/admin";
import { ClassicListenersCollector } from "@empirica/core/admin/classic";
import * as fs from "fs";
import { CloseRoom, CreateRoom, GetRoom } from "./meetingRoom";
import { makeDispatcher } from "./dispatch";
import { getTreatments } from "./getTreatments";

//import { toJSON } from "flatted";

const empiricaDir =
  process.env.DEPLOY_ENVIRONMENT === "dev" ? "/build/.empirica" : "/.empirica";

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

Empirica.on("batch", (_, { batch }) => {
  if (!batch.get("initialized")) {
    const { config } = batch.get("config");
    try {
      const treatmentFile = `${empiricaDir}/${config.treatmentFile}`;
      const treatments = getTreatments(treatmentFile, config.useTreatments);
      dispatchers.set(batch.id, makeDispatcher({ treatments }));

      batch.set("treatments", treatments);
      batch.set("launchDate", config.launchDate);
      batch.set("endDate", config.endDate);
      batch.set("dispatchWait", config.dispatchWait);
      batch.set("initialized", true);
      console.log(`Initialized Batch ${batch.id}`);
    } catch (err) {
      console.log(`Failed to create batch with config:`);
      console.log(JSON.stringify(config));
      console.log(err);
      batch.set("status", "failed");
    }
  } else {
    // put the following outside the idempotency check
    // so that if the server restarts and the batch already exists,
    // we can repopulate the dispatchers map
    const treatments = batch.get("treatments");
    if (
      !dispatchers.has(batch.id) &&
      batch.get("status") !== "failed" &&
      batch.get("status") !== "terminated" &&
      treatments?.filter((t) => t.factors).length > 0
    ) {
      console.log("rebuilding dispatcher");
      dispatchers.set(batch.id, makeDispatcher({ treatments }));
    }
  }
});

Empirica.on("batch", "status", (ctx, { batch }) => {
  const openBatches = ctx.scopesByKindMatching("batch", "status", "running");
  ctx.globals.set("batchOpen", openBatches.length > 0);
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
      player.set("gameID", game.id);
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
  const { gameStages } = game.get("treatment");

  const ids = [];
  const identifers = [];
  players.forEach((player) => {
    ids.push(player.id);
    identifers.push(player.id);
  });

  const round = game.addRound({ name: "main" });

  gameStages.forEach((stage) => {
    let prompt = [];
    if (stage.prompt) {
      const promptList = toArray(stage.prompt);
      prompt = promptList.map((promptName) =>
        fs.readFileSync(`/topics/${promptName}`, {
          encoding: "utf8",
        })
      );
    }

    round.addStage({
      name: stage.name,
      type: stage.type,
      url: stage.url || "",
      prompt,
      duration: stage.duration || 2000,
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
  const game = stage.currentGame;
  if (stage.get("type") === "discussion") {
    const { url } = await GetRoom(game.id);
    if (!url) {
      console.log(
        `Expected room with name ${game.id} was not created. Attempting Recreation.`
      );
      const { newName, newUrl } = await CreateRoom(game.id);
      if (!newUrl) {
        console.log(
          `Failed to create room with name ${game.id}. Video stage cannot proceed properly.`
        );
      } else {
        game.set("dailyUrl", newUrl);
        game.set("dailyRoomName", newName);
        console.log(`Created Daily room with name ${newName} at url ${newUrl}`);
      }
    }
  }
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
  const openBatches = ctx.scopesByKindMatching("batch", "status", "running");
  const participantID = player.get("participantID");

  if (!player.get("initialized") && openBatches) {
    // Assign player to oldest batch
    let batch = openBatches[0];
    // eslint-disable-next-line no-restricted-syntax
    for (const b of openBatches) {
      if (Date.parse(batch.get("createdAt")) > Date.parse(b.get("createdAt")))
        batch = b;
    }

    player.set("batchID", batch.id);
    player.set("launchDate", batch.get("launchDate"));
    player.set("deployEnvironment", process.env.DEPLOY_ENVIRONMENT);
    player.set("initialized", true);

    playersForParticipant.set(participantID, player);

    console.log(
      `initializing player ${player.id} with env "${process.env.DEPLOY_ENVIRONMENT} and batch ${batch.id}"`
    );
  }

  if (online.has(participantID)) {
    playerConnected(player);
  }
});

function runDispatch(batchID, ctx) {
  dispatchTimers.delete(batchID);
  console.log(`runDispatch`);

  const players = ctx.scopesByKind("player");
  const batches = ctx.scopesByKind("batch");
  const batch = batches.get(batchID);
  const dispatcher = dispatchers.get(batchID);

  const playersReady = [];
  const playersWaiting = []; // still in intro steps
  const playersAssigned = [];
  players.forEach((player) => {
    if (player.get("connected")) {
      if (player.get("gameID") || player.get("assigned")) {
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
  if (player.get("gameID")) return;

  // get the batch this player is assigned to
  const batchID = player.get("batchID");
  const batches = ctx.scopesByKind("batch");
  const batch = batches.get(batchID);

  // after the first player joins, wait {dispatchWait} seconds
  // before running dispatch to see if other players join
  if (!dispatchTimers.has(batchID)) {
    const dispatchWait = batch.get("dispatchWait");
    console.log(`setting ${dispatchWait} second dispatch timer`);
    dispatchTimers.set(
      batchID,
      setTimeout(runDispatch, dispatchWait * 1000, batchID, ctx)
    );
  }

  // todo: set a player timer (5-10 mins?) that takes care
  // of the player if they don't get assigned a game within a certain amount of time.
  console.log(`player ${player.id} introDone`);
});

//
// End player connect/disconnect

// Todo: what happens if a player leaves and never gets to a screen that
// sets playerComplete? Should we check that it is set for all players at some point
// after the game?
// set a timer onDisconnect for the player, if it goes off, consider them done.
// Empirica.on("player", "playerComplete", (_, { player }) => {
//   if (player.get("playerComplete") && !player.get("dollarsOwed")) {
//     pausePaymentTimer(player);
//     const paymentID = paymentIDForParticipantID.get(player.participantID);

//     const activeMinutes = player.get("activeMinutes");
//     const dollarsOwed = ((activeMinutes / 60) * config.hourlyPay).toFixed(2);
//     player.set("dollarsOwed", dollarsOwed);

//     if (dollarsOwed > config.highPayAlert) {
//       console.warn(`High payment for ${paymentID}: ${dollarsOwed}`);
//     }

//     try {
//       let platform = "other";
//       const urlParams = player.get("urlParams");
//       if (urlParams.hitId) {
//         platform = "turk";
//       } else if (urlParams.PROLIFIC_PID) {
//         platform = "prolific";
//       }

//       const paymentGroup = urlParams.hitId || urlParams.STUDY_ID || "default";
//       const paymentsFilename = `${empiricaDir}/local/payments_${platform}_${paymentGroup}.csv`;
//       fs.appendFile(
//         paymentsFilename,
//         `${paymentID}, ` +
//           `${dollarsOwed}, ` +
//           `${player.get("activeMinutes")}, ` +
//           `${player.participantID}\n`,
//         (err) => {
//           if (err) {
//             console.log(err);
//           }
//         }
//       );
//     } catch (err) {
//       console.log("Could not append to payment file");
//       console.log(err.message);
//     }

//     console.log(
//       `Owe ${player.paymentID} ` +
//         `${player.get("dollarsOwed")} for ` +
//         `${player.get("activeMinutes")} minutes ` +
//         `as participant ${player.participantID}`
//     );
//   } else {
//     console.log("PlayerComplete callback erroneously called!");
//   }
// });
