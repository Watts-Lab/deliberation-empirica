import { Loading, usePlayer, usePlayers, useRound, useStage } from "@empirica/player";
import React from "react";
import Discussion from "./pages/Discussion";
import Familiarize from "./pages/Familiarize";
import TopicSurvey from "./pages/TopicSurvey";


export function Stage() {
  const player = usePlayer();
  const players = usePlayers();
  const round = useRound();
  const stage = useStage();

  console.log(player.stage.get("name"));

  if (player.stage.get("submit")) {
    if (players.length === 1) {
      console.log("Loading...");
      return <Loading />;
    }

    return (
      <div className="text-center text-gray-400 pointer-events-none">
        Please wait for other player(s).
      </div>
    );
  }
  
  if (stage.get("name") === "Topic Survey") {
    return (
      <div className="flex flex-col items-center">
        <TopicSurvey />
      </div>
    ) 
  } else if (stage.get("name") === "Familiarize") {
    return <Familiarize />
  } else if (stage.get("name") === "Discuss") {
    return <Discussion />
  }
    
}
