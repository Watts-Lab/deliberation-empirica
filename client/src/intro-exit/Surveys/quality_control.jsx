import { useGame, usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import { SurveyWrapper } from "../../components/SurveyWrapper";

export function qualityControl({ next }) {
  const player = usePlayer();
  const game = useGame();

  useEffect(() => {
    // runs on first mount
    console.log("Exit: QC Exit");
    player.set("playerComplete", true);
  }, []);

  const displayPayment = player.get("dollarsOwed") || "calculating...";


  // TODO: if a player reaches this screen without having been able to 
  // participate in a game, they should see a sorry message
  return (
    <div>
      <div className="w-92 flex flex-col items-center">
        <h2 className="text-gray-700 font-medium">
          Thank you for participating!
        </h2>
        <p className="mt-2 text-gray-400 text-justify">
          You will be paid $
          <strong data-test="dollarsOwed">{displayPayment}</strong>
          {" for your time today."}
        </p>
      </div>
      <SurveyWrapper surveyJson={game.get("QCSurvey")} next={next} />
    </div>
  );
}
