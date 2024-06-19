import React, { useState } from "react";
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
      {process.env.TEST_CONTROLS === "enabled" && (
        <Button
          handleClick={() => setContentEnabled(!contentEnabled)}
          testId="enableContentButton"
        >
          {contentEnabled ? "Hide Content" : "Show Content"}
        </Button>
      )}
    </>
  );
}

export function TimeConditionalRender({ displayTime, hideTime, children }) {
  const timer = useStageTimer();
  if (!timer) return null;

  const elapsed = timer.elapsed / 1000;
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
  // and can obey the rules for hooks.
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
    referenceValues.forEach((val) => {
      const cleanValue =
        typeof val === "string" ? val.toLowerCase().trim() : val;
      counts[cleanValue] = (counts[cleanValue] || 0) + 1;
    });
    const maxCount = Math.max(...Object.values(counts));
    conditionMet = compare(
      (maxCount / referenceValues.length) * 100,
      comparator,
      value
    );
  } else {
    conditionMet = referenceValues.every((val) =>
      compare(val, comparator, value)
    );
  }

  if (!conditionMet) return null;
  if (!conditions.length) return children; // this is the only condition, and it passed
  return (
    <ConditionsConditionalRender conditions={conditions.slice(1)}>
      {children}
    </ConditionsConditionalRender>
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
