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
  }, []);

  const renderElement = (element, i) => {
    if (
      element.displayTime ||
      element.hideTime ||
      element.showToPositions ||
      element.hideFromPositions
    ) {
      console.error(
        "Intro sequence elements cannot have time or position conditions"
      );
    }
    console.log("intro element:", i, element);
    return (
      <ElementConditionalRender
        key={`element_${i}`}
        conditions={element.conditions}
      >
        <Element element={element} onSubmit={next} />
      </ElementConditionalRender>
    );
  };

  return (
    <div className="mt-12 mb-5 grid justify-center">
      <ConfirmLeave />
      {elements.map(renderElement)}
    </div>
  );
}
