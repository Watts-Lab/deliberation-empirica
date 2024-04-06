/*
A base wrapper for all the elements

*/

import React from "react";
import { useStageTimer, useStage } from "@empirica/core/player/classic/react";
import { Prompt } from "./Prompt";
import { Display } from "./Display";
import { Separator } from "./Separator";
import { AudioElement } from "./AudioElement";
import { Survey } from "./Survey";
import { SubmitButton } from "./SubmitButton";
import { KitchenTimer } from "./KitchenTimer";
import { TrainingVideo } from "./TrainingVideo";
import { Qualtrics } from "./Qualtrics";
import { SharedNotepad } from "../components/SharedNotepad";
import { TalkMeter } from "./TalkMeter";
import { Image } from "../components/Image";

export function Element({ element, onSubmit }) {
  const stageTimer = useStageTimer();
  const stage = useStage();

  switch (element.type) {
    case "audio":
      return <AudioElement file={element.file} />;

    case "display":
      return (
        <Display
          promptName={element.promptName}
          reference={element.reference}
          position={element.position}
        />
      );

    case "image":
      return <Image file={element.file} width={element.width} />;

    case "prompt":
      return (
        <Prompt
          file={element.file}
          name={element.name}
          shared={element.shared}
        />
      );

    case "qualtrics":
      console.log("qualtrics");
      return (
        <Qualtrics
          url={element.url}
          params={element.params}
          onSubmit={onSubmit}
        />
      );

    case "separator":
      return <Separator style={element.style} />;

    case "submitButton":
      return (
        <SubmitButton
          onSubmit={onSubmit}
          name={element.name}
          buttonText={element.buttonText}
        />
      );

    case "survey":
      return (
        <Survey
          surveyName={element.surveyName}
          name={element.name}
          onSubmit={onSubmit}
        />
      ); // TODO: pass in the element name so that results can be saved if the survey is completed multiple times

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

    case "talkMeter":
      return <TalkMeter />;

    case "sharedNotepad":
      return <SharedNotepad padName={element.name || stage.get("name")} />;

    default:
      console.log(`unknown element type ${element.type}`);
      return undefined;
  }
}
