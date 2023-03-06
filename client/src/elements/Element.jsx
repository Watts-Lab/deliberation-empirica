/*
A base wrapper for all the elements

*/

import React from "react";
import { useStageTimer, useStage } from "@empirica/core/player/classic/react";
import { Prompt } from "./Prompt";
import { Separator } from "./Separator";
import { AudioElement } from "./AudioElement";
import { Survey } from "./Survey";
import { SubmitButton } from "./SubmitButton";
import { KitchenTimer } from "./KitchenTimer";
import { TrainingVideo } from "./TrainingVideo";
import { Qualtrics } from "./Qualtrics";

export function Element({ element, onSubmit }) {
  const stageTimer = useStageTimer();
  const stage = useStage();

  switch (element.type) {
    case "audio":
      return <AudioElement file={element.file} />;

    case "prompt":
      return <Prompt file={element.file} saveKey={element.name} />;

    case "qualtrics":
      return <Qualtrics url={element.url} onSubmit={onSubmit} />;

    case "separator":
      return <Separator style={element.style} />;

    case "submitButton":
      return <SubmitButton onSubmit={onSubmit} />;

    case "survey":
      return <Survey surveyName={element.surveyName} onSubmit={onSubmit} />;

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

    case "video":
      return <TrainingVideo url={element.url} />;

    default:
      return undefined;
  }
}
