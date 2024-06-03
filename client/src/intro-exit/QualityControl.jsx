import { useGame, usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import { DiscussionQualityControl } from "@watts-lab/surveys";

export function QualityControl({ next }) {
  const player = usePlayer();
  const game = useGame();
  const gameID = player.get("gameID") || "noGameId";

  useEffect(() => {
    console.log("Exit: QC Exit");
  }, []);

  const onComplete = (record) => {
    player.set("QCSurvey", record);
    player.set("playerComplete", true);
    next();
  };

  const renderSorry = () => (
    <div className="ml-25 w-xl">
      <h1>Sorry you did not get to play today.</h1>
    </div>
  );

  return (
    <div>
      {!game && renderSorry()}
      <DiscussionQualityControl
        onComplete={onComplete}
        storageName={`${player.id}_${gameID}_QCSurvey`}
      />
    </div>
  );
}
