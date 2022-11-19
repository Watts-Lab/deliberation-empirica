/*
Some callbacks have syntactic sugar (onGameStart, onStageStart etc). 
This sugar is define here: https://github.com/empiricaly/empirica/blob/b9cc5f2f1558b534f7b3852dd607e7627588de1b/lib/%40empirica/core/src/admin/classic/proxy.ts

The callbacks in general seem to follow the format:


Todo: need to check that there are batches before displaying intro screens
*/

import { TajribaEvent } from "@empirica/core/admin";
import { ClassicListenersCollector } from "@empirica/core/admin/classic";
import { load as loadYaml } from "js-yaml";
import * as fs from "fs";
import { CloseRoom, CreateRoom, GetRoom } from "./meetingRoom";
import { makeDispatcher } from "./dispatch";

const empiricaDir =
  process.env.DEPLOY_ENVIRONMENT === "dev" ? "/build/.empirica" : "/.empirica";

const config = {
  hourlyPay: 15, // how much do we pay participants by the hour
  highPayAlert: 10, // at what cumulative payment should we raise a warning
};

export const Empirica = new ClassicListenersCollector();

const playerMap = new Map(); // keys are player ids, values are player objects
const batchMap = new Map(); // keys are batch ids, values are batch objects
const dispatchers = new Map(); // keys are batch ids, values are dispatcher functions for that batch
const dispatchTimers = new Map(); // keys are batch ids, values are timer objects unique to the batch
const playersForParticipant = new Map();
const paymentIDForParticipantID = new Map();
const online = new Map();

Empirica.on("batch", (_, { batch }) => {
  if (batch.get("initialized")) {
    return;
  }

  console.log("Batch ID", batch.id);
  const { config } = batch.get("config");
  const treatments = loadYaml(
    fs.readFileSync(`${empiricaDir}/${config.treatmentFile}`, "utf8")
  )?.treatments;

  batch.set("launchDate", config.launchDate);
  batch.set("endDate", config.endDate);
  batch.set("initialized", true);
  batch.set("dispatchWait", config.dispatchWait);

  dispatchers.set(batch.id, makeDispatcher({ treatments }));
  batchMap.set(batch.id, batch);

  batch.set("initialized", true);
});

