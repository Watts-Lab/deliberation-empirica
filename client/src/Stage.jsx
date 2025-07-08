import { useStage, usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect, useMemo } from "react";
import {
  TimeConditionalRender,
  PositionConditionalRender,
  ConditionsConditionalRender,
  SubmissionConditionalRender,
} from "./components/ConditionalRender";
import { Discussion } from "./elements/Discussion";
import { Element } from "./elements/Element";

export function Stage() {
  console.log("Before use stage");

  const stage = useStage();

  // Is there a way to refactor so we just perform these checks in mocks.js?
  // Maybe check if we can comment this out
  if (!stage) {
    return <p>Loading stage...</p>;
  }
  const player = usePlayer();

  console.log("stage", stage);
  // stage.set("name", "TestTemplateA");
  console.log("stage and stage name", stage, stage?.get("name"));

  // breaks here
  const progressLabel = useMemo(
    () =>
      `game_${stage.get("index")}_${stage
        .get("name")
        .trim()
        .replace(/ /g, "_")}`, // replace ALL spaces with underscores
    [stage]
  ); // memoize so we don't trigger the useEffect on every render

  useEffect(() => {
    if (player.get("progressLabel") !== progressLabel) {
      console.log(`Starting ${progressLabel}`);
      player.set("progressLabel", progressLabel);
      player.set("localStageStartTime", undefined); // force use of stageTimer
    }
  }, [progressLabel, player]);

  const discussion = stage?.get("discussion");
  const elements = stage?.get("elements") || [];

  console.log("Elements in stage", elements);

// Commented out to ignore conditional renders for now
  // const renderElement = (element, index) => (
  //   <TimeConditionalRender
  //     displayTime={element.displayTime}
  //     hideTime={element.hideTime}
  //     key={`element_${index}`}
  //   >
  //     <PositionConditionalRender
  //       showToPositions={element.showToPositions}
  //       hideFromPositions={element.hideFromPositions}
  //     >
  //       <ConditionsConditionalRender conditions={element.conditions}>
  //         <Element
  //           element={element}
  //           onSubmit={() => player.stage.set("submit", true)}
  //         />
  //       </ConditionsConditionalRender>
  //     </PositionConditionalRender>
  //   </TimeConditionalRender>
  // );

  const renderElement = (element, index) => (
    <Element
      element={element}
      onSubmit={() => player.stage.set("submit", true)}
    />
  )

  const renderDiscussionPage = () => (
    // If the page is larger than 'md', render two columns
    // with the left being the discussion at a fixed location
    // and the right being the elements.
    // If the page is smaller than 'md' render the discussion at the top
    // and the elements below it.

    <>
      <div className="md:absolute md:left-0 md:top-0 md:bottom-0 md:right-150">
        <Discussion
          chatType={discussion.chatType}
          showNickname={discussion.showNickname ?? true}
          showTitle={discussion.showTitle}
        />
      </div>

      <div className="pb-4 px-4 md:absolute md:right-0 md:w-150 md:bottom-0 md:top-0 md:overflow-auto md:scroll-smooth">
        {elements.map(renderElement)}
      </div>
    </>
  );

  const renderNoDiscussionPage = () => (
    <div className="mx-auto max-w-2xl pb-2">{elements.map(renderElement)}</div>
  );

  return (
    <SubmissionConditionalRender>
      {!!discussion && renderDiscussionPage()}
      {!discussion && renderNoDiscussionPage()}
    </SubmissionConditionalRender>
  );
}
