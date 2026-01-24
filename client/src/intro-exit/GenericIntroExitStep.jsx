/*
Takes the role of "stage" in intro and exit steps, as a place where elements are combined
into a page, and submit responses are defined.
*/
import React, { useMemo, useRef } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Element } from "../elements/Element";
import {
  ConditionsConditionalRender,
  PositionConditionalRender,
  TimeConditionalRender,
} from "../components/ConditionalRender";
import {
  useIntroStepProgress,
  useStepElapsedGetter,
} from "../components/hooks";
import { useScrollAwareness } from "../components/useScrollAwareness";
import { ScrollIndicator } from "../components/ScrollIndicator";

export function GenericIntroExitStep({ name, elements, index, next, phase }) {
  const player = usePlayer();
  const getElapsedSeconds = useStepElapsedGetter();
  const contentRef = useRef(null);
  const progressLabel = useMemo(
    () => `${phase}_${index}_${name.trim().replace(/ /g, "_")}`,
    [phase, index, name]
  ); // memoize so we don't trigger the useEffect on every render

  useIntroStepProgress(progressLabel);

  // Scroll awareness for intro/exit step content
  const { showIndicator } = useScrollAwareness(contentRef, elements.length);

  const onSubmit = () => {
    const elapsed = getElapsedSeconds();
    player.set(`duration_${name}`, { time: elapsed });
    next();
  };

  const renderElement = (element, i) => (
    <TimeConditionalRender
      displayTime={element.displayTime}
      hideTime={element.hideTime}
      key={`time_condition_element_${i}`}
    >
      <PositionConditionalRender
        key={`position_condition_element_${i}`}
        showToPositions={element.showToPositions}
        hideFromPositions={element.hideFromPositions}
      >
        <ConditionsConditionalRender conditions={element.conditions}>
          <Element element={element} onSubmit={onSubmit} />
        </ConditionsConditionalRender>
      </PositionConditionalRender>
    </TimeConditionalRender>
  );

  return (
    <div
      className="absolute top-12 bottom-0 left-0 right-0 overflow-auto"
      data-test="genericIntroExit"
      ref={contentRef}
    >
      <div
        className="mx-auto max-w-6xl m-2 pb-6"
      // className=" m-2 pb-6"
      >
        {elements.map(renderElement)}
        <ScrollIndicator visible={showIndicator} />
      </div>
    </div>
  );
}

