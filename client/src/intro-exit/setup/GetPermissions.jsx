// The user will need to grant permission to use the camera
// We can give instructions on how to do this, depending on the browser
import React, { useState, useEffect, useCallback } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";
import { useGetBrowser, useGetOS } from "../../components/hooks";
import { Button } from "../../components/Button";
import {
  useGetMicCameraPermissions,
  PermissionDeniedGuidance,
} from "../../components/PermissionRecovery";

export function GetPermissions({
  setPermissionsStatus,
  permissionsMode = "both",
}) {
  const player = usePlayer();
  const browser = useGetBrowser();
  const OS = useGetOS();

  const { permissions, refreshPermissions } = useGetMicCameraPermissions();
  const [attemptedCameraAccess, setAttemptedCameraAccess] = useState(false);
  const [accessError, setAccessError] = useState(null);
  const [diagnosis, setDiagnosis] = useState("starting");
  const needsVideo = permissionsMode !== "audio";
  const needsAudio = permissionsMode !== "video";

  useEffect(() => {
    // See if the camera and mic are available
    const attemptCameraAccess = async () => {
      try {
        const constraints = {
          video: needsVideo,
          audio: needsAudio,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        stream.getTracks().forEach((track) => track.stop()); // Stop the stream immediately
        setPermissionsStatus("pass");
      } catch (error) {
        setAttemptedCameraAccess(true);
        console.error("Error checking camera availability:", error);
        setAccessError(error.name);
      }
    };

    console.log("Attempting media access...", { needsVideo, needsAudio });
    setAccessError(null); // Reset access error before attempting
    attemptCameraAccess();
  }, [
    attemptedCameraAccess,
    setPermissionsStatus,
    permissions,
    needsVideo,
    needsAudio,
  ]);

  useEffect(() => {
    // Work out what the issue is
    if (
      permissions.camera === "unknown" ||
      permissions.microphone === "unknown"
    ) {
      setDiagnosis("starting");
    } else if (
      permissions.camera === "prompt" ||
      permissions.microphone === "prompt"
    ) {
      setDiagnosis("prompt");
    } else if (
      permissions.camera === "denied" ||
      permissions.microphone === "denied"
    ) {
      setDiagnosis("denied");
    } else if (
      OS === "Windows" &&
      (accessError === "NotReadableError" || accessError === "TrackStartError")
    ) {
      setDiagnosis("in_use");
    } else if (accessError === null) {
      setDiagnosis("granted");
    } else {
      setDiagnosis("unknown");
    }
  }, [permissions, accessError, OS]);

  useEffect(() => {
    // Log the unknown state for debugging
    const newStatus = {
      step: "getPermissions",
      event: "diagnosis",
      value: diagnosis,
      errors: [accessError],
      debug: {
        permissions,
        accessError,
        OS,
        browser,
      },
      timestamp: new Date().toISOString(),
    };
    player.append("setupSteps", newStatus);
    console.log("Permissions Diagnosis:", newStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnosis]); // intentionally leaving out accessError, permissions, OS, browser to avoid triggering too soon

  return (
    <div className="flex flex-col justify-center items-center h-screen">
      {diagnosis === "starting" && <Loading />}
      {diagnosis === "granted" && <Loading />}

      {diagnosis === "prompt" && (
        <PromptForPermissions
          browser={browser}
          OS={OS}
          needsVideo={needsVideo}
          needsAudio={needsAudio}
        />
      )}

      {diagnosis === "denied" && (
        <PermissionDeniedGuidance
          needsVideo={needsVideo}
          needsAudio={needsAudio}
        />
      )}

      {diagnosis === "in_use" && <CameraInUse />}

      {diagnosis === "unknown" && <UnknownError browser={browser} OS={OS} />}

      {diagnosis !== "starting" && diagnosis !== "granted" && (
        <Button
          handleClick={() => {
            console.log("Retrying permissions access...");
            setAttemptedCameraAccess(false);
            refreshPermissions();
          }}
        >
          Retry
        </Button>
      )}
    </div>
  );
}

function PromptForPermissions({ browser, needsVideo, needsAudio }) {
  const summary =
    needsVideo && needsAudio
      ? "camera and microphone"
      : needsVideo
      ? "camera"
      : "microphone";
  return (
    <div className="mt-40">
      <h2>Please enable {summary} permissions in your browser settings.</h2>
      {needsVideo && browser === "Chrome" && (
        <img
          src="instructions/enable_webcam_popup_chrome.jpg"
          alt="Please see your browser documentation for instructions"
        />
      )}
      {needsVideo && browser === "Firefox" && (
        <img
          src="instructions/enable_webcam_popup_firefox.jpg"
          alt="Please see your browser documentation for instructions"
        />
      )}

      {needsVideo && browser === "Safari" && (
        <img
          src="instructions/enable_webcam_popup_safari.jpg"
          alt="Please see your browser documentation for instructions"
        />
      )}
      {needsVideo && browser === "Edge" && (
        <img
          src="instructions/enable_webcam_popup_edge.jpg"
          alt="Please see your browser documentation for instructions"
        />
      )}
      <h3>Then reload the page.</h3>
    </div>
  );
}


function CameraInUse() {
  return (
    <div className="mt-40">
      <h1>❌ Webcam may be in use by another application or browser tab</h1>
      <p>
        Please close any other application that may be using the webcam (e.g.,
        Zoom).
      </p>
      <p>Then refresh the page.</p>
    </div>
  );
}

// function BrowserSeesNoCamera() {
//   return (
//     <div className="mt-40">
//       <h1>❌ No webcam available to browser</h1>
//       <p>Please check webcam connections, or try another browser.</p>
//       <p>
//         This could imply that your operating system is blocking access to the
//         webcam.
//       </p>
//     </div>
//   );
// }

function UnknownError({ browser, OS }) {
  return (
    <div className="mt-40">
      <h1>❌ Unknown error checking webcam availability</h1>

      {browser === "Firefox" && OS === "MacOS" && (
        <div className="mt-4">
          <p>
            This may mean that macOS is blocking Firefox from using the camera.
          </p>
          <p>
            👉 Please go to: <strong>System Settings</strong> &gt;{" "}
            <strong>Privacy & Security</strong> &gt; <strong>Camera</strong>
          </p>
          <p>
            👉 and ensure that <strong>Firefox</strong> is checked.
          </p>
          <p>
            👉 Then go to <strong>System Settings</strong> &gt;{" "}
            <strong>Privacy & Security</strong> &gt; <strong>Microphone</strong>
          </p>
          <p>
            👉 and ensure that <strong>Firefox</strong> is checked.
          </p>
          <p>
            You will need to restart your browser, but you will keep your
            progress.
          </p>
        </div>
      )}

      {browser === "Chrome" && OS === "MacOS" && (
        <div className="mt-4">
          <p>
            This may mean that macOS is blocking Chrome from using the camera.
          </p>
          <p>
            👉 Please go to: <strong>System Settings</strong> &gt;{" "}
            <strong>Privacy & Security</strong> &gt; <strong>Camera</strong>
          </p>
          <p>
            👉 and ensure that <strong>Chrome</strong> is checked.
          </p>
          <p>
            👉 Then go to <strong>System Settings</strong> &gt;{" "}
            <strong>Privacy & Security</strong> &gt; <strong>Microphone</strong>
          </p>
          <p>
            👉 and ensure that <strong>Chrome</strong> is checked.
          </p>
          <p>
            You will need to restart your browser, but you will keep your
            progress.
          </p>
        </div>
      )}

      {browser === "Edge" && OS === "MacOS" && (
        <div className="mt-4">
          <p>
            This may mean that macOS is blocking Edge from using the camera.
          </p>
          <p>
            👉 Please go to: <strong>System Settings</strong> &gt;{" "}
            <strong>Privacy & Security</strong> &gt; <strong>Camera</strong>
          </p>
          <p>
            👉 and ensure that <strong>Edge</strong> is checked.
          </p>
          <p>
            👉 Then go to <strong>System Settings</strong> &gt;{" "}
            <strong>Privacy & Security</strong> &gt; <strong>Microphone</strong>
          </p>
          <p>
            👉 and ensure that <strong>Edge</strong> is checked.
          </p>
          <p>
            You will need to restart your browser, but you will keep your
            progress.
          </p>
        </div>
      )}

      <div className="mt-4">
        <p>👉 Check that no other program is using the webcam (e.g. zoom).</p>
        <p>👉 Then try refreshing the page.</p>
        <p>
          If this still fails, close this window and try a different browser.
        </p>
      </div>
    </div>
  );
}
