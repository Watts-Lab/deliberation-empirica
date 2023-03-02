/*
A base wrapper for all the elements

*/

import React, { useEffect, useState } from "react";
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
  // const player = usePlayer();
  const stage = useStage();
  console.log(`element`, element)

  switch (element.type) {
    case "audio":
      return <AudioElement file={element.file} />;

    case "prompt":
      return <Prompt file={element.file} saveKey={element.name} />;

    case "separator":
      return <Separator style={element.style} />;

    case "submitButton":
      return <SubmitButton onSubmit={onSubmit} />;

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

    case "qualtrics": 
      console.log(`qualtrics url ${element.url}`)
      return undefined;

    default:
      return undefined;
  }
}
