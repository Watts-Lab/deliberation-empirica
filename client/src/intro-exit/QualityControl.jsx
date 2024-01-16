import { useGame, usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import { DiscussionQualityControl } from "@watts-lab/surveys";
import { H1 } from "../components/TextStyles";
import { ConfirmLeave } from "../components/ConfirmLeave";

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
      <H1>Sorry you did not get to play today.</H1>
    </div>
  );

  return (
    <div>
      <ConfirmLeave />
      {!game && renderSorry()}
      <DiscussionQualityControl
        onComplete={onComplete}
        storageName={`${player.id}_${gameID}_QCSurvey`}
      />
    </div>
  );
}
