import React, { useEffect } from "react";
import { useGame, usePlayer } from "@empirica/core/player/classic/react";
import { Profile } from "./Profile";
import { Stage } from "./Stage";

export function Game() {
  const game = useGame();
  const player = usePlayer();
  useEffect(() => {
    console.log(`Render Game`);
    if (!player.get("playerGameID")) {
      // save to player object to simplify data extraction
      player.set("treatment", game.get("treatment"));
      player.set("playerGameID", game.id);
      // todo: copy the batch config to the player object
    }
  }, []);
  return (
    <div>
      <Profile />
      <Stage />
    </div>
  );
}
