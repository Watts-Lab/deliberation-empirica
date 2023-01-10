import { useStage } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import {
  TimedConditionalRender,
  DevConditionalRender,
  SubmissionConditionalRender,
  ColumnLayout,
} from "./components/Layouts";
import { Discussion } from "./elements/Discussion";
import { TrainingVideo } from "./elements/TrainingVideo";
import { AudioElement } from "./elements/AudioElement";
import { Prompt } from "./elements/Prompt";
import { StageSubmit } from "./elements/StageSubmit";

export function Stage() {
  const stage = useStage();
  const chatType = stage.get("chat") || "none";
  const elements = stage.get("elements") || [];
  const stageIndex = stage.get("index");
  const stageName = stage.get("name");

  useEffect(() => {
    console.log(`Stage ${stageIndex}: ${stageName}`);
  }, []);

  const renderElement = (element, index) => {
    const {
      type,
      name: elementName,
      displayTime,
      hideTime,
      url,
      file,
      promptString,
    } = element;
    return (
      <TimedConditionalRender
        displayTime={displayTime}
        hideTime={hideTime}
        key={`element_${index}`}
      >
        {type === "prompt" && (
          <Prompt
            promptString={promptString}
            saveKey={`prompt_stage${stageIndex}_${elementName}`}
          />
        )}
        {type === "video" && <TrainingVideo url={url} />}
        {type === "audio" && <AudioElement file={file} />}
        {type === "submitButton" && <StageSubmit />}
      </TimedConditionalRender>
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
