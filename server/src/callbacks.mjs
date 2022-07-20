// Callbacks are here:
// https://github.com/empiricaly/empirica/blob/main/lib/@empirica/admin/src/callbacks.ts

import { Callbacks } from "@empirica/admin";
import axios from "axios";
import { strict as assert } from 'node:assert';

const config = {
  hourlyPay: 15,  // how much do we pay participants by the hour
  highPayAlert: 10  // at what cumulative payment should we raise a warning
}

const Empirica = new Callbacks();
export default Empirica;

Empirica.onGameStart(function ({ game }) {

  game.set("TVSurvey", game.batch.get("TVSurveys")[game.treatment.TVSurvey]);
  game.set("QCSurvey", game.batch.get("QCSurveys")[game.treatment.QCSurvey]);

  const players = game.players
  const ids = []
  const identifers = []
  players.forEach((player) => {
    ids.push(player.participant.id);
    identifers.push(player.participant.identifier)
  })
  game.set("gameStartPlayerIds", ids)

  const round = game.addRound({
    name: "Discussion",
  });
  round.set("topic", game.batch.get("topics")[game.treatment.topic]);
    
  round.addStage({
    name: "Topic Survey",
    duration: game.treatment.readDuration,
  });

  // TODO: make the addition of this stage a treatment variable
  // and when necessary substitute the video training stage
  if (game.treatment.icebreakerDuration > 0) {
    round.addStage({
      name: "Icebreaker",
      duration: game.treatment.icebreakerDuration,
    });
  }
  
  round.addStage({
    name: "Discuss",
    duration: game.treatment.discussionDuration,
  });


  console.log("game is now starting with players: " + identifers);
});

Empirica.onRoundStart(function ({ round }) {
  console.log("round start");
});

Empirica.onStageStart(function ({ stage }) {
  console.log("stage " + stage.get("name") + " start");
});

Empirica.onStageEnd(function ({ stage }) {
  console.log("stage end");
});

Empirica.onRoundEnd(function ({ round }) {});

Empirica.onGameEnd(function ({ game }) {
  const players = game.players
  const ids = []
  const identifers = []
  //let playerIDs = new Array[players.length]
  players.forEach((player) => {
    ids.push(player.participant.id);
    identifers.push(player.participant.identifier);
  })
  game.set("gameEndPlayerIds", ids)
  console.log("game ending with players: " + identifers)
});

Empirica.onNewPlayer(function ({player}) {
  player.set("activeMinutes", 0)  // accumulator for the time that we will pay the player
  player.set("dollarsOwed", 0)
  player.set("stopPaying", false);
});

Empirica.onPlayerConnected(function ({player}) {
  console.log("Player " + player.participant.identifier + " connected." )
  player.set("isPaidTime", true)
  //player.set("stopPaying", false);
});

Empirica.onPlayerDisconnected(function ({player}) {
  console.log("Player " + player.participant.identifier + " disconnected." )
  player.set("isPaidTime", false)
});

// in these callbacks the {isNew} attribute is called the first time this callback is called, I believe

Empirica.onChange("player", "isPaidTime", function ({isNew, player}) {  
  const date = new Date();
  const timeNow = date.getTime()
  if(player.get("stopPaying")) {
    player.set("paymentReady", true)
    return;
  }
  if (player.get("isPaidTime")) {  // the participant clocks in 
    player.set("startPaymentTimer", timeNow)
    player.set("paymentReady", false)
  } else {  // the participant clocks out
    const startedTime = player.get("startPaymentTimer")
    const minutesElapsed = (timeNow - startedTime)/1000/60; 
    const cumulativeTime = player.get("activeMinutes") + minutesElapsed;
    player.set("activeMinutes", cumulativeTime)
    const dollarsOwed = (cumulativeTime/60 * config.hourlyPay).toFixed(2);
    player.set("dollarsOwed",  dollarsOwed)
    if (dollarsOwed > config.highPayAlert){
      console.warn("High payment for " + player.participant.identifier + ": " + dollarsOwed)
    }
    console.log("set dollars owed");
    console.log("Owe " + player.participant.identifier + " $" + player.get("dollarsOwed") + " for " + player.get("activeMinutes") + " minutes")
    player.set("paymentReady", true)
  }
});

function pluckUniqueFactors(treatments, factor) {
  // gets all unique treatment values for a given factor
  const s = new Set();
  treatments.forEach((t) => s.add(t.treatment.factors[factor]))
  return Array.from(s)
}

Empirica.onNewBatch(async function ({ batch }) {
  const treatments = batch.get("config")["config"]["treatments"];

  pluckUniqueFactors(treatments, "topic").forEach( async (topicFile) => {
    const url = "https://raw.githubusercontent.com/Watts-Lab/deliberation-topics/main/topics/" + topicFile;
    let topic;
    try {
      const response = await axios.get(url);
      topic = response.data;
      console.log("Fetched topic from: " + url);
    } catch (error) {
      console.error("Unable to fetch topic from: " + url);
      console.error(error);
    }
    // check that it is formatted as we expect
    try {
        const question = topic.split("Prompt")[1].replace('"', "").split("Responses")[0].replace('"', "");
        const responses = topic.split("Responses")[1] //get everything after responses (the answers)
        const answers = responses.split("\n- ").filter((item) => item.length > 2)  // exclude empty rows
        assert(question.length > 30)
        assert(responses.length > 30)
        assert(answers.length > 1)
    } catch (error) {
        console.error("Topic failed to parse: ");
        console.error(topic)
    }

    let topics = batch.get("topics") || {};
    topics[topicFile] = topic;
    batch.set("topics", topics);
  });

  pluckUniqueFactors(treatments, "QCSurvey").forEach( async (surveyFile) => {
    const url = "https://raw.githubusercontent.com/Watts-Lab/surveys/main/src/surveys/" + surveyFile;
    let survey;

    try {
        const response = await axios.get(url);
        survey = response.data;
        console.log("Fetched survey from: " + url);
    } catch (error) {
        console.error("Unable to fetch survey from: " + url);
        console.error(error)
    }
    // check that it parses
    try {
        JSON.parse(JSON.stringify(survey))
    } catch (error) {
        console.error("Unable to parse survey:");
        console.error(survey)
    }

    let QCSurveys = batch.get("QCSurveys") || {};
    QCSurveys[surveyFile] = survey;
    batch.set("QCSurveys", QCSurveys);
  });

  pluckUniqueFactors(treatments, "TVSurvey").forEach( async (surveyFile) => {
    const url = "https://raw.githubusercontent.com/Watts-Lab/surveys/main/src/surveys/" + surveyFile;
    let survey;

    try {
        const response = await axios.get(url);
        survey = response.data;
        console.log("Fetched survey from: " + url);
    } catch (error) {
        console.error("Unable to fetch survey from: " + url);
        console.error(error)
    }
    // check that it parses
    try {
        JSON.parse(JSON.stringify(survey))
    } catch (error) {
        console.error("Unable to parse survey");
        console.error(survey)
    }

    let TVSurveys = batch.get("TVSurveys") || {};
    TVSurveys[surveyFile] = survey;
    batch.set("TVSurveys", TVSurveys);
  });

});

