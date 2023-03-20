import { useGame, usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import { DiscussionQualityControl } from "@watts-lab/surveys";
import { H1, H2, P } from "../components/TextStyles";

export function qualityControl({ next }) {
  const player = usePlayer();
  const game = useGame();
  const gameID = player.get("gameID") || "noGameId";

  useEffect(() => {
    // runs on first mount to stop the payment timer
    console.log("Exit: QC Exit");
  }, []);

  const onComplete = (record) => {
    player.set("QCSurvey", record);
    player.set("playerComplete", true);
    next();
  };

  return (
    <div>
      <div className="ml-25 w-xl">
        <H1>
          {game && "Thank you for participating."}
          {!game && "Sorry you did not get to play today."}
        </H1>
      </div>
      <DiscussionQualityControl
        onComplete={onComplete}
        storageName={`${player.id}_${gameID}_QCSurvey`}
      />
    </div>
  );
}