Empirica.onGameStart(async ({ game }) => {
  const { gameStages } = game.get("treatment");

  const { players } = game;
  const ids = [];
  const identifers = [];

  players.forEach((player) => {
    ids.push(player.id);
    identifers.push(player.id);
  });

  game.set("gameStartPlayerIds", ids);

  const round = game.addRound({ name: "main" });

  gameStages.forEach((stage) => {
    let prompt = [];
    if (stage.prompt) {
      const promptList =
        stage.prompt instanceof Array ? stage.prompt : [stage.prompt];
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

  /*
  Create rooms on game start.
  Attach room url to game object
  Can close rooms manually or just set long enough expiry
  */
  // Todo: don't actually create rooms when testing...
  const { name, url } = await CreateRoom(game.id);
  if (!url) {
    console.log(`Room creation with name ${game.id} failed!`);
  } else {
    game.set("dailyUrl", url);
    game.set("dailyRoomName", name);
    console.log(`Created Daily room with name ${name} at url ${url}`);
  }
});

/*
Empirica.onRoundStart(({ round }) => { });
*/

Empirica.onStageStart(async ({ stage }) => {
  // Check if daily room exists on start of video stages
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

/*
Empirica.onStageEnded(({ stage }) => { });

Empirica.onRoundEnded(({ round }) => {
  CloseRoom(round.id);
});
*/

Empirica.onGameEnded(({ game }) => {
  const { players } = game;
  const ids = [];
  const identifers = [];

  players.forEach((player) => {
    const paymentID = paymentIDForParticipantID.get(player.participantID);
    ids.push(player.id);
    identifers.push(paymentID);
  });

  CloseRoom(game.get("dailyRoomName"));

  game.set("gameEndPlayerIds", ids);
  console.log(`game ending with players: ${identifers}`);
});

Empirica.on("player", (_, { player }) => {
  if (player.set("activeMinutes") === undefined) {
    player.set("activeMinutes", 0); // accumulator for the time that we will pay the player
  }
});

function startPaymentTimer(player) {
  const date = new Date();
  const timeNow = date.getTime();
  player.set("paymentTimerStarted", timeNow);
}

function pausePaymentTimer(player) {
  const date = new Date();
  const timeNow = date.getTime();
  const startedTime = player.get("paymentTimerStarted");
  const minutesElapsed = (timeNow - startedTime) / 1000 / 60;
  const cumulativeTime = player.get("activeMinutes") + minutesElapsed;
  player.set("activeMinutes", cumulativeTime);
}

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

  if (!player.get("playerComplete")) startPaymentTimer(player);
  player.set("deployEnvironment", process.env.DEPLOY_ENVIRONMENT);
}

function playerDisconnected(player) {
  player.set("connected", false);
  const paymentID = paymentIDForParticipantID.get(player.participantID);
  console.log(`Player ${paymentID} disconnected.`);
  if (!player.get("playerComplete")) pausePaymentTimer(player);
}

Empirica.on(TajribaEvent.ParticipantConnect, async (_, { participant }) => {
  online.set(participant.id, participant);
  const player = playersForParticipant.get(participant.id);

  paymentIDForParticipantID.set(participant.id, participant.identifier); // to facilitate payment
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

Empirica.on("player", async (_, { player }) => {
  const participantID = player.get("participantID");
  playersForParticipant.set(participantID, player);
  playerMap.set(player.id, player);

  if (online.has(participantID)) {
    playerConnected(player);
  }
});

function runDispatch(batchID) {
  dispatchTimers.delete(batchID);
  console.log(`runDispatch`);

  const batch = batchMap.get(batchID);
  const dispatcher = dispatchers.get(batchID);

  const playersReady = [];
  const playersWaiting = [];
  const playersAssigned = [];
  playerMap.forEach((player) => {
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
      playerMap.get(id).set("assigned", true);
    });

    console.log(
      `Adding game with treatment ${treatment.name}, players ${playerIds}`
    );
  });
}

Empirica.on("player", "introDone", (ctx, { player }) => {
  console.log(`player ${player.id} introDone`);
  if (player.get("gameID")) {
    return; // already assinged to a game
  }
  // get the batch this player is assigned to
  const scopes = {};
  ctx.subs.scopeKVs.forEach((item) => {
    scopes[item.key] = JSON.parse(item.val);
  });
  const { batchID } = scopes;
  player.set("batchID", batchID);

  const batch = batchMap.get(batchID);
  batch.get("dispatchWait");

  // todo: set a player timer (5 mins?) that takes care
  // of the player if they don't get assigned a game.

  // after the first player joins, wait 30 seconds
  // before running dispatch to see if other players join
  if (!dispatchTimers.has(batchID)) {
    const dispatchWait = batch.get("dispatchWait");
    console.log(`setting ${dispatchWait} second dispatch timer`);
    dispatchTimers.set(setTimeout(runDispatch, dispatchWait * 1000, batchID));
  }
});

Empirica.on("game", async (ctx, { game }) => {
  if (game.get("initialized")) {
    return;
  }
  game.set("initialized", true);

  console.log("starting player ids: ", game.get("startingPlayersIds"));

  // add indicated players to game
  let startingPlayersIds = game.get("startingPlayersIds");
  if (!(startingPlayersIds instanceof Array)) {
    startingPlayersIds = [startingPlayersIds];
  }
  // eslint-disable-next-line no-restricted-syntax
  for (const id of startingPlayersIds) {
    if (playerMap.has(id)) {
      const player = playerMap.get(id);
      await game.assignPlayer(player);
    } else {
      console.log(`unknown player id ${id}`);
    }
  }
  game.start();
});

//
// End player connect/disconnect

// Todo: what happens if a player leaves and never gets to a screen that
// sets playerComplete? Should we check that it is set for all players at some point
// after the game?
// set a timer onDisconnect for the player, if it goes off, consider them done.
Empirica.on("player", "playerComplete", (_, { player }) => {
  if (player.get("playerComplete") && !player.get("dollarsOwed")) {
    pausePaymentTimer(player);
    const paymentID = paymentIDForParticipantID.get(player.participantID);

    const activeMinutes = player.get("activeMinutes");
    const dollarsOwed = ((activeMinutes / 60) * config.hourlyPay).toFixed(2);
    player.set("dollarsOwed", dollarsOwed);

    if (dollarsOwed > config.highPayAlert) {
      console.warn(`High payment for ${paymentID}: ${dollarsOwed}`);
    }

    try {
      let platform = "other";
      const urlParams = player.get("urlParams");
      if (urlParams.hitId) {
        platform = "turk";
      } else if (urlParams.PROLIFIC_PID) {
        platform = "prolific";
      }

      const paymentGroup = urlParams.hitId || urlParams.STUDY_ID || "default";
      const paymentsFilename = `${empiricaDir}/local/payments_${platform}_${paymentGroup}.csv`;
      fs.appendFile(
        paymentsFilename,
        `${paymentID}, ` +
          `${dollarsOwed}, ` +
          `${player.get("activeMinutes")}, ` +
          `${player.participantID}\n`,
        (err) => {
          if (err) {
            console.log(err);
          }
        }
      );
    } catch (err) {
      console.log("Could not append to payment file");
      console.log(err.message);
    }

    console.log(
      `Owe ${player.paymentID} ` +
        `${player.get("dollarsOwed")} for ` +
        `${player.get("activeMinutes")} minutes ` +
        `as participant ${player.participantID}`
    );
  } else {
    console.log("PlayerComplete callback erroneously called!");
  }
});
