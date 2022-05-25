import { Callbacks } from "@empirica/admin";
import fetch from "node-fetch";

const Empirica = new Callbacks();
export default Empirica;

// matches url with https:// scheme, raw subdowmain, and blob/(combination of lower-case letters and numbers) in subdirectory 
const validLinkWithBlob = new RegExp('(https://raw.).*(blob/)(?=.*\d)(?=.*[a-z]).*(.md)');
// matches url with https:// scheme, raw subdowmain, and combination of lower-case letters and numbers in subdirectory without blob
const validLink = new RegExp('(https://raw.).*(/)(?=.*\d)(?=.*[a-z]).*(.md)');

Empirica.onGameStart(function ({ game }) {
  console.log("game start");

  const round = game.addRound({
    name: "Discussion",
  });
  round.addStage({ name: "Discuss", duration: 2000 });

//   const url = "https://raw.githubusercontent.com/Watts-Lab/deliberation-topics/7b9fa478b11c7e14b670beb710a2c4cd98b4be1c/topics/example.md";

  const url = game.treatment.url; 
  
  if (validLink.test(url)) {
    fetch(url)
    .then((response) => {return response.text()})
    .then((Text) => {round.set("topic", Text), console.log(round.get("topic"))});
  } else {
    console.log('error');
  }

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
