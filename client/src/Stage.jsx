import { useStage, usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect, useMemo, useRef } from "react";
import {
  TimeConditionalRender,
  PositionConditionalRender,
  ConditionsConditionalRender,
  SubmissionConditionalRender,
} from "./components/ConditionalRender";
import { Discussion } from "./elements/Discussion";
import { Element } from "./elements/Element";
import { useScrollAwareness } from "./components/scroll/useScrollAwareness";
import { ScrollIndicator } from "./components/scroll/ScrollIndicator";

export function Stage() {
  const stage = useStage();
  const player = usePlayer();

  // Refs for scroll-aware content containers
  const discussionPageContentRef = useRef(null);
  const noDiscussionPageContentRef = useRef(null);

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

  // Scroll awareness for the right-side content pane (discussion page)
  const { showIndicator: showDiscussionIndicator } = useScrollAwareness(
    discussionPageContentRef
  );

  // Scroll awareness for the full-page content (no discussion)
  const { showIndicator: showNoDiscussionIndicator } = useScrollAwareness(
    noDiscussionPageContentRef
  );

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
          showReportMissing={discussion.showReportMissing ?? true}
          layout={discussion.layout}
          rooms={discussion.rooms}
          reactionEmojisAvailable={discussion.reactionEmojisAvailable || []}
          reactToSelf={discussion.reactToSelf ?? true}
          numReactionsPerMessage={discussion.numReactionsPerMessage ?? 1}
        />
      </div>

      <div
        ref={discussionPageContentRef}
        className="w-full px-4 md:w-[40vw] md:min-w-[20rem] md:max-w-[48rem] md:px-0 md:overflow-auto md:scroll-smooth md:self-stretch"
      >
        {elements.map(renderElement)}
        <ScrollIndicator visible={showDiscussionIndicator} />
      </div>
    </div>
  );

  const renderNoDiscussionPage = () => (
    <div
      ref={noDiscussionPageContentRef}
      className="flex w-full flex-col pb-2 overflow-auto"
    >
      {elements.map(renderElement)}
      <ScrollIndicator visible={showNoDiscussionIndicator} />
    </div>
  );

  return (
    <SubmissionConditionalRender>
      {shouldShowDiscussion && renderDiscussionPage()}
      {!shouldShowDiscussion && renderNoDiscussionPage()}
    </SubmissionConditionalRender>
  );
}

