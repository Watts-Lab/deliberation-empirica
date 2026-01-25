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

export function CameraCheck({ setWebcamStatus, setErrorMessage }) {
  const [videoStatus, setVideoStatus] = useState("waiting"); // "waiting", "started", "errored"
  const [networkStatus, setNetworkStatus] = useState("waiting"); // "waiting", "connected", "retrying", "errored", "fail"
  const [cameraAttestations, setCameraAttestations] = useState("waiting"); // "waiting", "complete"
  const [websocketStatus, setWebsocketStatus] = useState("waiting"); // "waiting", "available", "retrying", "errored", "fail"
  const [callQualityStatus, setCallQualityStatus] = useState("waiting"); // "waiting", "pass", "retrying", "fail", "errored"
  const [noDevicesTimeout, setNoDevicesTimeout] = useState(false);

  useEffect(() => {
    // As soon as all tests downstream report success we can mark the
    // overall webcam status as "pass" and let the user continue. If any
    // check fails, we fail the entire webcam setup.
    if (
      videoStatus === "started" &&
      networkStatus === "pass" &&
      cameraAttestations === "complete" &&
      websocketStatus === "pass" &&
      callQualityStatus === "pass"
    ) {
      setWebcamStatus("pass");
    } else if (
      noDevicesTimeout ||
      videoStatus === "errored" ||
      networkStatus === "errored" ||
      networkStatus === "fail" ||
      websocketStatus === "errored" ||
      websocketStatus === "fail" ||
      callQualityStatus === "errored" ||
      callQualityStatus === "fail"
    ) {
      if (setErrorMessage) {
        if (noDevicesTimeout) setErrorMessage("No cameras found.");
        else if (videoStatus === "errored")
          setErrorMessage("Failed to start camera video.");
        else if (networkStatus === "fail" || networkStatus === "errored")
          setErrorMessage("Network connection check failed.");
        else if (websocketStatus === "fail" || websocketStatus === "errored")
          setErrorMessage("Websocket connection check failed.");
        else if (callQualityStatus === "fail" || callQualityStatus === "errored")
          setErrorMessage("Call quality check failed.");
        else setErrorMessage("Camera setup failed.");
      }
      setWebcamStatus("fail");
    } else {
      setWebcamStatus("waiting");
    }
  }, [
    videoStatus,
    networkStatus,
    cameraAttestations,
    websocketStatus,
    setWebcamStatus,
    callQualityStatus,
    setErrorMessage,
    noDevicesTimeout,
  ]);

  const devices = useDevices();
  useEffect(() => {
    let timer;
    if (devices?.cameras?.length === 0) {
      timer = setTimeout(() => {
        setNoDevicesTimeout(true);
      }, 4000);
    } else {
      setNoDevicesTimeout(false);
    }
    return () => clearTimeout(timer);
  }, [devices]);

  const player = usePlayer();

  useEffect(() => {
    const storedId = player.get("cameraId");
    const activeId = devices?.currentCam?.device?.deviceId;

    if (!storedId && activeId) {
      // See if we already have come to this screen (for example, if we had to restart the checks
      // after failing the CallQuality test) and picked a camera.
      // If not, and if Daily has already picked a camera (for example, a default system camera),
      // we store that as the player's preferred camera.
      player.set("cameraId", activeId);
      console.log("Default camera detected", {
        id: activeId,
        label: devices?.currentCam?.device?.label,
      });
      return;
    }

    if (storedId && activeId && storedId !== activeId) {
      // If we do have a stored choice and it differs from what Daily is currently using we
      // immediately switch back.
      const storedCamera = devices?.cameras?.find(
        (cam) => cam.device.deviceId === storedId
      );
      console.log("Reapplying preferred camera", {
        storedId,
        storedLabel: storedCamera?.device?.label,
        activeId,
        activeLabel: devices?.currentCam?.device?.label,
      });
      devices
        .setCamera(storedId)
        .catch((err) => console.error("Failed to reapply camera", err));
    }
  }, [devices?.currentCam?.device?.deviceId, devices?.cameras, player]);

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
    <div className="w-full max-w-full overflow-hidden rounded-lg shadow-sm">
      <DailyVideo
        sessionId={localSessionId}
        mirror
        className="w-full h-auto object-cover"
      />
    </div>
  );
}

function SelectCamera({ devices, player }) {
  if (devices?.cameras?.length < 1)
    return "Fetching camera devices. If this takes more than 30 seconds, please refresh the page.";

  const handleChange = (e) => {
    // Record the newly selected camera so analytics has a trail and so the
    // VideoCall step can reuse this exact device.
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

  console.log("current cam:", devices?.currentCam?.device?.deviceId);

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
