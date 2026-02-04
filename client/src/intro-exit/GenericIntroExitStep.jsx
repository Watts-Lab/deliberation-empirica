/*
Takes the role of "stage" in intro and exit steps, as a place where elements are combined
into a page, and submit responses are defined.
*/
import React, { useRef } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Element } from "../elements/Element";
import {
  ConditionsConditionalRender,
  PositionConditionalRender,
  TimeConditionalRender,
} from "../components/ConditionalRender";
import { useScrollAwareness } from "../components/scroll/useScrollAwareness";
import { ScrollIndicator } from "../components/scroll/ScrollIndicator";
import {
  IntroExitProgressLabelProvider,
  useGetElapsedTime,
} from "../components/progressLabel";

function GenericIntroExitStepInner({ name, elements, next }) {
  const player = usePlayer();
  const getElapsedTime = useGetElapsedTime();
  const contentRef = useRef(null);

  // Scroll awareness for intro/exit step content
  const { showIndicator } = useScrollAwareness(contentRef);

  const onSubmit = () => {
    const elapsed = getElapsedTime();
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
        className="mx-auto max-w-6xl w-full px-4 md:px-8 pb-6"
        // className=" m-2 pb-6"
      >
        {elements.map(renderElement)}
        <ScrollIndicator visible={showIndicator} />
      </div>
    </div>
  );
}

export function GenericIntroExitStep({ name, elements, index, next, phase }) {
  return (
    <IntroExitProgressLabelProvider phase={phase} index={index} name={name}>
      <GenericIntroExitStepInner name={name} elements={elements} next={next} />
    </IntroExitProgressLabelProvider>
  );
}
