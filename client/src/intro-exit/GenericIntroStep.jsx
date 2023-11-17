/*
Takes the role of "stage" in intro and exit steps, as a place where elements are combnined
into a page, and submit responses are defined.
*/
import React, { useEffect } from "react";
import { Element } from "../elements/Element";

export function GenericIntroStep({ name, elements, index, next }) {
  useEffect(() => {
    console.log(`Intro sequence step ${index}: ${name}`);
  }, []);

  const renderElement = (element) => (
    <div key={`element_${index}`}>
      <Element element={element} onSubmit={next} />
    </div>
  );

  return (
    <div className="mt-12 mb-5 grid justify-center">
      {elements.map(renderElement)}
    </div>
  );
}
