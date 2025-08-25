import React, { useEffect, useState } from "react";

import { usePlayer } from "@empirica/core/player/classic/react";
import { MicCheck } from "./MicCheck";
import { HeadphonesCheck } from "./HeadphonesCheck";
import { LoopbackCheck } from "./LoopbackCheck";
import { Button } from "../../components/Button";

export function SoundCheck({ setSoundStatus }) {
  const player = usePlayer();
  const [micStatus, setMicStatus] = useState("waiting"); // "waiting", "listening", "voice detected"
  const [headphonesStatus, setHeadphonesStatus] = useState("waiting"); // "waiting", "sound identified"
  const [loopbackStatus, setLoopbackStatus] = useState("waiting"); // "waiting", "headphones", "speakers"

  useEffect(() => {
    if (
      micStatus === "voice detected" &&
      headphonesStatus === "sound identified" &&
      (loopbackStatus === "success" || loopbackStatus === "override")
    ) {
      setSoundStatus("complete");
    }
  }, [micStatus, headphonesStatus, loopbackStatus, setSoundStatus]);

  const handleRestart = () => {
    const logEntry = {
      step: "soundCheck",
      event: "restart",
      errors: [],
      debug: {},
      timestamp: new Date().toISOString(),
    };

    player.append("setupSteps", logEntry);
    console.log("Sound setup restarted", logEntry);
    setLoopbackStatus("waiting");
    setHeadphonesStatus("waiting");
    setMicStatus("waiting");
  };

  const handleOverride = () => {
    const logEntry = {
      step: "soundCheck",
      event: "override",
      errors: [],
      debug: {},
      timestamp: new Date().toISOString(),
    };
    player.append("setupSteps", logEntry);
    console.log("Sound setup override", logEntry);
    setLoopbackStatus("override");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">🔊 Sound Setup</h1>

      {headphonesStatus !== "sound identified" && (
        <HeadphonesCheck
          headphonesStatus={headphonesStatus}
          setHeadphonesStatus={setHeadphonesStatus}
        />
      )}

      {headphonesStatus === "sound identified" &&
        micStatus !== "voice detected" && (
          <MicCheck micStatus={micStatus} setMicStatus={setMicStatus} />
        )}

      {micStatus === "voice detected" && (
        <LoopbackCheck
          loopbackStatus={loopbackStatus}
          setLoopbackStatus={setLoopbackStatus}
        />
      )}
      {loopbackStatus === "fail" && (
        <>
          <Button
            className="m-4"
            handleClick={handleRestart}
          >
            Restart Sound Setup
          </Button>
          <Button primary className="m-4" handleClick={handleOverride}>
            Proceed anyway
          </Button>
        </>
      )}
    </div>
  );
}
