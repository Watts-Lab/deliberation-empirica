import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  useDevices,
  useLocalSessionId,
  useAudioLevelObserver,
} from "@daily-co/daily-react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Select } from "../../components/Select";

const VOLUME_SUCCESS_THRESHOLD = 20;

export function MicCheck({ setMicStatus, micStatus }) {
  return (
    <div className="mt-8">
      <h2>🎤 Please speak clearly into your microphone</h2>
      <p>
        {" "}
        Speak loudly enough for the volume indicator below to go above the red
        line.
      </p>
      <AudioLevelIndicator setMicStatus={setMicStatus} micStatus={micStatus} />
      <SelectMicrophone />
      {micStatus === "voice detected" && (
        <p className="mt-5">✅ Mic Check Successful!</p>
      )}
    </div>
  );
}

function AudioLevelIndicator({ setMicStatus }) {
  const player = usePlayer();
  const localSessionId = useLocalSessionId();
  const audioSuccessRef = useRef(false);
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    setMicStatus("listening");
  }, [setMicStatus]);

  useAudioLevelObserver(
    // see: https://docs.daily.co/reference/daily-react/use-audio-level-observer
    localSessionId,
    useCallback(
      (rawVolume) => {
        // this volume number will be between 0 and 1
        setVolume(rawVolume * 100);
        if (
          !audioSuccessRef.current &&
          rawVolume * 100 > VOLUME_SUCCESS_THRESHOLD
        ) {
          audioSuccessRef.current = true;
          const logEntry = {
            step: "micCheck",
            event: "micAudioLevelAboveThreshold",
            value: rawVolume * 100,
            errors: [],
            debug: {},
            timestamp: new Date().toISOString(),
          };
          player.append("setupSteps", logEntry);
          console.log("Audio level above threshold", logEntry);
          setMicStatus("voice detected");
        }
      },
      [setMicStatus, player]
    )
  );

  return (
    <div>
      <h3>Audio level:</h3>
      <div className="relative w-full h-6 bg-gray-300 rounded overflow-hidden shadow-inner border">
        <div
          data-test="audioLevelIndicator"
          className="h-full transition-all duration-100 ease-out"
          style={{
            width: `${volume}%`,
            background: "linear-gradient(to right, #4ade80, #22d3ee)",
          }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-600"
          style={{ left: `${VOLUME_SUCCESS_THRESHOLD}%` }}
        />
      </div>
    </div>
  );
}

function SelectMicrophone() {
  const devices = useDevices();
  const player = usePlayer();
  if (devices?.microphones?.length < 1) return "No Microphones Found";

  const handleChange = (e) => {
    const logEntry = {
      step: "micCheck",
      event: "selectMicrophone",
      errors: [],
      debug: {},
      timestamp: new Date().toISOString(),
    };
    try {
      devices.setMicrophone(e.target.value);
      logEntry.value = e.target.value;
    } catch (error) {
      logEntry.errors.push(error.message);
    } finally {
      player.append("setupSteps", logEntry);
      console.log("Microphone selected", logEntry);
    }
  };

  return (
    <div data-test="MicrophoneSelection">
      <p>Please select which microphone you wish to use:</p>
      <Select
        options={devices?.microphones?.map((mic) => ({
          label: mic.device.label,
          value: mic.device.deviceId,
        }))}
        onChange={handleChange}
        testId="microphoneSelect"
      />
    </div>
  );
}
