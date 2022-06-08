import React from "react";
import { Profile } from "./Profile";
import { Stage } from "./Stage";
import { usePlayer } from "@empirica/player";

export function Game() {
  const player = usePlayer();

  return (
    <div className="h-full w-full flex flex-col">
      <Profile />
      <div className="h-full flex items-center justify-center">
        <Stage />
      </div>
    </div>
  );
}
