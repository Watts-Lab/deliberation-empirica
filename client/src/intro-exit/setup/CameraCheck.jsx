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
  const [networkStatus, setNetworkStatus] = useState("waiting"); // "waiting", "connected", "retrying", "errored", "fail"
  const [cameraAttestations, setCameraAttestations] = useState("waiting"); // "waiting", "complete"
  const [websocketStatus, setWebsocketStatus] = useState("waiting"); // "waiting", "available", "retrying", "errored", "fail"
  const [callQualityStatus, setCallQualityStatus] = useState("waiting"); // "waiting", "pass", "retrying", "fail", "errored"

  useEffect(() => {
    if (
      videoStatus === "started" &&
      networkStatus === "pass" &&
      cameraAttestations === "complete" &&
      websocketStatus === "pass" &&
      callQualityStatus === "pass"
    ) {
      setWebcamStatus("pass");
    } else if (
      videoStatus === "errored" ||
      networkStatus === "errored" ||
      networkStatus === "fail" ||
      websocketStatus === "errored" ||
      websocketStatus === "fail" ||
      callQualityStatus === "errored" ||
      callQualityStatus === "fail"
    ) {
      setWebcamStatus("fail");
    }
  }, [
    videoStatus,
    networkStatus,
    cameraAttestations,
    websocketStatus,
    setWebcamStatus,
    callQualityStatus,
  ]);

  const devices = useDevices();
  const player = usePlayer();

  useEffect(() => {
    const currentId = player.get("cameraId");
    const activeId = devices?.currentCam?.device?.deviceId;
    if (!currentId && activeId) {
      player.set("cameraId", activeId);
      console.log("Default camera detected", {
        id: activeId,
        label: devices.currentCam?.device?.label,
      });
    }
  }, [devices?.currentCam?.device?.deviceId, player, devices]);

  return (
    <div className="grid max-w-2xl justify-center">
      <h1>📽 Webcam Setup</h1>

      <CameraSelfDisplay
        videoStatus={videoStatus}
        setVideoStatus={setVideoStatus}
      />

      <SelectCamera devices={devices} player={player} />

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

  // Start the camera as soon as the call object is ready
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

function SelectCamera({ devices, player }) {
  if (devices?.cameras?.length < 1) return "Fetching camera devices...";

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
      player.set("cameraId", e.target.value);
      const selectedDevice = devices.cameras.find(
        (cam) => cam.device.deviceId === e.target.value
      );
      logEntry.debug.selectedLabel = selectedDevice?.device?.label;
      console.log("Camera selected", {
        id: e.target.value,
        label: selectedDevice?.device?.label,
      });
    } catch (err) {
      logEntry.errors.push(err.message);
    }

    player.append("setupSteps", logEntry);
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
        value={devices?.currentCam?.device?.deviceId}
        testId="cameraSelect"
      />
    </div>
  );
}
