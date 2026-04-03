// This is a wrapper for all intro steps, that just
// checks that all the hooks are ready before rendering the step.

import React from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
// eslint-disable-next-line import/no-extraneous-dependencies
import { Loading } from "@deliberation-lab/score/components";
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
