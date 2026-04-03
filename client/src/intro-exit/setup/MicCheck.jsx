import React, { useState, useRef, useCallback, useEffect } from "react";
import * as Sentry from "@sentry/react";
import {
  useDevices,
  useDaily,
  useLocalSessionId,
  useAudioLevelObserver,
} from "@daily-co/daily-react";
import { usePlayer } from "@empirica/core/player/classic/react";
// eslint-disable-next-line import/no-extraneous-dependencies
import { Button } from "@deliberation-lab/score/components";
import { Select } from "../../components/Select";

const VOLUME_SUCCESS_THRESHOLD = 20;

export function MicCheck({ setMicStatus, setErrorMessage }) {
  const [selectionMode, setSelectionMode] = useState("select"); // "select" | "testing"
  const [activeMic, setActiveMic] = useState(null);
  const [selectionIteration, setSelectionIteration] = useState(0);
  const [noDevicesTimeout, setNoDevicesTimeout] = useState(false);

  useEffect(() => {
    if (selectionMode === "select") {
      setMicStatus("waiting");
    }
  }, [selectionMode, setMicStatus]);

  useEffect(() => {
    if (noDevicesTimeout) {
      if (setErrorMessage) setErrorMessage("No microphones found.");
      setMicStatus("fail");
    }
    // "started" is set by AudioLevelIndicator when it mounts (after mic selection),
    // not here — otherwise the stall timer would start before the user selects a mic.
  }, [setMicStatus, noDevicesTimeout, setErrorMessage]);

  const devices = useDevices();
  useEffect(() => {
    let timer;
    if (devices?.microphones?.length === 0) {
      timer = setTimeout(() => {
        setNoDevicesTimeout(true);
      }, 4000);
    } else {
      setNoDevicesTimeout(false);
    }
    return () => clearTimeout(timer);
  }, [devices]);

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
            <Button onClick={handleChangeMic} primary={false}>
              Try a different mic
            </Button>
          </div>
          <AudioLevelIndicator setMicStatus={setMicStatus} />
        </>
      ) : (
        <>
          <p>
            {" "}
            Choose the microphone you plan to use. We&apos;ll only start the
            test once you confirm a device.
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
  const callObject = useDaily();
  const localSessionId = useLocalSessionId();
  const audioSuccessRef = useRef(false);
  const callObjectRef = useRef(callObject);
  callObjectRef.current = callObject;
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    setMicStatus("started");
  }, [setMicStatus]);

  const devices = useDevices();
  useEffect(() => {
    if (devices?.microphones?.length === 0) {
      setMicStatus("fail");
    }
  }, [devices, setMicStatus]);

  // useCallback must be called unconditionally (React Rules of Hooks),
  // so define the callback first, then pass it to the observer inside try/catch.
  const onAudioLevel = useCallback(
    (rawVolume) => {
      // this volume number will be between 0 and 1
      setVolume(rawVolume * 100);
      if (
        !audioSuccessRef.current &&
        rawVolume * 100 > VOLUME_SUCCESS_THRESHOLD
      ) {
        audioSuccessRef.current = true;

        // Capture audio track settings for postprocessing analysis
        let audioTrackSettings = null;
        try {
          const co = callObjectRef.current;
          const localAudio = co?.participants()?.local?.tracks?.audio?.track;
          if (localAudio && typeof localAudio.getSettings === "function") {
            audioTrackSettings = localAudio.getSettings();
          }
        } catch (err) {
          console.warn("[MicCheck] Failed to read audio track settings:", err);
        }

        const logEntry = {
          step: "micCheck",
          event: "micAudioLevelAboveThreshold",
          value: rawVolume * 100,
          errors: [],
          debug: { audioTrackSettings },
          timestamp: new Date().toISOString(),
        };
        player.append("setupSteps", logEntry);
        console.log("Audio level above threshold", logEntry);

        if (audioTrackSettings) {
          player.set("audioTrackSettings", audioTrackSettings);
          Sentry.addBreadcrumb({
            category: "equipment-check",
            message: "Mic check passed",
            data: audioTrackSettings,
            level: "info",
          });
        }

        setMicStatus("pass");
      }
    },
    [setMicStatus, player]
  );

  try {
    // see: https://docs.daily.co/reference/daily-react/use-audio-level-observer
    useAudioLevelObserver(localSessionId, onAudioLevel);
  } catch (err) {
    if (err?.name === "AbortError") {
      console.warn("Audio level observer aborted before start", err);
    } else {
      throw err;
    }
  }

  return (
    <div>
      <h3>Audio level:</h3>
      <div className="relative w-full h-6 bg-gray-300 rounded overflow-hidden shadow-inner border">
        <div
          data-testid="audioLevelIndicator"
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

  if (!devices || devices?.microphones === undefined)
    return <p>Loading microphones…</p>;

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
      const selectedMic = devices.microphones.find(
        (mic) => mic.device.deviceId === selectedId
      );
      const selectedLabel = selectedMic?.device?.label || null;
      // Store both ID and label - label helps match devices when Safari rotates IDs
      player.set("micId", selectedId);
      player.set("micLabel", selectedLabel);
      logEntry.value = selectedId;
      logEntry.debug.selectedLabel = selectedLabel;
      console.log("Microphone selected", {
        id: selectedId,
        label: selectedLabel,
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
    <div data-testid="MicrophoneSelection">
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
