// This is a wrapper of each exit step that just checks that
// all the hooks are ready before rendering the step.

import React from "react";
import {
  usePlayer,
  usePlayers,
  useGame,
} from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";
import { ConfirmLeave } from "../components/ConfirmLeave";

export function Exit({ Step, next }) {
  const player = usePlayer();
  const players = usePlayers();
  const game = useGame();

  if (!player || !players || !game) {
    return <Loading />;
  }

  return (
    <>
      <ConfirmLeave />
      <Step next={next} />
    </>
  );
}
