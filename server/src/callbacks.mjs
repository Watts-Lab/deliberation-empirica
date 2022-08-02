// Callbacks are here:
// https://github.com/empiricaly/empirica/blob/main/lib/@empirica/admin/src/callbacks.ts

import { Callbacks } from '@empirica/admin';
import axios from 'axios';
import { strict as assert } from 'node:assert';
import { GetRoom, CloseRoom } from './meetingRoom.mjs';

const config = {
  hourlyPay: 15, // how much do we pay participants by the hour
  highPayAlert: 10, // at what cumulative payment should we raise a warning
};

const Empirica = new Callbacks();
// eslint-disable-next-line import/no-default-export
export default Empirica;

Empirica.onGameStart(({ game }) => {
  game.set('TVSurvey', game.batch.get('TVSurveys')[game.treatment.TVSurvey]);
  game.set('QCSurvey', game.batch.get('QCSurveys')[game.treatment.QCSurvey]);

  const { players } = game;
  const ids = [];
  const identifers = [];
  players.forEach(player => {
    ids.push(player.participant.id);
    identifers.push(player.participant.identifier);
  });
  game.set('gameStartPlayerIds', ids);

  const round = game.addRound({ name: 'Discussion' });
  round.set('topic', game.batch.get('topics')[game.treatment.topic]);

  round.addStage({
    name: 'Topic Survey',
    duration: game.treatment.readDuration,
  });

  if (game.treatment.trainingVideoDuration > 0) {
    round.addStage({
      name: 'TrainingVideo',
      duration: game.treatment.trainingVideoDuration,
    });
  }

  if (game.treatment.icebreakerDuration > 0) {
    round.addStage({
      name: 'Icebreaker',
      duration: game.treatment.icebreakerDuration,
    });
  }

  round.addStage({
    name: 'Discuss',
    duration: game.treatment.discussionDuration,
  });

  console.log(`game is now starting with players: ${identifers}`);
});

/*
Empirica.onRoundStart(({ round }) => { });

Empirica.onStageStart(({ stage }) => { });

Empirica.onStageEnd(({ stage }) => { });

Empirica.onRoundEnd(({ round }) => {});
*/

Empirica.onGameEnd(({ game }) => {
  const { players } = game;
  const ids = [];
  const identifers = [];
  const roomIds = new Set();
  // let playerIDs = new Array[players.length]
  players.forEach(player => {
    ids.push(player.participant.id);
    identifers.push(player.participant.identifier);
    const playerRoomIds = player.get('roomIds') || [];
    playerRoomIds.forEach(id => roomIds.add(id));
  });
  roomIds.forEach(id => CloseRoom(id));

  game.set('gameEndPlayerIds', ids);
  console.log(`game ending with players: ${identifers}`);
});

