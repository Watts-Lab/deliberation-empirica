import React, { useEffect, useState } from "react";
import {
  useDevices,
  useLocalSessionId,
  DailyVideo,
  useDaily,
} from "@daily-co/daily-react";

import { Select } from "./Select";
import { CheckboxGroup } from "./CheckboxGroup";
import { Button } from "./Button";

import {
  detectBrowser,
  checkMediaPermissions,
  hasUserInteracted,
} from "../utils/browserUtils";

function TestHasInteracted({ onSuccess }) {
  const [hasInteracted, setHasInteracted] = useState("unknown"); // explicitly not false

  useEffect(() => {
    const checkInteraction = async () => {
      const interacted = await hasUserInteracted();
      console.log("User has interacted: ", interacted);
      setHasInteracted(interacted);
      if (interacted) onSuccess();
    };

    if (hasInteracted === "unknown") {
      checkInteraction();
    }
  }, [hasInteracted, onSuccess]);

  const handleClicked = () => {
    console.log("User started webcam setup manually");
    setHasInteracted(true);
    onSuccess();
  };

  return (
    <div>
      {hasInteracted === "unknown" && <p>Checking for user interaction...</p>}
      {hasInteracted === false && (
        <div>
          <h1>Click below to start webcam setup</h1>
          <Button handleClick={handleClicked}>Start</Button>
        </div>
      )}
    </div>
  );
}

function TestWebcamAvailable({ onSuccess }) {
  const [browser, setBrowser] = useState(detectBrowser());
  const [browserPermissions, setBrowserPermissions] = useState("unknown");
  const [cameraAvailable, setCameraAvailable] = useState("unknown");

  console.log("Browser Permissions: ", browserPermissions);
  console.log("Camera Available: ", cameraAvailable);

  useEffect(() => {
    const checkPermissions = async () => {
      const permissions = await checkMediaPermissions();
      console.log("Browser Permissions: ", permissions);
      setBrowserPermissions(permissions);
    };

    if (browserPermissions === "unknown") {
      checkPermissions();
    }
  }, [browserPermissions, onSuccess]);

  useEffect(() => {
    const trialRun = async () => {
      try {
        console.log("Checking camera availability");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        console.log("Camera available");
        stream.getTracks().forEach((track) => track.stop()); // Stop the stream immediately
        console.log("Camera stream stopped");
        setCameraAvailable("available");
        onSuccess();
      } catch (error) {
        console.error(
          "Error checking camera availability, name:",
          error.name,
          "error:",
          error
        );
        setCameraAvailable(error.name);
      }
    };

    if (cameraAvailable === "unknown") {
      trialRun();
    }
  }, [cameraAvailable, onSuccess]);

  const promptInstructions = {
    Chrome: "instructions/enable_webcam_popup_chrome.jpg",
    Firefox: "instructions/enable_webcam_popup_firefox.jpg",
    Safari: "instructions/enable_webcam_popup_safari.jpg",
    Edge: "instructions/enable_webcam_popup_edge.jpg",
  };

  const deniedInstructions = {
    Chrome: "instructions/enable_webcam_fallback_chrome.jpg",
    Firefox: "instructions/enable_webcam_fallback_firefox.jpg",
    Safari: "instructions/enable_webcam_fallback_safari.jpg",
    Edge: "instructions/enable_webcam_fallback_edge.jpg",
  };

  const troubleShootingGuideLink = {
    Chrome: "https://support.google.com/chrome/answer/2693767",
  };

  return (
    <div className="w-2xl">
      {browserPermissions === "unknown" && (
        <p>⏳ Checking browser permissions...</p>
      )}

      {browserPermissions === "prompt" && cameraAvailable === "unknown" && (
        <div>
          <h1>🟨 To enable your webcam:</h1>
          <img
            src={promptInstructions[browser]}
            alt="Please see your browser documentation for instructions"
          />
          <p>You may need to refresh the page.</p>
        </div>
      )}

      {browserPermissions === "denied" && (
        <div>
          <h1>❌ Webcam permission denied</h1>
          <p>Please enable your webcam and microphone:</p>
          <img
            src={deniedInstructions[browser]}
            alt="Please see your browser documentation for instructions"
          />
          <p>You may need to refresh the page.</p>
          <p>If you made changes </p>
          <p>If this doesn&apos;t work, please try another browser</p>
        </div>
      )}

      {browserPermissions === "granted" && cameraAvailable === "unknown" && (
        <p>⏳ Checking camera availability...</p>
      )}

      {(cameraAvailable === "NotAllowedError" ||
        cameraAvailable === "NotFoundError") && (
        <div>
          <h1>
            ❌ Webcam permission denied by your operating system, or no webcam
            found
          </h1>
          <p>
            Please check webcam connections, try another browser, or adjust your
            system settings to allow access.
          </p>
        </div>
      )}

      {browserPermissions === "granted" &&
        (cameraAvailable === "NotReadableError" ||
          cameraAvailable === "TrackStartError") && (
          <div>
            <h1>❌ Webcam in use by another application or browser tab</h1>
            <p>
              Please close any other application that may be using the webcam
              (e.g., zoom).
            </p>
            <p>Then refresh the page.</p>
          </div>
        )}

      {browserPermissions === "granted" &&
        cameraAvailable === "OverConstrainedError" && (
          <div>
            <h1>❌ Webcam not found</h1>
            <p>Could not detect a webcam device.</p>
          </div>
        )}

      {browserPermissions === "granted" &&
        ![
          "available",
          "unknown",
          "NotReadableError",
          "TrackStartError",
          "OverConstrainedError",
          "NotAllowedError",
        ].includes(cameraAvailable) && (
          <div>
            <h1>❌ Unknown error checking webcam availability</h1>
            <p>Please try refreshing the page.</p>
            <p>If this still fails, please try a different browser.</p>
          </div>
        )}

      {cameraAvailable === "available" && <p>✅ Webcam available</p>}
    </div>
  );
}

