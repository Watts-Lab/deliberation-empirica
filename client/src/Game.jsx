import React from "react";
import {
  useGame,
  useStage,
  usePlayer,
  useRound,
} from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";
import { Profile } from "./Profile";
import { Stage } from "./Stage";
import { Lobby } from "./intro-exit/Lobby";

export function Game() {
  const game = useGame();
  const stage = useStage();
  const player = usePlayer();
  const round = useRound();

  // if the player is not ready, we show a loading screen
  if (!player) return <Loading />;

  // game gets rendered after the player completes the intro steps, even if they haven't been
  // assigned to a game. In that case, we show the lobby.
  if (!player.get("assigned")) return <Lobby />;

  // with the unmanagedGame flag set on EmpiricaContext, we need
  // to manually check that the game and stage are ready before rendering
  if (!game || !stage || !round) return <Loading />;

  return (
    <>
      <Profile />
      <Stage />
    </>
  );
}
