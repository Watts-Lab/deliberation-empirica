// The user will need to grant permission to use the camera
// We can give instructions on how to do this, depending on the browser
import React, { useState, useEffect, useCallback } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";
import { useGetBrowser, useGetOS } from "../../components/hooks";
import { Button } from "../../components/Button";

function useGetMicCameraPermissions() {
  const [permissions, setPermissions] = useState({
    camera: "unknown",
    microphone: "unknown",
  });

  const refreshPermissions = useCallback(async () => {
    try {
      const cameraPerm = await navigator.permissions.query({ name: "camera" });
      const micPerm = await navigator.permissions.query({ name: "microphone" });

      // Initial set
      setPermissions({
        camera: cameraPerm.state,
        microphone: micPerm.state,
      });

      // Attach onchange listeners to auto-update
      cameraPerm.onchange = () => {
        setPermissions((prev) => ({ ...prev, camera: cameraPerm.state }));
        console.log("Camera permission changed to:", cameraPerm.state);
      };
      micPerm.onchange = () => {
        setPermissions((prev) => ({ ...prev, microphone: micPerm.state }));
        console.log("Microphone permission changed to:", micPerm.state);
      };
    } catch (err) {
      setPermissions({
        camera: "unknown",
        microphone: "unknown",
      });
    }
  }, []);

  useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions]);

  return {
    permissions, // { camera: "granted" | "denied" | "prompt" | "unknown", microphone: same }
    refreshPermissions, // Manually re-check if needed
  };
}

export function GetPermissions({ setPermissionsStatus }) {
  const player = usePlayer();
  const browser = useGetBrowser();
  const OS = useGetOS();

  const { permissions, refreshPermissions } = useGetMicCameraPermissions();
  const [attemptedCameraAccess, setAttemptedCameraAccess] = useState(false);
  const [accessError, setAccessError] = useState(null);
  const [diagnosis, setDiagnosis] = useState("starting");

  useEffect(() => {
    // See if the camera and mic are available
    const attemptCameraAccess = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        stream.getTracks().forEach((track) => track.stop()); // Stop the stream immediately
        setPermissionsStatus("complete");
      } catch (error) {
        setAttemptedCameraAccess(true);
        console.error("Error checking camera availability:", error);
        setAccessError(error.name);
      }
    };

    console.log("Attempting camera access...");
    setAccessError(null); // Reset access error before attempting
    attemptCameraAccess();
  }, [attemptedCameraAccess, setPermissionsStatus, permissions]);

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
        <PromptForPermissions browser={browser} OS={OS} />
      )}

      {diagnosis === "denied" && (
        <PromptForDeniedPermissions browser={browser} OS={OS} />
      )}

      {diagnosis === "in_use" && <CameraInUse />}

      {diagnosis === "unknown" && <UnknownError browser={browser} OS={OS} />}

      {diagnosis !== "starting" && diagnosis !== "granted" && (
        <Button
          handleClick={() => {
            console.log("Retrying camera access...");
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

function PromptForPermissions({ browser }) {
  return (
    <div className="mt-40">
      <h2>
        Please enable camera and microphone permissions in your browser
        settings.
      </h2>
      {browser === "Chrome" && (
        <img
          src="instructions/enable_webcam_popup_chrome.jpg"
          alt="Please see your browser documentation for instructions"
        />
      )}
      {browser === "Firefox" && (
        <img
          src="instructions/enable_webcam_popup_firefox.jpg"
          alt="Please see your browser documentation for instructions"
        />
      )}

      {browser === "Safari" && (
        <img
          src="instructions/enable_webcam_popup_safari.jpg"
          alt="Please see your browser documentation for instructions"
        />
      )}
      {browser === "Edge" && (
        <img
          src="instructions/enable_webcam_popup_edge.jpg"
          alt="Please see your browser documentation for instructions"
        />
      )}
      <h3>Then reload the page.</h3>
    </div>
  );
}

function PromptForDeniedPermissions({ browser }) {
  return (
    <div className="mt-40">
      <h2>
        It looks like you have denied permission to use the webcam or
        microphone.
      </h2>
      <p>Please enable them in your browser settings.</p>
      {browser === "Chrome" && (
        <img
          src="instructions/enable_webcam_fallback_chrome.jpg"
          alt="Please see your browser documentation for instructions"
        />
      )}
      {browser === "Firefox" && (
        <img
          src="instructions/enable_webcam_fallback_firefox.jpg"
          alt="Please see your browser documentation for instructions"
        />
      )}
      {browser === "Safari" && (
        <img
          src="instructions/enable_webcam_fallback_safari.jpg"
          alt="Please see your browser documentation for instructions"
        />
      )}
      {browser === "Edge" && (
        <img
          src="instructions/enable_webcam_fallback_edge.jpg"
          alt="Please see your browser documentation for instructions"
        />
      )}
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