function CameraSelfDisplay({ onSuccess }) {
  const localSessionId = useLocalSessionId();
  const callObject = useDaily();
  const [videoStarted, setVideoStarted] = useState(false);

  useEffect(() => {
    const startVideo = async () => {
      try {
        console.log("Starting hair-check camera");
        await callObject.startCamera();
        setVideoStarted(true);
        onSuccess();
      } catch (err) {
        console.error("Error starting hair-check camera: ", err);
      }
    };

    if (callObject && !videoStarted) startVideo();
  }, [callObject, onSuccess, setVideoStarted, videoStarted]);

  return (
    <div>
      <DailyVideo sessionId={localSessionId} mirror />
    </div>
  );
}

function CameraAttestations({ onSuccess }) {
  const [optionsChecked, setOptionsChecked] = useState([]);

  useEffect(() => {
    if (optionsChecked.length === 4) onSuccess();
  }, [optionsChecked, onSuccess]);

  return (
    <div>
      <h2> Please confirm that:</h2>

      <CheckboxGroup
        options={[
          {
            key: "stable",
            value: "Your computer is sitting on a desk or table, not your lap",
          },
          {
            key: "background",
            value: "Your background reveals nothing private",
          },
          {
            key: "noOthers",
            value: "No other people will be seen on camera during the study",
          },
          { key: "see", value: "Your head and shoulders are visible" },
        ]}
        selected={optionsChecked}
        onChange={setOptionsChecked}
        testId="setupChecklist"
      />

      <br />
      <p className="text-gray-500 text-sm">
        These conditions are to protect your privacy and the privacy of others
        in your physical space.
      </p>
    </div>
  );
}

function SelectCamera() {
  const devices = useDevices();
  if (devices?.cameras?.length < 1) return "No Cameras Found";

  return (
    <div data-test="CameraSelection">
      <p>Please select which webcam you wish to use:</p>
      <Select
        options={devices?.cameras?.map((camera) => ({
          label: camera.device.label,
          value: camera.device.deviceId,
        }))}
        onChange={(e) => devices.setCamera(e.target.value)}
        testId="cameraSelect"
      />
    </div>
  );
}

function TestNetworkConnectivity({ onSuccess, onFailure }) {
  // Check that we can establish a connection to daily.co turn server (
  // see: https://docs.daily.co/reference/daily-js/instance-methods/test-network-connectivity

  const callObject = useDaily();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    const runTest = async (retries = 1) => {
      if (retries < 1) {
        setStatus("failed");
        onFailure();
        return;
      }

      const videoTrack =
        callObject.participants()?.local?.tracks?.video.persistentTrack;
      const testResultsPromise = await callObject.testNetworkConnectivity(
        videoTrack
      );
      console.log(
        "Network Connectivity test result: ",
        testResultsPromise?.result
      );
      if (testResultsPromise?.result === "passed") {
        setStatus("passed");
        onSuccess();
      } else {
        setStatus("retrying");
        runTest(retries - 1);
      }
    };

    if (callObject && status !== "passed") runTest();
  }, [callObject, onSuccess, onFailure, status]);

  return (
    <div>
      {status === "checking" && <p> ⏳ Checking network connectivity...</p>}
      {status === "passed" && <p> ✅ Network connectivity check passed!</p>}
      {status === "retrying" && (
        <p> 🟨 First attempt failed, retrying network connectivity check...</p>
      )}
      {status === "failed" && <p> ❌ Network connectivity check failed!</p>}
    </div>
  );
}

