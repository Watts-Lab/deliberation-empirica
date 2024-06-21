import { useStage, usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import {
  TimeConditionalRender,
  PositionConditionalRender,
  ConditionsConditionalRender,
  SubmissionConditionalRender,
} from "./components/ConditionalRender";
import { Discussion } from "./elements/Discussion";
import { Element } from "./elements/Element";

export function Stage() {
  const stage = useStage();
  const player = usePlayer();

  useEffect(() => {
    console.log(`Stage ${stage.get("index")}: ${stage.get("name")}`);
  }, [stage, player]);

  const discussion = stage?.get("discussion");
  const elements = stage?.get("elements") || [];

  const renderElement = (element, index) => (
    <TimeConditionalRender
      displayTime={element.displayTime}
      hideTime={element.hideTime}
      key={`element_${index}`}
    >
      <PositionConditionalRender
        showToPositions={element.showToPositions}
        hideFromPositions={element.hideFromPositions}
      >
        <ConditionsConditionalRender conditions={element.conditions}>
          <Element
            element={element}
            onSubmit={() => player.stage.set("submit", true)}
          />
        </ConditionsConditionalRender>
      </PositionConditionalRender>
    </TimeConditionalRender>
  );

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
    <div className="mt-2 mb-2 mx-auto max-w-xl pb-2">
      {elements.map(renderElement)}
    </div>
  );

  return (
    <div className="absolute top-16 bottom-0 left-0 right-0">
      <SubmissionConditionalRender>
        {!!discussion && renderDiscussionPage()}
        {!discussion && renderNoDiscussionPage()}
      </SubmissionConditionalRender>
    </div>
  );
}
