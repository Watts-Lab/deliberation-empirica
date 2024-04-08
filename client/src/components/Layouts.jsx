import React, { useState } from "react";
import {
  useStageTimer,
  usePlayer,
  useGame,
  usePlayers,
} from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";
import { isMobile } from "react-device-detect";
import { detect } from "detect-browser";
import { Button } from "./Button";
import { Alert } from "./Alert";
import { compare, useReferenceValue } from "./utils";

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

const getNestedValueByPath = (obj, path) => {
  return path.reduce((acc, key) => acc?.[key], obj);
};

export function ElementConditionalRender({
  displayTime,
  hideTime,
  showToPositions,
  hideFromPositions,
  conditions,
  children,
}) {
  const passTimeCheck = useTimeCheck({ displayTime, hideTime });
  const passPositionCheck = usePositionCheck({
    showToPositions,
    hideFromPositions,
  });

  const timer = useStageTimer();
  const player = usePlayer();
  const game = useGame();
  const players = usePlayers();

  const conditionCheck = (condition) => {
    const { promptName, position, comparator, value, reference } = condition;
    if (promptName)
      console.log(
        `"promptName" is deprecated in conditions, use "reference" syntax instead. (See docs)`
      );

    const type = reference.split(".")[0];
    let name;
    let path;
    let referenceKey;
    if (["survey", "submitButton", "qualtrics"].includes(type)) {
      [, name, ...path] = reference.split(".");
      referenceKey = `${type}_${name}`;
    } else if (type === "prompt") {
      // eslint-disable-next-line prefer-destructuring
      name = reference.split(".")[1];
      referenceKey = `${type}_${name}`;
      path = ["value"]; // shortcut for prompt value, so you don't have to include it in the reference string
    } else if (["urlParams", "connectionInfo", "browserInfo"].includes(type)) {
      [, ...path] = reference.split(".");
      referenceKey = type;
    } else {
      console.error(`Invalid reference type: ${type}`);
      return false;
    }

    let referenceSource;
    switch (position) {
      case "shared":
        referenceSource = [game];
        break;
      case "player":
      case undefined:
        referenceSource = [player];
        break;
      case "all":
      case "percentAgreement":
        referenceSource = players;
        break;
      default:
        if (Number.isInteger(parseInt(position))) {
          referenceSource = players.filter(
            (p) => parseInt(p.get("position")) === position
          ); // array
        } else {
          console.error(`Invalid position value: ${position}`);
          return false;
        }
    }

    let referenceValues;
    try {
      const referenceObjects = referenceSource.map((p) => p.get(referenceKey));
      referenceValues = referenceObjects.map((obj) =>
        getNestedValueByPath(obj, path)
      );
      // console.log(
      //   "type",
      //   type,
      //   "name",
      //   name,
      //   "path",
      //   path,
      //   "referenceSource:",
      //   referenceSource,
      //   "referenceKey",
      //   referenceKey,

      //   "referenceObjects",
      //   referenceObjects,
      //   "referenceValues",
      //   referenceValues
      // );
    } catch (error) {
      console.error(
        `Error getting value with reference key: ${referenceKey} and path: ${path}`
      );
      return false;
    }

    if (position === "percentAgreement") {
      const counts = {};
      referenceValues.forEach((val) => {
        const lowerValue = typeof val === "string" ? val.toLowerCase() : val;
        counts[lowerValue] = (counts[lowerValue] || 0) + 1;
      });
      const maxCount = Math.max(...Object.values(counts));
      return compare(
        (maxCount / referenceValues.length) * 100,
        comparator,
        value
      );
    }
    return referenceValues.every((val) => compare(val, comparator, value));
  };

  if (
    ((!displayTime && !hideTime) || timeCheck()) &&
    ((!showToPositions && !hideFromPositions) || positionCheck()) &&
    (!conditions || conditions.every(conditionCheck))
  ) {
    return children;
  }
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
