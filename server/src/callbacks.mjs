// Callbacks are here:
// https://github.com/empiricaly/empirica/blob/main/lib/@empirica/admin/src/callbacks.ts

import { Callbacks } from "@empirica/admin";
import axios from "axios";
import { marked } from "marked";

const config = {
  hourlyPay: 15,  // how much do we pay participants by the hour
  highPayAlert: 10  // at what cumulative payment should we raise a warning
}

const Empirica = new Callbacks();
export default Empirica;

function validateURL(url) {
  // matches url with https:// scheme, raw subdowmain, and blob/(combination of lower-case letters and numbers) in subdirectory
  const validLinkWithBlob = new RegExp(
    "(https://raw.).*(blob/)(?=.*d)(?=.*[a-z]).*(.md)"
  );
  // matches url with https:// scheme, raw subdowmain, and combination of lower-case letters and numbers in subdirectory without blob
  const validLink = new RegExp("(https://raw.).*(/)(?=.*d)(?=.*[a-z]).*(.md)");
  // matches tinyurl
  const validTinyURL = new RegExp("(https://tinyurl.com/).*");

  if (
    validLinkWithBlob.test(url) ||
    validLink.test(url) ||
    validTinyURL.test(url)
  ) {
    return url;
  } else {
    console.log("Improperly formatted URL");
  }
}


Empirica.onGameStart(function ({ game }) {
  console.log("game start");

  const round = game.addRound({
    name: "Discussion",
  });

  round.addStage({ name: "Discuss", duration: game.treatment.duration });
  const url = game.treatment.topic;
  round.set("topic", game.batch.get("topics")[url]);

  console.log("game start done");
});

Empirica.onRoundStart(function ({ round }) {
  console.log("round start");
});

Empirica.onStageStart(function ({ stage }) {
  console.log("stage start");
});

Empirica.onStageEnd(function ({ stage }) {
  console.log("stage end");
});

Empirica.onRoundEnd(function ({ round }) {});

Empirica.onGameEnd(function ({ game }) {});

Empirica.onNewPlayer(function ({player}) {
  player.set("activeMinutes", 0)  // accumulator for the time that we will pay the player
  player.set("dollarsOwed", 0)
});

Empirica.onPlayerConnected(function ({player}) {
  console.log("Player " + player.participant.identifier + " connected." )
  player.set("isPaidTime", true)
});

Empirica.onPlayerDisconnected(function ({player}) {
  console.log("Player " + player.participant.identifier + " disconnected." )
  player.set("isPaidTime", false)
});

// in these callbacks the {isNew} attribute is called the first time this callback is called, I believe

Empirica.onChange("player", "isPaidTime", function ({isNew, player}) {
  // Todo: this is brittle if the callback fails. 
  // If we get two "clock in" actions in a row, it takes the last one, but
  // won't have calculated the cumulative time properly
  // also, if we have two "clock out" actions in a row 
  // (as could happen if called from the client side)
  // then the time will accumulate from the started time each time it's called
  const date = new Date();
  const timeNow = date.getTime()
  if (player.get("isPaidTime")) {  // the participant clocks in 
    player.set("startPaymentTimer", timeNow)
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
    console.log("Owe " + player.participant.identifier + " $" + player.get("dollarsOwed") + " for " + player.get("activeMinutes") + " minutes")
  }
});

// Empirica.onChange("player", "exitStepDone", function ({ isNew, player }) {
//   const date = new Date(); 
//   const timeAtExitStepDone = date.getTime(); 
//   player.set("timeAtExitStepDone", timeAtExitStepDone);
//   console.log("Player with id " + player.id + " has finished exit steps at " + player.get("timeAtExitStepDone") + ".");
//   // normal game --> reaches @ end / finished screen 
//   // game stopped when player is in game --> reaches finished screen 
//   // game stopped during intro steps --> doesn't get time end / stuck on game loading page
//   // player 2 joins game before player 1 (i.e. no space for player 1) --> callback does not fire
// });

