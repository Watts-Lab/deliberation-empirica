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
  // const devTools = () => (
  //   <div data-test="devTools">
  //     <input
  //       type="checkbox"
  //       id="enableVideoCall"
  //       name="enableVideoCall"
  //       data-test="enableVideoCall"
  //       onClick={setCallEnabled}
  //     />
  //     <label htmlFor="enableVideoCall">Enable VideoCall</label>
  //     <br />
  //     <input
  //       type="submit"
  //       data-test="skip"
  //       onClick={() => player.stage.set("submit", true)}
  //     />
  //   </div>
  // );

  // const displayComponent = (type) => {
  //   const promptList = stage.get("promptList");
  //   switch (type) {
  //     case "discussion":
  // return (
  //   <div className="mt-5 md:(flex space-x-4)">
  //     <div className="min-w-sm h-[45vh] md:(flex-grow h-[90vh])">
  //       {callEnabled ? <Discussion /> : <h2>VideoCall disabled</h2>}
  //     </div>
  //     {promptList && (
  //       <div className="max-w-lg">
  //         <PromptList promptList={promptList} submitButton={false} />
  //       </div>
  //     )}
  //   </div>
  // );
  //     case "prompt":
  //       return <PromptList promptList={promptList} />;

  //     case "video":
  //       return <TrainingVideo url={stage.get("url")} />;

  //     default:
  //       return <br />;
  //   }
  // };

  // return (
  //   <div>
  //     {}
  //     {displayComponent(stage.get("type"))}
  //     {isDevelopment && devTools()}
  //   </div>
  // );
}
