import React, { useState, useEffect } from "react";
import {
  useStageTimer,
  usePlayer,
  usePlayers,
} from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";
import { isMobile } from "react-device-detect";
import { detect } from "detect-browser";
import { Button } from "./Button";
import { Alert } from "./Alert";
import { compare, useReferenceValues } from "./hooks";

// If test controls are enabled,
// returns a button to toggle the contents on or off (initially off)
// otherwise displays the contents by default
export function DevConditionalRender({ children }) {
  const [contentEnabled, setContentEnabled] = useState(
    !(process.env.TEST_CONTROLS === "enabled")
  );
  return (
    <>
      {contentEnabled && children}
      {process.env.TEST_CONTROLS === "enabled" && !contentEnabled && (
        <Button
          handleClick={() => setContentEnabled(!contentEnabled)}
          testId="enableContentButton"
        >
          Show Content
        </Button>
      )}
    </>
  );
}

export function TimeConditionalRender({ displayTime, hideTime, children }) {
  const timer = useStageTimer();
  const player = usePlayer();
  const [tickTock, setTickTock] = useState(false); // used to trigger re-render in intro/exit

  useEffect(() => {
    if (!displayTime && !hideTime) return () => null; // No time conditions
    if (timer) return () => null; // Game is running, don't need triggers to rerender

    const tickTockTime = 1000;
    const tickTockInterval = setInterval(
      () => setTickTock((prev) => !prev),
      tickTockTime
    );

    // this is to trigger a re-render during intro/exit steps at hideTime and displayTime
    return () => clearInterval(tickTockInterval);
  }, [timer, displayTime, hideTime]);

  const msElapsed = timer
    ? timer.elapsed // game
    : Date.now() - player.get("localStageStartTime"); // intro/exit
  const elapsed = msElapsed / 1000;

  if (displayTime && elapsed < displayTime) return null;
  if (hideTime && elapsed > hideTime) return null;

  return children;
}

export function PositionConditionalRender({
  showToPositions,
  hideFromPositions,
  children,
}) {
  const player = usePlayer();
  if (!player) return null;

  const rawPosition = player.get("position");
  // position is undefined in intro steps, so render everything
  if (!rawPosition) return children;

  const position = parseInt(rawPosition);
  if (
    showToPositions &&
    !showToPositions.map((x) => parseInt(x)).includes(position)
  )
    return null;

  if (
    hideFromPositions &&
    hideFromPositions.map((x) => parseInt(x)).includes(position)
  )
    return null;

  return children;
}

export function ConditionsConditionalRender({ conditions, children }) {
  if (!conditions || !conditions.length) return children;
  return (
    <RecursiveConditionalRender conditions={conditions}>
      {children}
    </RecursiveConditionalRender>
  );
}

function RecursiveConditionalRender({ conditions, children }) {
  // only do one condition at a time, nesting these components,
  // so that we only need to get one reference in each component,
  // and can obey the rules for hooks. (ie, can't short-circuit before getting the reference)
  // There must be at least one condition for this to work,
  // so we wrap the whole thing in another component that checks for that.
  const condition = conditions[0];
  const { promptName, position, comparator, value } = condition;
  let { reference } = condition;

  if (promptName) {
    console.log(
      `"promptName" is deprecated in conditions, use "reference" syntax instead. (See docs)`
    );
    reference = `prompt.${promptName}`;
  }

  const referenceValues = useReferenceValues({ reference, position });

  let conditionMet = false;
  if (position === "percentAgreement") {
    const counts = {};
    const definedValues = referenceValues.filter((val) => val !== undefined);

    // If no defined values, no agreement is possible
    if (definedValues.length === 0) {
      conditionMet = false;
    } else {
      definedValues.forEach((val) => {
        const cleanValue =
          typeof val === "string" ? val.toLowerCase().trim() : val;
        counts[cleanValue] = (counts[cleanValue] || 0) + 1;
      });
      const maxCount = Math.max(...Object.values(counts));
      // Use total participants (referenceValues.length) as denominator
      // to include undefined responses in the consensus calculation
      conditionMet = compare(
        (maxCount / referenceValues.length) * 100,
        comparator,
        value
      );
    }
  } else if (position === "any") {
    conditionMet = referenceValues.some((val) =>
      compare(val, comparator, value)
    );
    console.log(
      `testing "any", reference: ${reference}, comparator: ${comparator}, value: ${value}, conditionMet: ${conditionMet} (${referenceValues})`,
      referenceValues
    );
  } else {
    if (position === "all") {
      console.log(
        `testing "all", reference: ${reference}, comparator: ${comparator}, value: ${value}, conditionMet: ${conditionMet} (${referenceValues})`
      );
    }
    conditionMet = referenceValues.every((val) =>
      compare(val, comparator, value)
    );
  }

  if (!conditionMet) return null;

  if (conditions.length === 1) return children; // this is the only condition, and it passed

  return (
    <RecursiveConditionalRender conditions={conditions.slice(1)}>
      {children}
    </RecursiveConditionalRender>
  );
}

export function SubmissionConditionalRender({ children }) {
  const player = usePlayer();
  const players = usePlayers();

  if (player?.stage?.get("submit")) {
    if (!players || players.length === 1) {
      return <Loading />;
    }
    return (
      <div className="text-center text-gray-400 pointer-events-none">
        Please wait for other participant(s).
      </div>
    );
  }

  return children;
}

export function BrowserConditionalRender({ children }) {
  if (isMobile) {
    return (
      <div className="h-screen relative mx-2 my-5">
        <Alert kind="error" title="ERROR: Mobile Device Detected">
          Mobile devices are not supported. Please join again from a computer to
          participate.
        </Alert>
      </div>
    );
  }

  const browser = detect();
  const majorVersion = browser?.version.split(".")[0];
  const browserIsSupported =
    majorVersion >= 89 || // chrome, firefox, edge
    (majorVersion >= 75 && browser?.name === "opera") ||
    (majorVersion >= 15 && browser?.name === "safari");

  if (!browserIsSupported) {
    return (
      <div className="h-screen relative mx-2 my-5">
        <Alert kind="error" title="ERROR: Browser Version Detected">
          Your browser is not supported. Please visit the study link with a more
          up-to-date browser.
        </Alert>

        <h3>List of Supported Browsers:</h3>
        <ul>
          <li>Chrome {">"}= 89 </li>
          <li>Edge {">"}= 89 </li>
          <li>Firefox {">"}= 89 </li>
          <li>Opera {">"}= 75 </li>
          <li>Safari {">"}= 15 </li>
        </ul>
      </div>
    );
  }

  return children;
}
