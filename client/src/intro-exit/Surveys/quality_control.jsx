import { useGame, usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import { DiscussionQualityControl } from "@watts-lab/surveys"

export function qualityControl({ next }) {
  const player = usePlayer();
  const game = useGame();

  useEffect(() => {
    // runs on first mount to stop the payment timer
    console.log("Exit: QC Exit");
    player.set("playerComplete", true);
  }, []);

  const displayPayment = player.get("dollarsOwed") || "calculating...";

  const onComplete = (record) => {
    player.set("QCSurvey", record);
    next();
  }

  return (
    <div>
      <div className="w-92 flex flex-col items-center">
        <h2 className="text-gray-700 font-medium">
          {game && "Thank you for participating!"}
          {!game && "Sorry you did not get to play today!"}
        </h2>
        <p className="mt-2 text-gray-400 text-justify">
          You will be paid $
          <strong data-test="dollarsOwed">{displayPayment}</strong>
          {" for your time today."}
        </p>
      </div>
      <DiscussionQualityControl onComplete={onComplete} />
    </div>
  );
}
