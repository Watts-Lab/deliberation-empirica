// Callbacks are here:
// https://github.com/empiricaly/empirica/blob/main/lib/@empirica/admin/src/callbacks.ts

import { Callbacks } from "@empirica/admin";
import axios from "axios";
import { marked } from 'marked';

const Empirica = new Callbacks();
export default Empirica;

function validateURL(url){
  // matches url with https:// scheme, raw subdowmain, and blob/(combination of lower-case letters and numbers) in subdirectory 
  const validLinkWithBlob = new RegExp('(https://raw.).*(blob/)(?=.*\d)(?=.*[a-z]).*(.md)');
  // matches url with https:// scheme, raw subdowmain, and combination of lower-case letters and numbers in subdirectory without blob
  const validLink = new RegExp('(https://raw.).*(/)(?=.*\d)(?=.*[a-z]).*(.md)');
  // matches tinyurl 
  const validTinyURL = new RegExp('(https://tinyurl.com/).*');

  if(validLinkWithBlob.test(url) || validLink.test(url) || validTinyURL.test(url)){
    return url;
  } else {
    console.log('Improperly formatted URL');
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

Empirica.onGameEnd(function ({ game }) {
  const date = new Date(); 
  const timeAtEnd = date.getTime(); 
  game.players.forEach((player, i) => {
    player.set("timeAtGameEnd", timeAtEnd);
    console.log("Player with id " + player.id + " has finished the game at " + player.get("timeAtGameEnd") + ".");
  })
});

Empirica.onNewPlayer(function ({player}) {
  const date = new Date(); 
  const timeAtStart = date.getTime(); 
  player.set("timeAtStart", timeAtStart);
  console.log("Player with id " + player.id + " has joined the game at " + player.get("timeAtStart") + ".");
});

Empirica.onChange("player", "exitStepDone", function ({ isNew, player }) {
  const date = new Date(); 
  const timeAtEnd = date.getTime(); 
  player.set("timeAtEnd", timeAtEnd);
  console.log("Player with id " + player.id + " has finished exit steps at " + player.get("timeAtEnd") + ".");
  // normal game --> reaches @ end / finished screen 
  // game stopped when player is in game --> reaches finished screen 
  // game stopped during intro steps --> doesn't get time end / stuck on game loading page
  // player 2 joins game before player 1 (i.e. no space for player 1) --> callback does not fire
});

Empirica.onChange("player", "sorrySet", function ({ isNew, player }) {
  const date = new Date(); 
  const timeAtEnd = date.getTime(); 
  player.set("timeAtEnd", timeAtEnd);
  console.log("Player with id " + player.id + " has finished sorry steps at " + player.get("timeAtEnd") + ".");
  // normal game --> reaches @ end / finished screen 
  // game stopped when player is in game --> reaches finished screen 
  // game stopped during intro steps --> doesn't get time end / stuck on game loading page
  // player 2 joins game before player 1 (i.e. no space for player 1) --> callback does not fire
});


Empirica.onNewBatch(async function ({ batch }) {
  const topicURLs = new Set();
  const treatments = batch.get("config")["config"]["treatments"];
  treatments.forEach((t) => {
    const url = validateURL(t.treatment.factors.topic);
    topicURLs.add(url);
  });
  batch.set("topics", {});
  topicURLs.forEach(async (url) => {
    try {
      console.log("fetching");
      const fetched = await (await axios.get(url)).data;
      try {
        marked.parse(fetched);
      } catch (error) {
        console.log("Unable to parse markdown");
      }
      if ((fetched.match(new RegExp("\\S", "g")) || []).length < 75) {
        console.warn("Detected under 75 characters in the topic markdown - please check that your file was loaded properly")
        console.log("Fetched topic: " + fetched);
      }
      let topics = batch.get("topics")
      topics[url] = fetched
      batch.set("topics", topics);
    } catch(error) {
      console.log("Unable to fetch topic from url " + url);
    }
  });

});
