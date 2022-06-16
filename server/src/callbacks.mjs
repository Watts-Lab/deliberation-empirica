// Callbacks are here:
// https://github.com/empiricaly/empirica/blob/main/lib/@empirica/admin/src/callbacks.ts

import { Callbacks } from "@empirica/admin";
import axios from "axios";

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

async function fetchTopic(url, round, timeout=30) {
  const response = await axios.get(url);
  round.set("topic", response.data);
}

//Empirica.onNewBatch()


Empirica.onGameStart(async function ({ game }) {
  console.log("game start");
  
  const round = game.addRound({
    name: "Discussion",
  });

  round.addStage({ name: "Discuss", duration: game.treatment.duration });

  // const url = "https://raw.githubusercontent.com/Watts-Lab/deliberation-topics/7b9fa478b11c7e14b670beb710a2c4cd98b4be1c/topics/example.md";

  // Todo: move these to onBatchCreate callback (or onBatchStart?)
  const url = validateURL(game.treatment.topic); 
  
  await fetchTopic(url, round);
  // console.log("Topic:"+round.get("topic"));

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
  
});

Empirica.onNewPlayer(function ({player}) {
  console.log("Player with id " + player.id + " has joined the game.");
});
