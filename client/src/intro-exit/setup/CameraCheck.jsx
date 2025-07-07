// Parent component for all camera checks.
// It handles the camera self-display, camera selection, and all the checks related to the camera

import React, { useEffect, useState } from "react";
import {
  useDevices,
  useLocalSessionId,
  DailyVideo,
  useDaily,
} from "@daily-co/daily-react";

import { usePlayer } from "@empirica/core/player/classic/react";
import { Select } from "../../components/Select";
import { CameraAttestations } from "./CameraAttestations";
import {
  TestCallQuality,
  TestNetworkConnectivity,
  TestWebsockets,
} from "./ConnectionsChecks";

export function CameraCheck({ setWebcamStatus }) {
  const [videoStatus, setVideoStatus] = useState("waiting"); // "waiting", "started", "errored"
  const [networkStatus, setNetworkStatus] = useState("waiting"); // "waiting", "connected", "retrying", "errored", "failed"
  const [cameraAttestations, setCameraAttestations] = useState("waiting"); // "waiting", "complete"
  const [websocketStatus, setWebsocketStatus] = useState("waiting"); // "waiting", "available", "retrying", "errored", "failed"
  const [callQualityStatus, setCallQualityStatus] = useState("waiting"); // "waiting", "acceptable", "retrying", "unacceptable", "errored"

  useEffect(() => {
    if (
      videoStatus === "started" &&
      networkStatus === "connected" &&
      cameraAttestations === "complete" &&
      websocketStatus === "available" &&
      callQualityStatus === "acceptable"
    ) {
      setWebcamStatus("complete");
    }
  }, [
    videoStatus,
    networkStatus,
    cameraAttestations,
    websocketStatus,
    setWebcamStatus,
    callQualityStatus,
  ]);

  return (
    <div className="grid max-w-2xl justify-center">
      <h1>📽 Webcam Setup</h1>

      <CameraSelfDisplay
        videoStatus={videoStatus}
        setVideoStatus={setVideoStatus}
      />

      <SelectCamera />

      <CameraAttestations
        cameraAttestations={cameraAttestations}
        setCameraAttestations={setCameraAttestations}
      />

      <br />

      {videoStatus === "started" && (
        <TestNetworkConnectivity
          networkStatus={networkStatus}
          setNetworkStatus={setNetworkStatus}
        />
      )}
      {videoStatus === "started" && (
        <TestWebsockets
          websocketStatus={websocketStatus}
          setWebsocketStatus={setWebsocketStatus}
        />
      )}
      {videoStatus === "started" && (
        <TestCallQuality
          callQualityStatus={callQualityStatus}
          setCallQualityStatus={setCallQualityStatus}
        />
      )}
    </div>
  );
}

function CameraSelfDisplay({ videoStatus, setVideoStatus }) {
  const player = usePlayer();
  const localSessionId = useLocalSessionId();
  const callObject = useDaily();

  useEffect(() => {
    const startVideo = async () => {
      const logEntry = {
        step: "cameraCheck",
        event: "startVideo",
        errors: [],
        debug: {},
        timestamp: new Date().toISOString(),
      };

      try {
        await callObject.startCamera();
        logEntry.value = "started";
        setVideoStatus("started");
      } catch (err) {
        logEntry.errors.push(err.message);
        setVideoStatus("errored");
      } finally {
        player.append("setupSteps", logEntry);
        console.log("Video start", logEntry);
      }
    };

    if (callObject && videoStatus === "waiting") startVideo();
  }, [callObject, setVideoStatus, videoStatus, player]);

  return (
    <div>
      <DailyVideo sessionId={localSessionId} mirror />
    </div>
  );
}

function SelectCamera() {
  const devices = useDevices();
  const player = usePlayer();

  if (devices?.cameras?.length < 1) return "No Cameras Found";

  const handleChange = (e) => {
    const logEntry = {
      step: "cameraCheck",
      event: "cameraSelected",
      value: e.target.value,
      errors: [],
      debug: {},
      timestamp: new Date().toISOString(),
    };

    try {
      devices.setCamera(e.target.value);
    } catch (err) {
      logEntry.errors.push(err.message);
    }

    player.append("setupSteps", logEntry);
    console.log("Camera selected", logEntry);
  };

  return (
    <div data-test="CameraSelection">
      <p>Please select which webcam you wish to use:</p>
      <Select
        options={devices?.cameras?.map((camera) => ({
          label: camera.device.label,
          value: camera.device.deviceId,
        }))}
        onChange={handleChange}
        testId="cameraSelect"
      />
    </div>
  );
}
