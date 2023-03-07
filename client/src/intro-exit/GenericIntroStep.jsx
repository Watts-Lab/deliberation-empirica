/*
Takes the role of "stage" in intro and exit steps, as a place where elements are combnined
into a page, and submit responses are defined.
*/
import React, { useEffect } from "react";
import { Element } from "../elements/Element";
import { useProgressLabel } from "../components/utils";

export function GenericIntroStep({ name, elements, next }) {
  const progressLabel = useProgressLabel();

  useEffect(() => {
    console.log(`${progressLabel}: ${name}`);
  }, []);

  const renderElement = (element, elementIndex) => (
    <div key={`element_${elementIndex}`}>
      <Element element={element} onSubmit={next} />
    </div>
  );

  return <div>{elements.map(renderElement)}</div>;
}
