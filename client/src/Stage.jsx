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

  const progressLabel = useMemo(() => {
    if (!stage) return "";
    const stageName = stage.get("name");
    if (!stageName) return "";
    return `game_${stage.get("index")}_${stageName.trim().replace(/ /g, "_")}`;
  }, [stage]);

  useEffect(() => {
    if (player.get("progressLabel") !== progressLabel && progressLabel) {
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