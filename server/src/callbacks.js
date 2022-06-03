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
    fetch(url)
    .then((response) => {return response.text()})
    .then((Text) => {round.set("topic", Text)});
  } else {
    console.log('error');
  }
}

Empirica.onGameStart(function ({ game }) {
  console.log("game start");

  const d = new Date();
  let time = d.getTime(); 

  game.players.forEach((player, i) => {
    player.set("startTime", time);
    console.log(player.get("startTime"));
  });

  const round = game.addRound({
    name: "Discussion",
  });

  round.addStage({ name: "Discuss", duration: game.treatment.duration });

  // const url = "https://raw.githubusercontent.com/Watts-Lab/deliberation-topics/7b9fa478b11c7e14b670beb710a2c4cd98b4be1c/topics/example.md";

  const url = game.treatment.topic; 
  
  fetchHelp(url, round);

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

  const d = new Date();
  let time = d.getTime(); 

  game.players.forEach((player, i) => {
    player.set("endTime", time);
    console.log(player.get("endTime"));
  });
});
