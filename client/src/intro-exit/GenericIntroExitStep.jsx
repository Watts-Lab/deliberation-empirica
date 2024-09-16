/*
Takes the role of "stage" in intro and exit steps, as a place where elements are combined
into a page, and submit responses are defined.
*/
import React, { useEffect, useMemo } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Element } from "../elements/Element";
import {
  ConditionsConditionalRender,
  PositionConditionalRender,
} from "../components/ConditionalRender";

export function GenericIntroExitStep({ name, elements, index, next, phase }) {
  const player = usePlayer();
  const progressLabel = useMemo(
    () => `${phase}_${index}_${name.trim().replace(/ /g, "_")}`,
    [phase, index, name]
  ); // memoize so we don't trigger the useEffect on every render

  useEffect(() => {
    if (player.get("progressLabel") !== progressLabel) {
      console.log(`Starting ${progressLabel}`);
      player.set("progressLabel", progressLabel);
      player.set("localStageStartTime", Date.now());
    }
  }, [progressLabel, player]);

  const onSubmit = () => {
    const elapsed = (Date.now() - player.get("localStageStartTime")) / 1000;
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
