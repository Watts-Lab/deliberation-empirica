import { useStage, usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import {
  ElementConditionalRender,
  DevConditionalRender,
  SubmissionConditionalRender,
  ColumnLayout,
} from "./components/Layouts";
import { Discussion } from "./elements/Discussion";
import { Element } from "./elements/Element";

export function Stage() {
  const stage = useStage();
  const player = usePlayer();

  const chatType = stage.get("chatType") || "none";
  const elements = stage.get("elements") || [];
  const stageIndex = stage.get("index");
  const stageName = stage.get("name");

  useEffect(() => {
    console.log(`Stage ${stageIndex}: ${stageName}`);
  }, []);

  const renderElement = (element, index) => (
    <ElementConditionalRender
      displayTime={element.displayTime}
      hideTime={element.hideTime}
      showToPositions={element.showToPositions}
      hideFromPositions={element.hideFromPositions}
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
