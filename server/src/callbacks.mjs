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
  console.log("game end");
});



Empirica.onNewBatch(async function ({ batch }) {
  batch.set("topics", {});
  const topicURLs = new Set();
  const treatments = batch.get("config")["config"]["treatments"];
  treatments.forEach((t) => {
    const url = validateURL(t.treatment.factors.topic);
    topicURLs.add(url);
  })
  topicURLs.forEach(async (url) => {
    try {
      const fetched = await (await axios.get(url)).data;
      let topics = batch.get("topics")
      topics[url] = fetched
      batch.set("topics", topics);
      console.log("try " + JSON.stringify(batch.get("topics")));
    } catch(error) {
      console.log("unable to fetch topics");
      console.log(batch.get("topics"));
    }
  });

});