Empirica.onNewPlayer(({ player }) => {
  player.set('activeMinutes', 0); // accumulator for the time that we will pay the player
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

Empirica.onPlayerConnected(({ player }) => {
  console.log(`Player ${player.participant.identifier} connected.`);
  if (!player.get('playerComplete')) startPaymentTimer(player);
});

Empirica.onPlayerDisconnected(({ player }) => {
  console.log(`Player ${player.participant.identifier} disconnected.`);
  if (!player.get('playerComplete')) pausePaymentTimer(player);
});

// Todo: what happens if a player leaves and never gets to a screen that
// sets playerComplete? Should we check that it is set for all players at some point
// after the game?
Empirica.onChange('player', 'playerComplete', ({ player }) => {
  if (player.get('playerComplete') && !player.get('dollarsOwed') {
    pausePaymentTimer(player);
    const activeMinutes = player.get('activeMinutes');
    const dollarsOwed = ((activeMinutes / 60) * config.hourlyPay).toFixed(2);
    player.set('dollarsOwed', dollarsOwed);
    if (dollarsOwed > config.highPayAlert) {
      console.warn(`High payment for ${player.participant.identifier}: ${dollarsOwed}`);
    }
    console.log(`Owe ${player.participant.identifier} $${player.get('dollarsOwed')} for ${player.get('activeMinutes')} minutes`);
  } else {
    console.log('PlayerComplete callback erroneously called!');
  }
});

function pluckUniqueFactors(treatments, factor) {
  // gets all unique treatment values for a given factor
  const s = new Set();
  treatments.forEach(t => s.add(t.treatment.factors[factor]));
  return Array.from(s);
}

Empirica.onNewBatch(async ({ batch }) => {
  const { config: { treatments } } = batch.get('config');

  pluckUniqueFactors(treatments, 'topic').forEach(async topicFile => {
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
      const question = topic.split('Prompt')[1].replace('"', '').split('Responses')[0].replace('"', '');
      const responses = topic.split('Responses')[1]; // get everything after responses (the answers)
      const answers = responses.split('\n- ').filter(item => item.length > 2); // exclude empty rows
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
  });

  pluckUniqueFactors(treatments, 'QCSurvey').forEach(async surveyFile => {
    const url = `https://raw.githubusercontent.com/Watts-Lab/surveys/main/src/surveys/${surveyFile}`;
    let survey;

    try {
      const response = await axios.get(url);
      survey = response.data;
      console.log(`Fetched survey from: ${url}`);
    } catch (error) {
      console.error(`Unable to fetch survey from: ${url}`);
      console.error(error);
    }
    // check that it parses
    try {
      JSON.parse(JSON.stringify(survey));
    } catch (error) {
      console.error('Unable to parse survey:');
      console.error(survey);
    }

    const QCSurveys = batch.get('QCSurveys') || {};
    QCSurveys[surveyFile] = survey;
    batch.set('QCSurveys', QCSurveys);
  });

  pluckUniqueFactors(treatments, 'TVSurvey').forEach(async surveyFile => {
    const url = `https://raw.githubusercontent.com/Watts-Lab/surveys/main/src/surveys/${surveyFile}`;
    let survey;

    try {
      const response = await axios.get(url);
      survey = response.data;
      console.log(`Fetched survey from: ${url}`);
    } catch (error) {
      console.error(`Unable to fetch survey from: ${url}`);
      console.error(error);
    }
    // check that it parses
    try {
      JSON.parse(JSON.stringify(survey));
    } catch (error) {
      console.error('Unable to parse survey');
      console.error(survey);
    }

    const TVSurveys = batch.get('TVSurveys') || {};
    TVSurveys[surveyFile] = survey;
    batch.set('TVSurveys', TVSurveys);
  });
});

Empirica.onChange('player', 'roomName', async ({ player }) => {
  if (player.get('roomName') && !player.get('accessKey')) {
    const { accessKey, id } = await GetRoom(player.get('nickname'), player.get('roomName'));
    player.set('accessKey', accessKey);
    const roomIds = player.get('roomIds') || [];
    roomIds.push(id);
    player.set('roomIds', roomIds);
    console.log(`Set access key for player ${player.participant.identifier} in room ${player.get('roomName')} with room id ${id} to ${player.get('accessKey')}`);
  } else if (!player.get('roomName')) {
    player.set('accessKey', null);
    console.log(`Player ${player.participant.identifier} leaving room. Setting access key to null.`);
  }
});

// Empirica.onChange('stage', 'recording_id', function ({ isNew, game, round, stage }) {
//   if (!isNew) {
//     return;
//   }
//   let recordings;
//     try {
//       recordings = JSON.parse(readFileSync('../recordings/recordingIds.json', 'utf-8'));
//     } catch (err) {
//       recordings = [];
//     }
//     recordings.push({
//       game: game.id,
//       round: round.id,
//       stage: stage.id,
//       recording: stage.get('recording_id')
//     });
//     writeFileSync('../recordings/recordingIds.json', JSON.stringify(recordings), 'utf-8');
// });
