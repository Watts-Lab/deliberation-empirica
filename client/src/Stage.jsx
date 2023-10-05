import { useStage, usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import {
  ElementConditionalRender,
  SubmissionConditionalRender,
  ColumnLayout,
} from "./components/Layouts";
import { Discussion } from "./elements/Discussion";
import { Element } from "./elements/Element";

export function Stage() {
  const stage = useStage();
  const player = usePlayer();

  const discussion = stage?.get("discussion") || "none";
  const elements = stage?.get("elements") || [];

  useEffect(() => {
    console.log(`Stage ${stage.get("index")}: ${stage.get("name")}`);
  }, [stage, player]);

  const renderElement = (element, index) => (
    <ElementConditionalRender
      displayTime={element.displayTime}
      hideTime={element.hideTime}
      showToPositions={element.showToPositions}
      hideFromPositions={element.hideFromPositions}
      conditions={element.conditions}
      key={`element_${index}`}
    >
      <Element
        element={element}
        onSubmit={() => player.stage.set("submit", true)}
      />
    </ElementConditionalRender>
  );

  return (
    <SubmissionConditionalRender>
      <ColumnLayout
        left={
          discussion !== "none" && (
            <Discussion
              chatType={discussion.chatType}
              showNickname={discussion.showNickname ?? true}
              showTitle={discussion.showTitle}
            />
          )
        }
        right={elements.map(renderElement)}
      />
    </SubmissionConditionalRender>
  );
}
