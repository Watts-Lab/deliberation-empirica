import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  useDevices,
  useLocalSessionId,
  useAudioLevelObserver,
} from "@daily-co/daily-react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Select } from "../../components/Select";
import { Button } from "../../components/Button";

const VOLUME_SUCCESS_THRESHOLD = 20;

export function MicCheck({ setMicStatus }) {
  const [selectionMode, setSelectionMode] = useState("select"); // "select" | "testing"
  const [activeMic, setActiveMic] = useState(null);
  const [selectionIteration, setSelectionIteration] = useState(0);

  useEffect(() => {
    if (selectionMode === "select") {
      setMicStatus("waiting");
    }
  }, [selectionMode, setMicStatus]);

  const handleMicSelected = (mic) => {
    setActiveMic(mic);
    setSelectionMode("testing");
  };

  const handleChangeMic = () => {
    setSelectionMode("select");
    setActiveMic(null);
    setSelectionIteration((v) => v + 1);
  };

  const heading =
    selectionMode === "testing"
      ? "🎤 Please speak clearly into your microphone"
      : "🎤 Set up your microphone";

  return (
    <div className="mt-8">
      <h2>{heading}</h2>
      {selectionMode === "testing" && activeMic ? (
        <>
          <p>
            Speak loudly enough for the volume indicator below to go above the
            red line. You are testing:{" "}
            <span className="font-semibold">{activeMic.label}</span>
          </p>
          <div className="flex justify-end mt-2">
            <Button handleClick={handleChangeMic} primary={false}>
              Try a different mic
            </Button>
          </div>
          <AudioLevelIndicator setMicStatus={setMicStatus} />
        </>
      ) : (
        <>
          <p>
            {" "}
            Choose the microphone you plan to use. We&apos;ll only start the test
            once you confirm a device.
          </p>
          <SelectMicrophone
            key={selectionIteration}
            onSelected={handleMicSelected}
          />
        </>
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

function SelectMicrophone({ onSelected }) {
  const devices = useDevices();
  const player = usePlayer();

  if (devices?.microphones?.length < 1) return "No Microphones Found";

  const handleChange = (e) => {
    const selectedId = e.target.value;
    if (!selectedId) return;

    const logEntry = {
      step: "micCheck",
      event: "selectMicrophone",
      errors: [],
      debug: {},
      timestamp: new Date().toISOString(),
    };
    try {
      devices.setMicrophone(selectedId);
      player.set("micId", selectedId);
      logEntry.value = selectedId;
      const selectedMic = devices.microphones.find(
        (mic) => mic.device.deviceId === selectedId
      );
      logEntry.debug.selectedLabel = selectedMic?.device?.label;
      console.log("Microphone selected", {
        id: selectedId,
        label: selectedMic?.device?.label,
      });
      onSelected({
        id: selectedId,
        label: selectedMic?.device?.label || "Unknown microphone",
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
        options={[
          {
            label: "Select a microphone...",
            value: "",
            disabled: true,
            hidden: true,
          },
          ...(devices?.microphones?.map((mic) => ({
            label: mic.device.label,
            value: mic.device.deviceId,
          })) ?? []),
        ]}
        onChange={handleChange}
        value=""
        testId="microphoneSelect"
      />
    </div>
  );
}
