import React from "react";
import { useGame, useStage } from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";
import { Profile } from "./Profile";
import { Stage } from "./Stage";

export function Game() {
  const game = useGame();
  const stage = useStage();

  // with the unmanagedGame flag set on EmpiricaContext, we need
  // to manually check that the game and stage are ready before rendering
  if (!game || !stage) return <Loading />;

  return (
    <div>
      <Profile />
      <Stage />
    </div>
  );
}
