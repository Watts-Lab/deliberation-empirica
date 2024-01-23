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
import { compare } from "./utils";

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

export function ElementConditionalRender({
  displayTime,
  hideTime,
  showToPositions,
  hideFromPositions,
  conditions,
  children,
}) {
  const timer = useStageTimer();
  const player = usePlayer();
  const game = useGame();
  const players = usePlayers();

  const timeCheck = () => {
    const elapsed = (timer?.elapsed || 0) / 1000;
    return (
      (displayTime === undefined || elapsed >= displayTime) &&
      (hideTime === undefined || elapsed < hideTime)
    );
  };

  const positionCheck = () => {
    const position = parseInt(player.get("position")); // See assignPosition player.set("position", playerPosition.toString());
    if (!Number.isInteger(position) && (showToPositions || hideFromPositions)) {
      console.error("Player position not defined");
      return false;
    }

    return (
      (showToPositions === undefined || showToPositions.includes(position)) &&
      (hideFromPositions === undefined || !hideFromPositions.includes(position))
    );
  };

  const conditionCheck = (condition) => {
    const { promptName, position, comparator, value } = condition;

    if (position === "shared") {
      if (!game) return false;
      const lhs = game?.get(`prompt_${promptName}`)?.value;
      return compare(lhs, comparator, value);
    }

    if (position === "player" || position === undefined) {
      if (!player) return false;
      const lhs = player?.get(`prompt_${promptName}`)?.value;
      return compare(lhs, comparator, value);
    }

    if (position === "all") {
      if (!players) return false;
      return players.every((p) => {
        const lhs = p.get(`prompt_${promptName}`)?.value;
        return compare(lhs, comparator, value);
      });
    }

    if (position === "percentAgreement") {
      // compare the percent adoption of the modal response with the value, using the comparator
      if (!players) return false;

      const responses = players.map(
        (p) => p.get(`prompt_${promptName}`)?.value
      );
      const counts = {};

      // eslint-disable-next-line no-restricted-syntax
      for (const response of responses) {
        counts[response] = (counts[response] || 0) + 1;
      }
      const maxCount = Math.max(...Object.values(counts));
      return compare((maxCount / responses.length) * 100, comparator, value);
    }

    if (Number.isInteger(parseInt(position))) {
      if (!players) return false;
      const alter = players.filter(
        (p) => parseInt(p.get("position")) === position
      )[0];
      const lhs = alter?.get(`prompt_${promptName}`)?.value;
      return compare(lhs, comparator, value);
    }

    console.error(`Invalid position value: ${position}`);
    return false;
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
    if (players.length === 1) {
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
