import { useGame, usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import { DiscussionQualityControl } from "@watts-lab/surveys";
import { H1 } from "../components/TextStyles";

export function qualityControl({ next }) {
  const player = usePlayer();
  const game = useGame();
  const gameID = player.get("gameID") || "noGameId";

  const beforeUnloadHandler = (event) => {
    event.preventDefault();
    event.returnValue = true;
  };

  useEffect(() => {
    console.log("Exit: QC Exit");
    // register a beforeunload handler to warn players who are trying to leave the page
    window.addEventListener("beforeunload", beforeUnloadHandler);
    return () => {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
    };
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
      {!game && renderSorry()}
      <DiscussionQualityControl
        onComplete={onComplete}
        storageName={`${player.id}_${gameID}_QCSurvey`}
      />
    </div>
  );
}
