import { TajribaEvent } from "@empirica/core/admin";
import { ClassicListenersCollector } from "@empirica/core/admin/classic";
import * as fs from "fs";
import { CloseRoom, CreateRoom, GetRoom } from "./meetingRoom";

const config = {
  hourlyPay: 15, // how much do we pay participants by the hour
  highPayAlert: 10, // at what cumulative payment should we raise a warning
};

export const Empirica = new ClassicListenersCollector();
const paymentIDForParticipantID = new Map();

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
    // const prompt = stage.prompt
    //   ? fs.readFileSync(`/topics/${stage.prompt}`, {
    //       encoding: "utf8",
    //     })
    //   : ""; // relative to `server/` folder

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

  // let playerIDs = new Array[players.length]
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
  const paymentID = paymentIDForParticipantID.get(player.participantID);
  console.log(`Player ${paymentID} connected.`);

  if (!player.get("playerComplete")) startPaymentTimer(player);
  player.set("deployEnvironment", process.env.DEPLOY_ENVIRONMENT);
}

function playerDisconnected(player) {
  const paymentID = paymentIDForParticipantID.get(player.participantID);
  console.log(`Player ${paymentID} disconnected.`);
  if (!player.get("playerComplete")) pausePaymentTimer(player);
}

const playersForParticipant = new Map();
const online = new Map();

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

  if (online.has(participantID)) {
    playerConnected(player);
  }
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
      const paymentGroup = player.get("hitID") || "default";
      const empiricaDir =
        process.env.DEPLOY_ENVIRONMENT === "dev"
          ? "/build/.empirica"
          : "/.empirica";
      const paymentsFilename = `${empiricaDir}/local/payments_${paymentGroup}.csv`;
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
