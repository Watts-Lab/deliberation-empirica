import { Loading, usePlayer, usePlayers, useRound } from "@empirica/player";
import React from "react";
import { Discussion } from "./pages/Discussion";


export function Stage() {
  const player = usePlayer();
  const players = usePlayers();
  const round = useRound();

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
  
  return <Discussion/>

}
