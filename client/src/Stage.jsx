import { useStage } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import {
  ElementConditionalRender,
  DevConditionalRender,
  SubmissionConditionalRender,
  ColumnLayout,
} from "./components/Layouts";
import { Discussion } from "./elements/Discussion";
import { TrainingVideo } from "./elements/TrainingVideo";
import { AudioElement } from "./elements/AudioElement";
import { Prompt } from "./elements/Prompt";
import { StageSubmit } from "./elements/StageSubmit";
import { KitchenTimer } from "./elements/KitchenTimer";
import { Separator } from "./elements/Separator";

export function Stage() {
  const stage = useStage();
  const chatType = stage.get("chatType") || "none";
  const elements = stage.get("elements") || [];
  const stageIndex = stage.get("index");
  const stageName = stage.get("name");

  useEffect(() => {
    console.log(`Stage ${stageIndex}: ${stageName}`);
  }, []);

  const renderElement = (element, index) => {
    const { type, displayTime, hideTime, showToPositions, hideFromPositions } =
      element;

    return (
      <ElementConditionalRender
        displayTime={displayTime}
        hideTime={hideTime}
        showToPositions={showToPositions}
        hideFromPositions={hideFromPositions}
        key={`element_${index}`}
      >
        {type === "prompt" && (
          <Prompt promptString={element.promptString} saveKey={element.name} />
        )}
        {type === "video" && <TrainingVideo url={element.url} />}
        {type === "separator" && <Separator style={element.style} />}
        {type === "audio" && <AudioElement file={element.file} />}
        {type === "timer" && (
          <KitchenTimer
            startTime={element.startTime || displayTime || 0}
            endTime={element.endTime || hideTime || stage.get("duration")}
            warnTimeRemaining={element.warnTimeRemaining}
          />
        )}
        {type === "submitButton" && <StageSubmit />}
      </ElementConditionalRender>
    );
  };

  return (
    <SubmissionConditionalRender>
      <ColumnLayout
        left={
          chatType === "video" && (
            <DevConditionalRender>
              <Discussion />
            </DevConditionalRender>
          )
        }
        right={elements.map(renderElement)}
      />
    </SubmissionConditionalRender>
  );
}
