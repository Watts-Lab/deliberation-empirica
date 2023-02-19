import React, { useState } from "react";
import {
  useStageTimer,
  usePlayer,
  usePlayers,
  useGame,
} from "@empirica/core/player/classic/react";
import { Loading, useGlobal } from "@empirica/core/player/react";
import { isMobile } from "react-device-detect";
import { detect } from "detect-browser";
import { Button } from "./Button";
import { Alert } from "./Alert";
import { NoGames } from "../intro-exit/NoGames";

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

// If we are in dev mode, returns a button to toggle the
// contents on or off.
// In production mode, displays the contents.
export function DevConditionalRender({ children }) {
  const [contentEnabled, setContentEnabled] = useState(
    !(process.env.TEST_CONTROLS === "enabled")
  );
  return (
    <div data-test="devConditionalRender">
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

export function ElementConditionalRender({
  displayTime,
  hideTime,
  showToPositions,
  hideFromPositions,
  children,
}) {
  const player = usePlayer();
  const position = player.get("position");
  const timer = useStageTimer();
  const elapsed = (timer?.elapsed || 0) / 1000;

  // console.log(
  //   `time elapsed: ${elapsed}, displayTime: ${displayTime}, hideTime: ${hideTime}`
  // );
  if (
    (displayTime === undefined || elapsed >= displayTime) &&
    (hideTime === undefined || elapsed < hideTime) &&
    (showToPositions === undefined || showToPositions.includes(position)) &&
    (hideFromPositions === undefined || !hideFromPositions.includes(position))
  ) {
    return children;
  }

  // const displaying = !(
  //   (hideTime && elapsed > hideTime) ||
  //   (displayTime && elapsed < displayTime)
  // );

  // if (displaying) {
  //   return children;
  // }
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

export function PlayableConditionalRender({ children }) {
  const globals = useGlobal();
  const game = useGame();
  const acceptingParticipants = globals?.get("batchesAcceptingParticipants");
  if (!acceptingParticipants && !game) {
    return <NoGames />;
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
