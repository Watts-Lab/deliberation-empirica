import React, { useState } from "react";
import {
  useStageTimer,
  usePlayer,
  useRound,
  usePlayers,
} from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";
import { isMobile } from "react-device-detect";
import { detect } from "detect-browser";
import { Button } from "./Button";
import { Alert } from "./Alert";
import { compare } from "./utils";

// Responsive two column layout if both left and right are specified
// Otherwise single column no styling
export function ColumnLayout({ left, right }) {
  if (!left || !right) {
    return (
      <>
        {left}
        {right}
      </>
    );
  }
  return (
    <div className="mt-5 md:(flex space-x-4)">
      <div className="min-w-sm h-[45vh] md:(flex-grow h-[90vh])">{left}</div>
      <div className="max-w-lg">{right}</div>
    </div>
  );
}

// If test controls are enabled,
// returns a button to toggle the contents on or off (initially off)
// otherwise displays the contents by default
export function DevConditionalRender({ children }) {
  const [contentEnabled, setContentEnabled] = useState(
    !(process.env.TEST_CONTROLS === "enabled")
  );
  return (
    <div className="h-full" data-test="devConditionalRender">
      {contentEnabled && children}
      {process.env.TEST_CONTROLS === "enabled" && (
        <Button
          handleClick={() => setContentEnabled(!contentEnabled)}
          testId="enableContentButton"
        >
          {contentEnabled ? "Hide Content" : "Show Content"}
        </Button>
      )}
    </div>
  );
}

function TimeConditionalRender({ displayTime, hideTime, children }) {
  const timer = useStageTimer();
  if (!timer) return null;
  const elapsed = (timer?.elapsed || 0) / 1000;

  if (
    (displayTime === undefined || elapsed >= displayTime) &&
    (hideTime === undefined || elapsed < hideTime)
  ) {
    return children;
  }
}

function PositionConditionalRender({
  showToPositions,
  hideFromPositions,
  children,
}) {
  const player = usePlayer();

  const position = parseInt(player.get("position")); // See assignPosition player.set("position", playerPosition.toString());
  if (!Number.isInteger(position) && (showToPositions || hideFromPositions)) {
    console.error("Player position not defined");
    return null;
  }

  if (
    (showToPositions === undefined || showToPositions.includes(position)) &&
    (hideFromPositions === undefined || !hideFromPositions.includes(position))
  ) {
    return children;
  }
}

function PromptConditionalRender({ conditions, children }) {
  const player = usePlayer();
  const round = useRound();
  const players = usePlayers();

  const conditionMet = (condition) => {
    const { promptName, position, comparator, value } = condition;

    if (position === "shared") {
      if (!round) return false;
      const lhs = round?.get(`prompt_${promptName}`)?.value;
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

  if (conditions === undefined || conditions.every(conditionMet)) {
    return children;
  }
}

export function ElementConditionalRender({
  displayTime,
  hideTime,
  showToPositions,
  hideFromPositions,
  conditions,
  children,
}) {
  return (
    <TimeConditionalRender displayTime={displayTime} hideTime={hideTime}>
      <PositionConditionalRender
        showToPositions={showToPositions}
        hideFromPositions={hideFromPositions}
      >
        {conditions ? (
          <PromptConditionalRender conditions={conditions}>
            {children}
          </PromptConditionalRender>
        ) : (
          children
        )}
      </PositionConditionalRender>
    </TimeConditionalRender>
  );
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
