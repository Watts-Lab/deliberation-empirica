import { Callbacks } from "@empirica/admin";
import fetch from "node-fetch";


const Empirica = new Callbacks();
export default Empirica;

// matches url with https:// scheme, raw subdowmain, and blob/(combination of lower-case letters and numbers) in subdirectory 
const validLinkWithBlob = new RegExp('(https://raw.).*(blob/)(?=.*\d)(?=.*[a-z]).*(.md)');
// matches url with https:// scheme, raw subdowmain, and combination of lower-case letters and numbers in subdirectory without blob
const validLink = new RegExp('(https://raw.).*(/)(?=.*\d)(?=.*[a-z]).*(.md)');
// matches tinyurl 
const validTinyURL = new RegExp('(https://tinyurl.com/).*');

async function fetchHelp(url, round) {
  if (validTinyURL.test(url)) {
    const response = await fetch(url);
    round.set("topic", response.text());
    console.log(round.get("topic"));
  } else {
    console.log('error');
  }
}

Empirica.onGameStart(async function ({ game }) {
  console.log("game start");

  const round = game.addRound({
    name: "Discussion",
  });

  round.addStage({ name: "Discuss", duration: game.treatment.duration });

  const url = game.treatment.topic; 
  
  await fetchHelp(url, round);

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
