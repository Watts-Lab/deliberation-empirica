import { Callbacks } from "@empirica/admin";

const Empirica = new Callbacks();
export default Empirica;

Empirica.onGameStart(function ({ game }) {
  console.log("game start");

  const round = game.addRound({
    name: "Discussion",
  });

  round.addStage({ name: "Discuss", duration: game.treatment.duration});

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
