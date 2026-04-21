/*
Takes the role of "stage" in intro and exit steps, as a place where elements are combined
into a page, and submit responses are defined.
*/
import React from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Stage as StagebookStage } from "stagebook/components";
import { StagebookProviderAdapter } from "../components/StagebookProviderAdapter";
import {
  IntroExitProgressLabelProvider,
  useGetElapsedTime,
} from "../components/progressLabel";

function GenericIntroExitStepInner({ name, elements, next }) {
  const player = usePlayer();
  const getElapsedTime = useGetElapsedTime();

  const stageConfig = {
    name,
    elements: elements || [],
  };

  const onSubmit = () => {
    const elapsed = getElapsedTime();
    player.set(`duration_${name}`, { time: elapsed });
    next();
  };

  return (
    <div
      className="absolute top-12 bottom-0 left-0 right-0"
      data-testid="genericIntroExit"
    >
      <StagebookProviderAdapter>
        <StagebookStage stage={stageConfig} onSubmit={onSubmit} />
      </StagebookProviderAdapter>
    </div>
  );
}

export function GenericIntroExitStep({ name, elements, index, next, phase }) {
  return (
    <IntroExitProgressLabelProvider phase={phase} index={index} name={name}>
      <GenericIntroExitStepInner name={name} elements={elements} next={next} />
    </IntroExitProgressLabelProvider>
  );
}
