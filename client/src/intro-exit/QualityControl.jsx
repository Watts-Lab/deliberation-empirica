import { useGame, usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import { DiscussionQualityControl } from "@watts-lab/surveys";

export function qualityControl({ next }) {
  const player = usePlayer();
  const game = useGame();
  const gameID = player.get("gameID") || "noGameId";

  useEffect(() => {
    // runs on first mount to stop the payment timer
    console.log("Exit: QC Exit");
    player.set("playerComplete", true);
  }, []);

  const onComplete = (record) => {
    player.set("QCSurvey", record);
    next();
  };

  return (
    <div>
      <div className="w-92 flex flex-col items-center">
        <h2 className="text-gray-700 font-medium">
          {game && "Thank you for participating!"}
          {!game && "Sorry you did not get to play today!"}
        </h2>
      </div>
      <DiscussionQualityControl
        onComplete={onComplete}
        storageName={`${player.id}_${gameID}_QCSurvey`}
      />
    </div>
  );
}
