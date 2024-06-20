/*
Takes the role of "stage" in intro and exit steps, as a place where elements are combined
into a page, and submit responses are defined.
*/
import React, { useEffect } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Element } from "../elements/Element";
import {
  ConditionsConditionalRender,
  PositionConditionalRender,
} from "../components/ConditionalRender";

export function GenericIntroExitStep({ name, elements, index, next }) {
  const player = usePlayer();

  useEffect(() => {
    if (player.get("introDone")) {
      console.log(`Exit sequence step ${index}: ${name}`);
    } else {
      console.log(`Intro sequence step ${index}: ${name}`);
    }
  }, [name, index, player]); // both name and index should be constant for a given step

  const renderElement = (element, i) => {
    console.log("Element", element);
    return (
      <PositionConditionalRender
        key={`element_${i}`}
        showToPositions={element.showToPositions}
        hideFromPositions={element.hideFromPositions}
      >
        <ConditionsConditionalRender conditions={element.conditions}>
          <Element element={element} onSubmit={next} />
        </ConditionsConditionalRender>
      </PositionConditionalRender>
    );
  };

  return (
    <div
      className="mt-12 mb-5 mx-5 grid justify-center w-full min-w-lg max-2-xl"
      data-test="genericIntroExit"
    >
      {elements.map(renderElement)}
    </div>
  );
}
