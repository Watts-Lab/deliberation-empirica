import { Callbacks } from "@empirica/admin";
import axios from "axios";

const Empirica = new Callbacks();
export default Empirica;
let topic = "";

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

async function fetchTopic(url, timeout=30) {
  topic = await axios.get(url);
  console.log("topic is " + topic);

}


Empirica.onGameStart(function ({ game }) {
  console.log("game start");

  const round = game.addRound({
    name: "Discussion",
  });

  round.addStage({ name: "Discuss", duration: game.treatment.duration });
  round.set("topic", topic);

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
  console.log("game end");
});

Empirica.onNewBatch(async function ({ batch }) {
  // Todo: move these to onBatchCreate callback (or onBatchStart?)
  const conf = batch.get("config");
  const url = validateURL(conf["config"]["treatments"][0].treatment.factors.topic);
  try {
    // console.log("fetching topic");
    // const fetched = await axios.get(url);
    // console.log("topic should be " + fetched);
    await fetchTopic(url);
    //topic = fetched;
    //console.log("topic fetched");
  } catch(error) {
    console.log("Unable to fetch topic");
  }
});