// Empirica.onChange("player", "sorrySet", function ({ isNew, player }) {
//   const date = new Date(); 
//   const timeAtEnd = date.getTime(); 
//   player.set("timeAtEnd", timeAtEnd);
//   console.log("Player with id " + player.id + " has finished sorry steps at " + player.get("timeAtEnd") + ".");
//   // normal game --> reaches @ end / finished screen 
//   // game stopped when player is in game --> reaches finished screen 
//   // game stopped during intro steps --> doesn't get time end / stuck on game loading page
//   // player 2 joins game before player 1 (i.e. no space for player 1) --> callback does not fire
// });


Empirica.onNewBatch(async function ({ batch }) {
  const topicURLs = new Set();
  const discussionSurveyURLs = new Set();
  const QCSurveyURLs = new Set();
  const TVSurveyURLs = new Set();

  // not sure how to implement this piece for surveys
  const treatments = batch.get("config")["config"]["treatments"];

  treatments.forEach((t) => {
    const url = validateURL(t.treatment.factors.discussionSurvey);
    discussionSurveyURLs.add(url);
  });
  treatments.forEach((t) => {
    const url = validateURL(t.treatment.factors.topic);
    topicURLs.add(url);
  });
  treatments.forEach((t) => {
    const url = validateURL(t.treatment.factors.QCSurvey);
    QCSurveyURLs.add(url);
  });
  treatments.forEach((t) => {
    const url = validateURL(t.treatment.factors.TVSurvey);
    TVSurveyURLs.add(url);
  });

  batch.set("topics", {});
  batch.set("discussionSurveys", {});
  batch.set("QCSurveys", {});
  batch.set("TVSurveys", {});

  topicURLs.forEach(async (url) => {
    try {
      console.log("fetching topic from url " + url);
      const fetched = await (await axios.get(url)).data;
      try {
        marked.parse(fetched);
      } catch (error) {
        console.log("Unable to parse markdown");
      }
      if ((fetched.match(new RegExp("\\S", "g")) || []).length < 75) {
        console.warn(
          "Detected under 75 characters in the topic markdown - please check that your file was loaded properly"
        );
        console.log("Fetched topic: " + fetched);
      }
      let topics = batch.get("topics");
      topics[url] = fetched;
      batch.set("topics", topics);
    } catch (error) {
      console.log("Unable to fetch topic from url " + url);
    }
  });

  discussionSurveyURLs.forEach(async (url) => {
    try {
      console.log("fetching discussion survey from url " + url);
      const fetched = await (await axios.get(url)).data;
      try {
        JSON.parse(JSON.stringify(fetched))
      } catch (error) {
        console.log(error)
        console.log("Unable to parse discussion survey from url " + url);
      }
      let discussionSurveys = batch.get("discussionSurveys");
      discussionSurveys[url] = fetched;
      batch.set("discussionSurveys", discussionSurveys);
    } catch (error) {
      console.log("Unable to fetch discussion survey from url " + url);
    }
  });

  QCSurveyURLs.forEach(async (url) => {
    try {
      console.log("fetching quality control survey from url " + url);
      const fetched = await (await axios.get(url)).data;
      try {
        JSON.parse(JSON.stringify(fetched))
      } catch (error) {
        console.log(error)
        console.log("Unable to parse quality control survey");
      }
      let QCSurveys = batch.get("QCSurveys");
      QCSurveys[url] = fetched;
      batch.set("QCSurveys", QCSurveys);
    } catch (error) {
      console.log("Unable to fetch quality control survey from url " + url);
    }
  });

  TVSurveyURLs.forEach(async (url) => {
    try {
      console.log("fetching team viability survey from url " + url);
      const fetched = await (await axios.get(url)).data;
      try {
        JSON.parse(JSON.stringify(fetched))
      } catch (error) {
        console.log(error)
        console.log("Unable to parse team viability survey");
      }
      let TVSurveys = batch.get("TVSurveys");
      TVSurveys[url] = fetched;
      batch.set("TVSurveys", TVSurveys);
    } catch (error) {
      console.log("Unable to fetch team viability survey from url " + url);
    }
  });
});
