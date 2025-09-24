import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  useDevices,
  useLocalSessionId,
  useAudioLevelObserver,
} from "@daily-co/daily-react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Select } from "../../components/Select";

const VOLUME_SUCCESS_THRESHOLD = 20;

export function MicCheck({ setMicStatus }) {
  return (
    <div className="mt-8">
      <h2>🎤 Please speak clearly into your microphone</h2>
      <p>
        {" "}
        Speak loudly enough for the volume indicator below to go above the red
        line.
      </p>
      <AudioLevelIndicator setMicStatus={setMicStatus} />
      <SelectMicrophone />
    </div>
  );
}

function AudioLevelIndicator({ setMicStatus }) {
  const player = usePlayer();
  const localSessionId = useLocalSessionId();
  const audioSuccessRef = useRef(false);
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    setMicStatus("started");
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
          setMicStatus("pass");
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

  useEffect(() => {
    const storedId = player.get("micId");
    const activeId = devices?.currentMic?.device?.deviceId;

    if (!storedId && activeId) {
      player.set("micId", activeId);
      console.log("Default microphone detected", {
        id: activeId,
        label: devices?.currentMic?.device?.label,
      });
      return;
    }

    if (storedId && activeId && storedId !== activeId) {
      const storedMic = devices?.microphones?.find(
        (mic) => mic.device.deviceId === storedId
      );
      console.log("Reapplying preferred microphone", {
        storedId,
        storedLabel: storedMic?.device?.label,
        activeId,
        activeLabel: devices?.currentMic?.device?.label,
      });
      devices
        .setMicrophone(storedId)
        .catch((err) => console.error("Failed to reapply microphone", err));
    }
  }, [
    devices?.currentMic?.device?.deviceId,
    devices?.microphones,
    player,
  ]);

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
      player.set("micId", e.target.value);
      logEntry.value = e.target.value;
      const selectedMic = devices.microphones.find(
        (mic) => mic.device.deviceId === e.target.value
      );
      logEntry.debug.selectedLabel = selectedMic?.device?.label;
      console.log("Microphone selected", {
        id: e.target.value,
        label: selectedMic?.device?.label,
      });
    } catch (error) {
      logEntry.errors.push(error.message);
    } finally {
      player.append("setupSteps", logEntry);
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
        value={devices?.currentMic?.device?.deviceId}
        testId="microphoneSelect"
      />
    </div>
  );
}
