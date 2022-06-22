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

  // const url = "https://raw.githubusercontent.com/Watts-Lab/deliberation-topics/7b9fa478b11c7e14b670beb710a2c4cd98b4be1c/topics/example.md";

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
        console.log("Less than 75 non whitespace characters");
        throw "Less than 75 non whitespace characters"
      }
      let topics = batch.get("topics")
      topics[url] = fetched
      batch.set("topics", topics);
    } catch(error) {
      console.log("Unable to fetch topic from url " + url);
    }
  });

});
