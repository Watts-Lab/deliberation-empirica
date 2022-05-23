import { Callbacks } from "@empirica/admin";

const Empirica = new Callbacks();
export default Empirica;

const validLink = new RegExp('(https://raw.).*(blob/)(?=.*\d)(?=.*[a-z]).*(.md)')

Empirica.onGameStart(function ({ game }) {
  console.log("game start");

  fetch('https://raw.githubusercontent.com/Watts-Lab/deliberation-topics/7b9fa478b11c7e14b670beb710a2c4cd98b4be1c/topics/example.md') 
    .then(response => response.text())
    .then(text => 
      round.set("topic", text)
    );

  // if (validLink.test(game.treatment.url)) {
  //   fetch(game.treatment.url) 
  //     .then(response => response.text())
  //     .then(text => 
  //       round.set("topic", text)
  //       );
  // } else {
  //   console.log('error');
  // }

  const round = game.addRound({
    name: "Discussion",
  });
  round.addStage({ name: "Discuss", duration: 20 });

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
