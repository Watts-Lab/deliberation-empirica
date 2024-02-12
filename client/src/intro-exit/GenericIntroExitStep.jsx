/*
Takes the role of "stage" in intro and exit steps, as a place where elements are combined
into a page, and submit responses are defined.
*/
import React, { useEffect } from "react";
import { Element } from "../elements/Element";
import { ElementConditionalRender } from "../components/Layouts";
import { ConfirmLeave } from "../components/ConfirmLeave";

export function GenericIntroExitStep({ name, elements, index, next }) {
  useEffect(() => {
    console.log(`Intro sequence step ${index}: ${name}`);
  }, [name, index]); // both name and index should be constant for a given step

  const renderElement = (element, i) => {
    console.log("intro element:", i, element);
    return (
      <ElementConditionalRender
        key={`element_${i}`}
        conditions={element.conditions}
        showToPositions={element.showToPositions} // TODO: check that these are only used in exit steps
        hideFromPositions={element.hideFromPositions}
      >
        <Element element={element} onSubmit={next} />
      </ElementConditionalRender>
    );
  };

  return (
    <div
      className="mt-12 mb-5 grid justify-center w-full min-w-lg"
      data-test="genericIntroExit"
    >
      <ConfirmLeave />
      {elements.map(renderElement)}
    </div>
  );
}
