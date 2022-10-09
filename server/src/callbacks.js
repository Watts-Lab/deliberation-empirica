import { TajribaEvent } from '@empirica/core/admin';
import { ClassicListenersCollector } from '@empirica/core/admin/classic';
import axios from 'axios';
import { strict as assert } from 'node:assert';
// import { debug } from 'deliberation-empirica/debug';
import { CloseRoom, CreateRoom, GetRoom } from './meetingRoom';

const config = {
  hourlyPay: 15, // how much do we pay participants by the hour
  highPayAlert: 10, // at what cumulative payment should we raise a warning
};

const debug = false;
const debugDuration = 10000;

export const Empirica = new ClassicListenersCollector();

Empirica.onGameStart(async ({ game }) => {
  const {
    topic,
    readDuration,
    trainingVideoDuration,
    icebreakerDuration,
    icebreaker,
    discussionDuration,
  } = game.get('treatment');

  // const gameExitSurveys = Array.isArray(ExitSurveys)
  //   ? ExitSurveys
  //   : [ExitSurveys];
  // const surveys = [];
  // const surveyScores = [];

  // gameExitSurveys.forEach(survey => {
  //   surveys.push(game.batch.get('ExitSurveys')[survey]);
  //   surveyScores.push(game.batch.get('ExitScores')[survey]);
  // });

  // game.set('ExitSurveys', surveys);
  // game.set('ExitScores', surveyScores);
  // game.set('QCSurvey', game.batch.get('QCSurveys')[QCSurvey]);

  const { players } = game;
  const ids = [];
  const identifers = [];

  players.forEach(player => {
    ids.push(player.id);
    identifers.push(player.id);
  });

  game.set('gameStartPlayerIds', ids);

  const round = game.addRound({ name: 'Discussion' });
  round.set('topic', game.batch.get('topics')[topic]);

  round.addStage({
    name: 'Topic Survey',
    duration: debug ? debugDuration : readDuration,
  });

  if (trainingVideoDuration && trainingVideoDuration > 0) {
    round.addStage({
      name: 'TrainingVideo',
      duration: debug ? debugDuration : trainingVideoDuration,
    });
  }

  if (icebreakerDuration && icebreakerDuration > 0) {
    round.addStage({
      name: 'Icebreaker',
      duration: debug ? debugDuration : icebreakerDuration,
    });
    round.set('icebreaker', game.batch.get('icebreakers')[icebreaker]);
  }

  round.addStage({
    name: 'Discuss',
    duration: debug ? debugDuration : discussionDuration,
  });

  console.log(`game is now starting with players: ${identifers}`);

  /*
  Create rooms on game start.
  Attach room url to game object
  Can close rooms manually or just set long enough expiry
  */
  const { name, url } = await CreateRoom(game.id);
  if (!url) {
    console.log(`Room creation with name ${game.id} failed!`);
  } else {
    game.set('dailyUrl', url);
    game.set('dailyRoomName', name);
    console.log(`Created Daily room with name ${name} at url ${url}`);
  }
});

/*
Empirica.onRoundStart(({ round }) => { });
*/

