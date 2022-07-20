import { Loading, usePlayer, usePlayers, useRound, useStage } from "@empirica/player";
import React from "react";
import Discussion from "./pages/Discussion";
import Icebreaker from "./pages/Icebreaker";
import TopicSurvey from "./pages/TopicSurvey";


export function Stage() {
  const player = usePlayer();
  const players = usePlayers();
  const round = useRound();
  const stage = useStage();

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
  } else if (stage.get("name") === "Icebreaker") {
    return <Icebreaker />
  } else if (stage.get("name") === "Discuss") {
    return <Discussion />
  }
    
}
