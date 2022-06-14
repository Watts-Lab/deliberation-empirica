import { usePlayer, useRound, useStage } from "@empirica/player";
import React from "react";
import { Avatar } from "./components/Avatar";
import { Timer } from "./components/Timer";

export function Profile() {
  const player = usePlayer();
  const round = useRound();
  const stage = useStage();

  const score = player.get("score") || 0;

  return (
    <div data-test="profile" className="min-w-lg md:min-w-2xl m-x-auto px-3 py-2 text-gray-500 bg-gray-100 rounded-b-md grid grid-cols-3 items-center shadow-sm">

      Time Remaining
      <Timer />
    
      <div className="flex space-x-3 items-center justify-end">
        <h3 className="text-gray-500 bg-gray-100">
          Nickname: {player.get("name")}
        </h3>
        <div className="h-11 w-11">
          <Avatar player={player} />
        </div>
      </div>
    </div>
  );
}