function TestWebsockets({ onSuccess, onFailure }) {
  // Check that user is allowed to use websockets (they shouldn't be able to use DL if this is false, but good to know)
  // see: https://docs.daily.co/reference/daily-js/instance-methods/test-websocket-connectivity

  const callObject = useDaily();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    const runTest = async (retries = 1) => {
      if (retries < 1) {
        setStatus("failed");
        onFailure();
        return;
      }

      const testResultsPromise = await callObject.testWebsocketConnectivity();
      console.log(
        "Websocket Connectivity test result: ",
        testResultsPromise?.result
      );
      if (
        testResultsPromise?.result === "passed" ||
        testResultsPromise?.result === "warning"
      ) {
        setStatus("passed");
        onSuccess();
      } else {
        setStatus("retrying");
        runTest(retries - 1);
      }
    };

    if (callObject && status !== "passed") runTest();
  }, [callObject, onSuccess, onFailure, status]);

  return (
    <div>
      {status === "checking" && <p> ⏳ Checking websocket connectivity...</p>}
      {status === "passed" && <p> ✅ Websocket connectivity check passed!</p>}
      {status === "retrying" && (
        <p> 🟨 First attempt failed, retrying websocket check... </p>
      )}
      {status === "failed" && <p> ❌ Websocket connectivity check failed!</p>}
    </div>
  );
}

function TestCallQuality({ onSuccess, onFailure }) {
  // Test call quality
  // see: https://docs.daily.co/reference/daily-js/instance-methods/test-call-quality

  const callObject = useDaily();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let callQualityTestTimer;

    const runTest = async (retries = 2, timeout = 5000) => {
      if (retries < 1) {
        setStatus("failed");
        onFailure();
        return;
      }

      callQualityTestTimer = setTimeout(() => {
        console.log("Stopping call quality test");
        callObject.stopTestCallQuality();
      }, 10000); // stop the test after 10 seconds

      const testResultsPromise = await callObject.testCallQuality();
      console.log("Call quality test result: ", testResultsPromise?.result);
      if (
        testResultsPromise?.result === "good" ||
        testResultsPromise?.result === "warning"
      ) {
        setStatus("passed");
        onSuccess();
      } else {
        setStatus("retrying");
        runTest(retries - 1, timeout + 5000);
      }
    };

    if (callObject && status !== "passed") runTest();

    return () => {
      clearTimeout(callQualityTestTimer);
    };
  }, [callObject, onSuccess, onFailure, status]);

  return (
    <div>
      {status === "checking" && (
        <p> ⏳ Checking call quality. Takes 5 Seconds...</p>
      )}
      {status === "passed" && <p> ✅ Call quality check passed!</p>}
      {status === "retrying" && (
        <p> 🟨 First attempt failed, trying a longer quality check...</p>
      )}
      {status === "failed" && (
        <div>
          <p> ❌ Call quality check failed!</p>
          <p> Please try using a different browser.</p>
          <p>
            {" "}
            If you still get this message, and are on wifi, try moving closer to
            the router.
          </p>
        </div>
      )}
    </div>
  );
}

export function CameraCheck({ onSuccess }) {
  const localSessionId = useLocalSessionId();
  const callObject = useDaily();

  const [hasInteracted, setHasInteracted] = useState(undefined);
  const [webcamAvailable, setWebcamAvailable] = useState(undefined);
  const [videoStarted, setVideoStarted] = useState(false);
  const [networkConnection, setNetworkConnection] = useState(undefined);
  const [cameraAttestations, setCameraAttestations] = useState(false);
  const [websockets, setWebsockets] = useState(undefined);
  const [callQuality, setCallQuality] = useState(undefined);

  useEffect(() => {
    if (
      videoStarted &&
      networkConnection &&
      cameraAttestations &&
      websockets &&
      callQuality
    ) {
      onSuccess();
    }
  }, [
    videoStarted,
    networkConnection,
    cameraAttestations,
    websockets,
    callQuality,
    onSuccess,
  ]);

  return (
    <div className="grid max-w-2xl justify-center">
      <h1>📽 Now lets check your webcam...</h1>

      {!hasInteracted && (
        <TestHasInteracted onSuccess={() => setHasInteracted(true)} />
      )}

      {webcamAvailable && (
        <CameraSelfDisplay onSuccess={() => setVideoStarted(true)} />
      )}

      {webcamAvailable && <SelectCamera />}

      {webcamAvailable && (
        <CameraAttestations onSuccess={() => setCameraAttestations(true)} />
      )}

      <br />

      {hasInteracted && (
        <TestWebcamAvailable onSuccess={() => setWebcamAvailable(true)} />
      )}

      {videoStarted && (
        <TestNetworkConnectivity
          onSuccess={() => setNetworkConnection(true)}
          onFailure={() => setNetworkConnection(false)}
        />
      )}
      {networkConnection && (
        <TestWebsockets
          onSuccess={() => setWebsockets(true)}
          onFailure={() => setWebsockets(false)}
        />
      )}
      {websockets && (
        <TestCallQuality
          onSuccess={() => setCallQuality(true)}
          onFailure={() => setCallQuality(false)}
        />
      )}
    </div>
  );
}