Empirica.onStageStart(async ({ stage }) => {
  // Check if daily room exists on start of video stages
  const game = stage.currentGame;
  if (stage.get('name') === 'Discuss' || stage.get('name') === 'Icebreaker') {
    const { url } = await GetRoom(game.id);
    if (!url) {
      console.log(`Expected room with name ${game.id} was not created. Attempting Recreation.`);
      const { newName, newUrl } = await CreateRoom(game.id);
      if (!newUrl) {
        console.log(`Failed to create room with name ${game.id}. Video stage cannot proceed properly.`);
      } else {
        game.set('dailyUrl', newUrl);
        game.set('dailyRoomName', newName);
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
  players.forEach(player => {
    ids.push(player.id);
    identifers.push(player.id);
  });

  CloseRoom(game.get('dailyRoomName'));

  game.set('gameEndPlayerIds', ids);
  console.log(`game ending with players: ${identifers}`);
});

Empirica.on('player', (_, { player }) => {
  if (player.set('activeMinutes') === undefined) {
    player.set('activeMinutes', 0); // accumulator for the time that we will pay the player
  }
});

function startPaymentTimer(player) {
  const date = new Date();
  const timeNow = date.getTime();
  player.set('paymentTimerStarted', timeNow);
}

function pausePaymentTimer(player) {
  const date = new Date();
  const timeNow = date.getTime();
  const startedTime = player.get('paymentTimerStarted');
  const minutesElapsed = (timeNow - startedTime) / 1000 / 60;
  const cumulativeTime = player.get('activeMinutes') + minutesElapsed;
  player.set('activeMinutes', cumulativeTime);
}

//
// Player connect/disconnect
//
// NOTE(np): my appologies for the hacky way we are doing this. There will be a
// dedicated event for this in the future.
//

function playerConnected(player) {
  console.log(`Player ${player.id} connected.`);
  if (!player.get("playerComplete")) startPaymentTimer(player);
  player.set("deployEnvironment", process.env.DEPLOY_ENVIRONMENT)
}

function playerDisconnected(player) {
  console.log(`Player ${player.id} disconnected.`);
  if (!player.get("playerComplete")) pausePaymentTimer(player);
}

const playersForParticipant = new Map();
const online = new Map();

Empirica.on(TajribaEvent.ParticipantConnect, async (_, { participant }) => {
  online.set(participant.id, participant);

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

Empirica.on('player', async (_, { player }) => {
  const participantID = player.get('participantID');
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
Empirica.on('player', 'playerComplete', (_, { player }) => {
  if (player.get('playerComplete') && !player.get('dollarsOwed')) {
    pausePaymentTimer(player);

    const activeMinutes = player.get('activeMinutes');
    const dollarsOwed = ((activeMinutes / 60) * config.hourlyPay).toFixed(2);
    player.set('dollarsOwed', dollarsOwed);

    if (dollarsOwed > config.highPayAlert) {
      console.warn(`High payment for ${player.id}: ${dollarsOwed}`);
    }

    console.log(
      `Owe ${player.id} `
        + `$${player.get('dollarsOwed')} for `
        + `${player.get('activeMinutes')} minutes`,
    );
  } else {
    console.log('PlayerComplete callback erroneously called!');
  }
});

function pluckUniqueFactors(treatments, factor) {
  // gets all unique treatment values for a given factor
  const s = new Set();
  treatments.forEach(t => {
    if (t.treatment.factors[factor]) s.add(t.treatment.factors[factor]);
  });

  return Array.from(s);
}

Empirica.on('batch', async (_, { batch }) => {
  const { config: { treatments } } = batch.get('config');

  if (!batch.get('topics')) {
    for (const topicFile of pluckUniqueFactors(treatments, 'topic')) {
      const url = `https://raw.githubusercontent.com/Watts-Lab/deliberation-topics/main/topics/${topicFile}`;
      let topic;
      try {
        const response = await axios.get(url);
        topic = response.data;
        console.log(`Fetched topic from: ${url}`);
      } catch (error) {
        console.error(`Unable to fetch topic from: ${url}`);
        console.error(error);
      }

      // check that it is formatted as we expect
      try {
        const question = topic
          .split('Prompt')[1]
          .replace('"', '')
          .split('Responses')[0]
          .replace('"', '');
        const responses = topic.split('Responses')[1]; // get everything after responses (the answers)
        const answers = responses
          .split('\n- ')
          .filter(item => item.length > 2); // exclude empty rows

        assert(question.length > 30);
        assert(responses.length > 30);
        assert(answers.length > 1);
      } catch (error) {
        console.error('Topic failed to parse: ');
        console.error(topic);
      }

      const topics = batch.get('topics') || {};
      topics[topicFile] = topic;

      batch.set('topics', topics);
    }
  }

  if (!batch.get('icebreakers')) {
    for (const textFile of pluckUniqueFactors(treatments, 'icebreaker')) {
      const url = `https://raw.githubusercontent.com/Watts-Lab/deliberation-interventions/main/text/icebreakers/${textFile}`;
      let icebreaker;
      try {
        const response = await axios.get(url);
        icebreaker = response.data;
        console.log(`Fetched icebreaker text from: ${url}`);
      } catch (error) {
        console.error(`Unable to fetch icebreaker text from: ${url}`);
        console.error(error);
      }

      const icebreakers = batch.get('icebreakers') || {};
      icebreakers[textFile] = icebreaker;
      batch.set('icebreakers', icebreakers);
    }
  }

});
