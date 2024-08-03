import React from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Timer } from "./components/Timer";

export function Profile() {
  const player = usePlayer();
  const title = player.get("title") || "Time Remaining:";
  return (
    <div
      data-test="profile"
      className="text-gray-500 bg-gray-100 rounded-b-md grid grid-cols-3 items-center shadow-sm h-full"
    >
      <div className="mx-2">{title}</div>
      <div className="flex flex-col items-center">
        <Timer />
      </div>
    </div>
  );
}
