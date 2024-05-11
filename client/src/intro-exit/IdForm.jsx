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
import { useText } from "../components/utils";
import { PreIdChecks } from "./PreIdChecks";

function Instructions() {
  const globals = useGlobal();
  const batchConfig = globals?.get("recruitingBatchConfig");

  const timeString =
    batchConfig && batchConfig.launchDate !== "immediate"
      ? new Date(batchConfig.launchDate).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "numeric",
          hour12: true,
          timeZoneName: "short",
        })
      : "ASAP";

  const immediate = `
## This study has two parts:
### ✅ Part 1
- On your own 👤
- Starts now 🚦
- Takes 5-10 minutes

### ✅ Part 2
- In a group 👥
- Starts when enough people have completed Part 1
- Takes 15-45 minutes
`;

  const delayed = `
## This study has two parts:
### ✅ Part 1
- On your own 👤
- Starts now 🚦
- Deadline: ${timeString}
- Remember to leave your browser window open until Part 2 starts

### ✅ Part 2
- In a group 👥
- Starts at ${timeString} ⏰
- Takes 15-45 minutes
`;

  return (
    <Markdown
      text={batchConfig?.launchDate !== "immediate" ? delayed : immediate}
    />
  );
}

const validateId = (id) => {
  const validatedId = id ? id.trim() : "";
  const errors = [];

  const disallow = /[^a-zA-Z0-9\-_]/g;
  const invalidChars = validatedId.match(disallow);
  if (invalidChars) {
    errors.push(
      `Please remove invalid characters: "${invalidChars.join(
        `", "`
      )}", you may use a-z, A-Z, 0-9, "_" and "-".`
    );
  } else if (validatedId.length < 2) {
    errors.push("Please enter at least 2 characters");
  } else if (validatedId.length > 64) {
    errors.push("Please enter no more than 64 characters");
  }
  return { validatedId, errors };
};

function PlayerIdEntry({ onPlayerID }) {
  const globals = useGlobal();
  const [playerIDValid, setPlayerIDValid] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const urlParams = new URLSearchParams(window.location.search);
  const paramsObj = Object.fromEntries(urlParams?.entries());
  const [playerID, setPlayerID] = useState(paramsObj?.workerId || "");

  const batchConfig = globals?.get("recruitingBatchConfig");
  const customIdInstructionsPath =
    batchConfig && batchConfig.customIdInstructions !== "none"
      ? batchConfig?.customIdInstructions
      : null;

  const customIdInstructions = useText({ file: customIdInstructionsPath });

  const handleSubmit = (event) => {
    event.preventDefault();
    onPlayerID(playerID);
  };

  const handleChange = (e) => {
    const { validatedId, errors } = validateId(e.target.value);
    setPlayerID(validatedId);
    setErrMsg(errors.join(" "));
    setPlayerIDValid(errors.length === 0);
  };

  return (
    <div className="max-w-xl">
      <h3>
        {customIdInstructions ? (
          <Markdown text={customIdInstructions} />
        ) : (
          "Please enter the identifier assigned by your recruitment platform."
        )}
      </h3>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          autoComplete="off"
          id="playerID"
          name="playerID"
          required
          className="appearance-none block w-sm px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-empirica-500 focus:border-empirica-500 sm:text-sm"
          value={playerID}
          onChange={handleChange}
          data-test="inputPaymentId"
        />
        <p className="text-red-600 text-sm italic">{errMsg}</p>

        <div className="w-auto mt-10">
          <Button
            handleClick={handleSubmit}
            disabled={!playerIDValid}
            testId="joinButton"
          >
            Join the study
          </Button>
        </div>
      </form>
    </div>
  );
}

export function IdForm({ onPlayerID }) {
  const [checksPassed, setChecksPassed] = useState(false);

  useEffect(() => {
    console.log("Intro: Player ID form");
  }, []);

  return (
    <div className="grid justify-center">
      <h1>This is a group discussion study.</h1>
      {!checksPassed && <PreIdChecks setChecksPassed={setChecksPassed} />}
      {checksPassed && <Instructions />}
      {checksPassed && <PlayerIdEntry onPlayerID={onPlayerID} />}
    </div>
  );
}
