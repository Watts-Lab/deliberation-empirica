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
  const playerPosition = player?.get("position");

  const shouldShowDiscussion = useMemo(() => {
    if (!discussion) return false;
    if (!playerPosition) return true; // Intro/exit steps render everything

    const numericPosition = parseInt(playerPosition);

    if (
      discussion.showToPositions &&
      !discussion.showToPositions
        .map((pos) => parseInt(pos))
        .includes(numericPosition)
    ) {
      return false;
    }

    if (
      discussion.hideFromPositions &&
      discussion.hideFromPositions
        .map((pos) => parseInt(pos))
        .includes(numericPosition)
    ) {
      return false;
    }

    return true;
  }, [discussion, playerPosition]);

  const layoutClassForElement = (element) => {
    switch (element.type) {
      case "survey":
      case "qualtrics":
        return "w-full max-w-5xl";
      case "video":
        return "w-full max-w-4xl";
      default:
        return "w-full max-w-2xl";
    }
  };

  const renderElement = (element, index) => (
    <div
      key={`element_wrapper_${index}`}
      className={`mx-auto w-full px-4 py-2 ${layoutClassForElement(element)}`}
    >
      <TimeConditionalRender
        displayTime={element.displayTime}
        hideTime={element.hideTime}
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
    </div>
  );

  const renderDiscussionPage = () => (
    // If the page is larger than 'md', render two columns
    // with the left being the discussion at a fixed location
    // and the right being the elements.
    // If the page is smaller than 'md' render the discussion at the top
    // and the elements below it.

    <div className="flex h-full w-full flex-col gap-4 pb-4 md:flex-row md:items-stretch md:px-6 md:min-h-[calc(100vh-4rem)]">
      <div className="w-full md:flex-1 md:min-w-[24rem]">
        <Discussion
          chatType={discussion.chatType}
          showNickname={discussion.showNickname ?? true}
          showTitle={discussion.showTitle}
          showSelfView={discussion.showSelfView ?? true}
          layout={discussion.layout}
          rooms={discussion.rooms}
          reactionEmojisAvailable={discussion.reactionEmojisAvailable || []}
          reactToSelf={discussion.reactToSelf ?? true}
          numReactionsPerMessage={discussion.numReactionsPerMessage ?? 1}
        />
      </div>

      <div className="w-full px-4 md:w-[40vw] md:min-w-[20rem] md:max-w-[48rem] md:px-0 md:overflow-auto md:scroll-smooth md:self-stretch">
        {elements.map(renderElement)}
      </div>
    </div>
  );

  const renderNoDiscussionPage = () => (
    <div className="flex w-full flex-col pb-2">
      {elements.map(renderElement)}
    </div>
  );

  return (
    <SubmissionConditionalRender>
      {shouldShowDiscussion && renderDiscussionPage()}
      {!shouldShowDiscussion && renderNoDiscussionPage()}
    </SubmissionConditionalRender>
  );
}
