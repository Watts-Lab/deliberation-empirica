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
import axios from "axios";
import { Button } from "../components/Button";
import { Markdown } from "../components/Markdown";
import { P, H3 } from "../components/TextStyles";
// import { default as ReactCountdown, zeroPad } from "react-countdown";

export function DescriptivePlayerIdForm({ onPlayerID }) {
  const isEmbedded = window.location !== window.parent.location; // are we in an iframe?
  const isTest = !!window.Cypress; // are we in the test harness iframe?
  // const isEmbeddedInMturk = window.parent.location.hostname.includes("mturk");

  const globals = useGlobal();
  const batchConfig = globals?.get("recruitingBatchConfig");

  const urlParams = new URLSearchParams(window.location.search);
  const paramsObj = Object.fromEntries(urlParams?.entries());
  const paymentIdFromURL = paramsObj?.workerId || undefined;
  const [playerID, setPlayerID] = useState(paymentIdFromURL || "");
  const [timeZone, setTimeZone] = useState(undefined);
  // const [clientClockOffset, setClientClockOffset] = useState(0);

  async function getTimeOffset() {
    const { data } = await axios.get(`https://worldtimeapi.org/api/ip`);
    const { abbreviation, utc_datetime } = data;
    const offset = Date.parse(utc_datetime) - Date.now();

    setTimeZone(abbreviation);
    // setClientClockOffset(offset);
    console.log(`TZ: ${abbreviation}, offset: ${offset}`);
  }

  useEffect(() => {
    console.log("Intro: Descriptive player ID form");
    getTimeOffset();
  }, []);

  const handleSubmit = (evt) => {
    evt.preventDefault();
    if (!playerID || playerID.trim() === "") {
      return;
    }
    if (isEmbedded && !isTest) window.open(window.location.href, "_blank");
    onPlayerID(playerID);
  };

  // Todo: get these from batch
  const launchTime = batchConfig?.launchDate
    ? new Date(batchConfig?.launchDate).toLocaleTimeString()
    : undefined; // adjust for local timezone?

  const timeString =
    timeZone && launchTime && !launchTime.includes("Invalid")
      ? `**${launchTime} ${timeZone} today**`
      : batchConfig?.launchDate;

  const text2part = `
## Join a group discussion study using your webcam.
This study has two parts:

![Two-part study diagram](lifecycle.png)

#### Part 1: Set up your webcam and take a survey. (~15 mins)
- Asynchronous Individual activity
- Deadline: ${timeString}
- If you finish the first part early, you may work on other tasks or studies until part 2 starts.


#### Part 2: Receive training, discuss an assigned topic, and take a survey. (~30 mins) 
- Syncronized Group activity
- Starts at: ${timeString}
- Earn a competitive bonus for your time
- Once part 2 starts, please give it your full attention for ~35 minutes
      `;

  const text1part = `
## Join a group discussion study using your webcam.
This study has two parts:

![Two-part study diagram](lifecycle.png)

#### Part 1: Set up your webcam and take a survey. (~5 mins)
- Asynchronous Individual activity

#### Part 2: Receive training, discuss an assigned topic, and take a survey. (~40 mins) 
- Syncronized Group activity
- Once part 2 starts, please give it your full attention for ~35 minutes
      `;

  return (
    <div className="grid justify-center">
      <Markdown text={text1part} />
      {!paymentIdFromURL && (
        <div>
          <H3>Please enter your assigned payment ID</H3>
          <P>
            This could be your MTurk ID, Prolific ID, or Wharton Behavior Lab
            ID.
          </P>
          <input
            id="playerID"
            name="playerID"
            type="text"
            autoComplete="off"
            required
            className="appearance-none block w-sm px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-empirica-500 focus:border-empirica-500 sm:text-sm"
            value={playerID}
            onChange={(e) => setPlayerID(e.target.value)}
            data-test="inputPaymentId"
          />
        </div>
      )}
      <br />
      <div className="w-auto">
        <Button handleClick={handleSubmit} testId="joinButton">
          {isEmbedded ? "Join the study in a new tab" : "Join the study"}
        </Button>
      </div>
    </div>
  );
}
