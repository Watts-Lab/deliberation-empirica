import { useStage, usePlayer } from "@empirica/core/player/classic/react";
import React from "react";
import { Stage as ScoreStage } from "stagebook/components";
import { ScoreProviderAdapter } from "./components/ScoreProviderAdapter";
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
      <ScoreProviderAdapter>
        <ScoreStage
          stage={stageConfig}
          onSubmit={() => player.stage.set("submit", true)}
        />
      </ScoreProviderAdapter>
    </StageProgressLabelProvider>
  );
}
