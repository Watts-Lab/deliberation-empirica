/*
Can be embedded inside an mturk HIT, and if so, opens the same window in a separate tab
so that participants can continue.

Todo: Add payment amounts
Todo: Add countdown for how long remains before the deadline.
Todo: handle platform by prepending `m_`, `p_` etc to workerID.
  - If we have these from the urlParams, do them automatically,
  - Otherwise, have workers select which platform they were recruited on.
*/

import React, { useEffect, useState } from "react";
import { useGlobal } from "@empirica/core/player/react";
import { Button } from "../components/Button";
import { Markdown } from "../components/Markdown";
import { P, H1, H3 } from "../components/TextStyles";
import { CheckboxGroup } from "../components/CheckboxGroup";

export function DescriptivePlayerIdForm({ onPlayerID }) {
  const isEmbedded = window.location !== window.parent.location; // are we in an iframe?
  const isTest = !!window.Cypress; // are we in the test harness iframe?

  const globals = useGlobal();
  const batchConfig = globals?.get("recruitingBatchConfig");
  const checkVideo = batchConfig?.checkVideo ?? true; // default to true if not specified
  const checkAudio = (batchConfig?.checkAudio ?? true) || checkVideo; // default to true if not specified, force true if checkVideo is true

  const urlParams = new URLSearchParams(window.location.search);
  const paramsObj = Object.fromEntries(urlParams?.entries());
  const paymentIdFromURL = paramsObj?.workerId || undefined;
  const [playerID, setPlayerID] = useState(paymentIdFromURL || "");
  const [checks, setChecks] = useState([]);

  useEffect(() => {
    console.log("Intro: Descriptive player ID form");
  }, []);

  const handleSubmit = (evt) => {
    evt.preventDefault();
    if (!playerID || playerID.trim() === "") {
      return;
    }
    if (isEmbedded && !isTest) window.open(window.location.href, "_blank");
    onPlayerID(playerID);
  };

  const timeString = batchConfig?.launchDate
    ? new Date(batchConfig.launchDate).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
        timeZoneName: "short",
      })
    : "ASAP";

  const immediate = `
## This study has two parts:
### Part 1
- On your own
- Starts now
- Takes 5-10 minutes

### Part 2
- In a group
- Starts when enough people have completed Part 1
- Takes 15-45 minutes
`;

  const delayed = `
## This study has two parts:
### Part 1
- On your own
- Starts now
- Deadline: ${timeString}
- Remember to leave your browser window open until Part 2 starts

### Part 2
- In a group
- Starts at ${timeString}
- Takes 15-45 minutes
`;

  const renderChecks = () => {
    const options = {};
    if (checkVideo) {
      options.webcam = "I have a working webcam";
    }
    if (checkAudio) {
      options.mic = "I have a working microphone";
      options.headphones = "I have working headphones or earbuds";
    }
    return (
      <div>
        <H3>Please confirm the following to participate:</H3>

        <CheckboxGroup
          options={options}
          selected={checks}
          onChange={setChecks}
          testId="checks"
        />
      </div>
    );
  };

  const renderIdInput = () => (
    <div>
      <H3>Please enter your assigned payment ID</H3>
      <P>
        This could be your MTurk ID, Prolific ID, or Wharton Behavior Lab ID.
      </P>
      <input
        type="text"
        autoComplete="off"
        id="playerID"
        name="playerID"
        required
        className="appearance-none block w-sm px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-empirica-500 focus:border-empirica-500 sm:text-sm"
        value={playerID}
        onChange={(e) => setPlayerID(e.target.value)}
        data-test="inputPaymentId"
      />
    </div>
  );

  const checksPass =
    ((!checkVideo || checks.includes("webcam")) &&
      (!checkAudio ||
        (checks.includes("mic") && checks.includes("headphones")))) ??
    false;

  return (
    <div className="grid justify-center">
      <H1>This is a group discussion study.</H1>
      {!checksPass && renderChecks()}

      {checksPass && (
        <Markdown text={batchConfig?.launchDate ? delayed : immediate} />
      )}

      {checksPass && !paymentIdFromURL && renderIdInput()}

      {checksPass && (
        <div className="w-auto mt-10">
          <Button handleClick={handleSubmit} testId="joinButton">
            {isEmbedded ? "Join the study in a new tab" : "Join the study"}
          </Button>
        </div>
      )}
    </div>
  );
}
