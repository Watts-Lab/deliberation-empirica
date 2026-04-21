import { useStage, usePlayer } from "@empirica/core/player/classic/react";
import React from "react";
import { Stage as StagebookStage } from "stagebook/components";
import { StagebookProviderAdapter } from "./components/StagebookProviderAdapter";
import { StageProgressLabelProvider } from "./components/progressLabel";

export function Stage() {
  const stage = useStage();
  const player = usePlayer();

  const stageConfig = {
    name: stage?.get("name"),
    duration: stage?.get("duration"),
    elements: stage?.get("elements") || [],
    discussion: stage?.get("discussion"),
  };

  return (
    <StageProgressLabelProvider>
      <StagebookProviderAdapter>
        <StagebookStage
          stage={stageConfig}
          onSubmit={() => player.stage.set("submit", true)}
        />
      </StagebookProviderAdapter>
    </StageProgressLabelProvider>
  );
}
