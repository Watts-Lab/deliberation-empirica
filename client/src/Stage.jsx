import { Loading, usePlayer, usePlayers, useRound, useStage } from "@empirica/player";
import React from "react";
import Discussion from "./pages/Discussion";
import Topic from "./components/Topic";


export function Stage() {
  const player = usePlayer();
  const players = usePlayers();
  const round = useRound();
  const stage = useStage();

  console.log(player.stage.get("name"));

  if (player.stage.get("submit")) {
    if (players.length === 1) {
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
        <Topic topic={round.get("topic")} />
      </div>
    ) 
  } else if (stage.get("name") === "Discuss") {
    return <Discussion round={round} player={player} />
  }
    
}
