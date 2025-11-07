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

    <PositionConditionalRender
      showToPositions={discussion.showToPositions}
      hideFromPositions={discussion.hideFromPositions}
    >
      <div className="flex h-full w-full flex-col gap-4 pb-4 md:flex-row md:items-stretch md:px-6 md:min-h-[calc(100vh-4rem)]">
        <div className="w-full md:flex-1 md:min-w-[24rem]">
          <Discussion
            chatType={discussion.chatType}
            showNickname={discussion.showNickname ?? true}
            showTitle={discussion.showTitle}
            layout={discussion.layout}
            rooms={discussion.rooms}
            reactionEmojisAvailable={discussion.reactionEmojisAvailable || []}
            reactToSelf={discussion.reactToSelf ?? true}
            numReactionsPerMessage={discussion.numReactionsPerMessage ?? 1}
          />
        </div>

        <div className="w-full px-4 md:w-[30vw] md:min-w-[20rem] md:max-w-[40rem] md:px-0 md:overflow-auto md:scroll-smooth md:self-stretch">
          {elements.map(renderElement)}
        </div>
      </div>
    </PositionConditionalRender>
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
