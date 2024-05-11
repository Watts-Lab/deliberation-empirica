// This is a wrapper for all intro steps, that just
// checks that all the hooks are ready before rendering the step.

import React from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";
import { ConfirmLeave } from "../components/ConfirmLeave";

export function Intro({ Step, next }) {
  const player = usePlayer();

  if (!player) {
    return <Loading />;
  }

  return (
    <>
      <ConfirmLeave />
      <Step next={next} />
    </>
  );
}
