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

  const stage = useStage();
  const player = usePlayer();

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
          reactionEmojisAvailable={discussion.reactionEmojisAvailable || []}
          reactToSelf={discussion.reactToSelf ?? true}
          numReactionsPerMessage={discussion.numReactionsPerMessage ?? 1}
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
