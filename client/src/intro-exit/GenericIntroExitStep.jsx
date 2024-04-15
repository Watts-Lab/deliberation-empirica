/*
Takes the role of "stage" in intro and exit steps, as a place where elements are combined
into a page, and submit responses are defined.
*/
import React, { useEffect } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Element } from "../elements/Element";
import { ElementConditionalRender } from "../components/Layouts";
import { ConfirmLeave } from "../components/ConfirmLeave";

export function GenericIntroExitStep({ name, elements, index, next }) {
  const player = usePlayer();

  useEffect(() => {
    if (player.get("introDone")) {
      console.log(`Exit sequence step ${index}: ${name}`);
    } else {
      console.log(`Intro sequence step ${index}: ${name}`);
    }
  }, [name, index, player]); // both name and index should be constant for a given step

  const renderElement = (element, i) => (
    <ElementConditionalRender
      key={`element_${i}`}
      conditions={element.conditions}
      showToPositions={element.showToPositions} // TODO: check that these are only used in exit steps
      hideFromPositions={element.hideFromPositions}
    >
      <Element element={element} onSubmit={next} />
    </ElementConditionalRender>
  );

  return (
    <div
      className="mt-12 mb-5 mx-5 grid justify-center w-full min-w-lg max-2-xl"
      data-test="genericIntroExit"
    >
      <ConfirmLeave />
      {elements.map(renderElement)}
    </div>
  );
}
