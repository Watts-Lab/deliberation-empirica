/*
Can be embedded inside an mturk HIT, and if so, opens the same window in a separate tab
so that participants can continue
*/

import React, { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Markdown } from "../components/Markdown";
import { P, H3 } from "../components/TextStyles";

export function DescriptivePlayerIdForm({ onPlayerID }) {
  const isEmbedded = window.location !== window.parent.location; // are we in an iframe?
  const isTest = !!window.Cypress; // are we in the test harness iframe?
  // const isEmbeddedInMturk = window.parent.location.hostname.includes("mturk");

  const urlParams = new URLSearchParams(window.location.search);
  const paramsObj = Object.fromEntries(urlParams?.entries());
  const paymentIdFromURL = paramsObj?.workerId || undefined;
  const [playerID, setPlayerID] = useState(paymentIdFromURL || "");

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

  // Todo: get these from batch
  const launchTime = "1:00 pm"; // adjust for local timezone?
  const step1pay = "$1.00";
  const minBonus = "$1.00";
  const maxBonus = "$2.00";

  const text = `
## Join a group discussion study using your webcam.
This study has two parts:

![Two-part study diagram](lifecycle.png)

#### Part 1: Set up your webcam and take a survey. (~15 mins)
- Individual activity
- Deadline: **${launchTime} today**
- Earn ${step1pay}

#### Part 2: Receive training, discuss an assigned topic, and take a survey. (~30 mins) 
- Group activity
- Starts at: **${launchTime} today**
- Earn a bonus between ${minBonus} and ${maxBonus}

_If you finish the first part early, you may work on other tasks or studies until part 2 starts._
`;

  return (
    <div className="grid justify-center">
      <Markdown text={text} />
      {!paymentIdFromURL && (
        <div>
          <H3>Please enter your assigned payment ID</H3>
          <P>
            This could be your MTurk ID, Prolific ID, or Research Platform ID.
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
