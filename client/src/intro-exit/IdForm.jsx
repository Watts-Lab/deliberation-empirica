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
import { CheckboxGroup } from "../components/CheckboxGroup";

function Checks({ setChecksPassed }) {
  const globals = useGlobal();
  const batchConfig = globals?.get("recruitingBatchConfig");
  const checkVideo = batchConfig?.checkVideo ?? true; // default to true if not specified
  const checkAudio = (batchConfig?.checkAudio ?? true) || checkVideo; // default to true if not specified, force true if checkVideo is true
  const [checks, setChecks] = useState([]);

  useEffect(() => {
    if (!checkVideo && !checkAudio) {
      setChecksPassed(true);
    }
  }, [checkVideo, checkAudio]);

  const handleChange = (selected) => {
    setChecks(selected);

    const checksPass =
      ((!checkVideo || selected.includes("webcam")) &&
        (!checkAudio ||
          (selected.includes("mic") && selected.includes("headphones")))) ??
      false;

    setChecksPassed(checksPass);
  };

  const options = [];
  if (checkVideo) {
    options.push({ key: "webcam", value: "I have a working webcam" });
  }
  if (checkAudio) {
    options.push({ key: "mic", value: "I have a working microphone" });
    options.push({
      key: "headphones",
      value: "I have working headphones or earbuds",
    });
  }

  return (
    <div>
      <h3>Please confirm the following to participate:</h3>

      <CheckboxGroup
        options={options}
        selected={checks}
        onChange={handleChange}
        testId="checks"
      />
    </div>
  );
}

function Instructions() {
  const globals = useGlobal();
  const batchConfig = globals?.get("recruitingBatchConfig");

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

  return <Markdown text={batchConfig?.launchDate ? delayed : immediate} />;
}

function PlayerIdEntry({ onPlayerID }) {
  const urlParams = new URLSearchParams(window.location.search);
  const paramsObj = Object.fromEntries(urlParams?.entries());
  const paymentIdFromURL = paramsObj?.workerId || undefined;

  const [playerID, setPlayerID] = useState(paymentIdFromURL || "");
  const [playerIDValid, setPlayerIDValid] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    onPlayerID(playerID);
  };

  const validateId = (id) => {
    const trimmed = id.trim() || "";
    setPlayerID(trimmed);

    const disallow = /[^a-zA-Z0-9\-_]/g;
    const invalidChars = trimmed.match(disallow);
    if (invalidChars) {
      setErrMsg(
        `Please remove invalid characters: "${invalidChars.join(
          `", "`
        )}", you may use a-z, A-Z, 0-9, "_" and "-".`
      );
      setPlayerIDValid(false);
    } else if (trimmed.length < 2) {
      setErrMsg("Please enter at least 2 characters");
      setPlayerIDValid(false);
    } else if (trimmed.length > 64) {
      setErrMsg("Please enter no more than 64 characters");
      setPlayerIDValid(false);
    } else {
      setErrMsg("");
      setPlayerIDValid(true);
    }
  };

  return (
    <div className="max-w-xl">
      <h3>
        Please enter the identifier assigned by your recruitment platform.
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
          onChange={(e) => validateId(e.target.value)}
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
    console.log("Intro: Descriptive player ID form");
  }, []);

  return (
    <div className="grid justify-center">
      <h1>This is a group discussion study.</h1>
      {!checksPassed && <Checks setChecksPassed={setChecksPassed} />}
      {checksPassed && <Instructions />}
      {checksPassed && <PlayerIdEntry onPlayerID={onPlayerID} />}
    </div>
  );
}
