import React from "react";
import {
  useGame,
  useStage,
  usePlayer,
  useRound,
  useStageTimer,
} from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";
import { Profile } from "./Profile";
import { Stage } from "./Stage";
import { Lobby } from "./intro-exit/Lobby";
import { ConfirmLeave } from "./components/ConfirmLeave";

export function Game() {
  const game = useGame();
  const stage = useStage();
  const player = usePlayer();
  const round = useRound();
  const timer = useStageTimer();

  // if the player is not ready, we show a loading screen
  if (!player) return <Loading />;

  // game gets rendered after the player completes the intro steps, even if they haven't been
  // assigned to a game. In that case, we show the lobby.
  if (!player.get("assigned")) return <Lobby />;

  // with the unmanagedGame flag set on EmpiricaContext, we need
  // to manually check that the game and stage are ready before rendering
  if (!game || !stage || !round || !useStageTimer) return <Loading />;

  return (
    <>
      <ConfirmLeave />
      <div className="absolute top-0 left-0 right-0 h-12">
        <Profile />
      </div>
      <div className="absolute top-12 left-0 right-0 bottom-0 m-2">
        <Stage />
      </div>
    </>
  );
}
