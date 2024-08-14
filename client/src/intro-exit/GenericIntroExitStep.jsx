/*
Takes the role of "stage" in intro and exit steps, as a place where elements are combined
into a page, and submit responses are defined.
*/
import React, { useEffect, useState } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Element } from "../elements/Element";
import {
  ConditionsConditionalRender,
  PositionConditionalRender,
} from "../components/ConditionalRender";

export function GenericIntroExitStep({ name, elements, index, next }) {
  const player = usePlayer();
  const [loadedTime, setLoadedTime] = useState(-1);

  useEffect(() => {
    setLoadedTime(Date.now());
    if (player.get("introDone")) {
      console.log(`Exit sequence step ${index}: ${name}`);
    } else {
      console.log(`Intro sequence step ${index}: ${name}`);
    }
  }, [name, index, player]); // both name and index should be constant for a given step

  const onSubmit = () => {
    const elapsed = (Date.now() - loadedTime) / 1000;
    player.set(`duration_${name}`, { time: elapsed });
    next();
  };

  const renderElement = (element, i) => (
    <PositionConditionalRender
      key={`element_${i}`}
      showToPositions={element.showToPositions}
      hideFromPositions={element.hideFromPositions}
    >
      <ConditionsConditionalRender conditions={element.conditions}>
        <Element element={element} onSubmit={onSubmit} />
      </ConditionsConditionalRender>
    </PositionConditionalRender>
  );

  return (
    <div
      className="absolute top-12 bottom-0 left-0 right-0"
      data-test="genericIntroExit"
    >
      <div className="mx-auto max-w-3xl m-2 pb-6">
        {elements.map(renderElement)}
      </div>
    </div>
  );
}
