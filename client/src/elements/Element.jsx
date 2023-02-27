/*
A base wrapper for all the elements

*/

import React from "react";
import {
  useStageTimer,
  usePlayer,
  useStage,
} from "@empirica/core/player/classic/react";
import { Prompt } from "./Prompt";
import { Separator } from "./Separator";
import { AudioElement } from "./AudioElement";
import { Survey } from "./Survey";
import { SubmitButton } from "./SubmitButton";
import { KitchenTimer } from "./KitchenTimer";
import { TrainingVideo } from "./TrainingVideo";

export function Element({ element, onSubmit }) {
  const stageTimer = useStageTimer();
  const player = usePlayer();
  const stage = useStage();

  switch (element.type) {
    case "audio":
      return <AudioElement file={element.file} />;

    case "prompt":
      return (
        <Prompt promptString={element.promptString} saveKey={element.name} />
      );

    case "separator":
      return <Separator style={element.style} />;

    case "submitButton":
      if (player.stage) return <SubmitButton onSubmit={onSubmit} />;
      return undefined;

    case "timer":
      if (stageTimer)
        return (
          <KitchenTimer
            startTime={element.startTime || element.displayTime || 0}
            endTime={
              element.endTime || element.hideTime || stage?.get("duration")
            }
            warnTimeRemaining={element.warnTimeRemaining}
          />
        );
      return undefined;

    case "survey":
      return <Survey surveyName={element.surveyName} onSubmit={onSubmit} />;

    case "video":
      return <TrainingVideo url={element.url} />;

    default:
      return undefined;
  }
}