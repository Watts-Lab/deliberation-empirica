// Prompt user to enable webcam and microphone with browser-specific instructions
import React, { useEffect, useState } from "react";
import {
  detectBrowser,
  checkMediaPermissions,
  hasUserInteracted,
} from "../utils/browserUtils";
import { Button } from "./Button";
import { use } from "react";

export function WebcamPermissions({ onSuccess }) {
  const [permissions, setPermissions] = useState({
    camera: "unknown",
    microphone: "unknown",
  });
  const [browser, setBrowser] = useState(detectBrowser());
  const [hasInteracted, setHasInteracted] = useState("unknown"); // explicitly not false
  const [permissionsGrantedBy, setPermissionsGranted] = useState("unknown");

  useEffect(() => {
    const checkInteraction = async () => {
      const interacted = await hasUserInteracted();
      setHasInteracted(interacted); // Update state once check completes
    };

    checkInteraction();
  }, []); // Runs once when component mounts

  useEffect(() => {


  // useEffect(() => {
  //   let cameraStream;
  //   const startCamera = async () => {
  //     try {
  //       cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
  //       onSuccess(); // if this works, we're good to go
  //     } catch (error) {
  //       switch (error.name) {
  //         case "NotAllowedError":
  //         case "PermissionDeniedError":
  //           console.error("Camera access denied");
  //           break;
  //         case "NotReadableError":
  //         case "TrackStartError":
  //           console.error("Camera in use by another application");
  //           break;
  //         default:
  //           console.error("Error starting camera:", error);
  //           break;
  //       }
  //     } finally {
  //       if (cameraStream) { // Clean up the stream if it was started
  //         cameraStream.getTracks().forEach(track => track.stop());
  //       }
  //     }
  //   }

  //       if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
  //         console.error("Camera access denied");
  //       } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
  //         console.error("Camera in use by another application");
  //       } els
  //     }
  //   };


  useEffect(() => {
    const checkPermissions = async () => {
      const perms = await checkMediaPermissions();
      setPermissions(perms);

      // If both camera & microphone are granted, stop checking and notify parent
      if (perms.camera === "granted" && perms.microphone === "granted") {
        console.log("Webcam and Mic Permissions granted");
        onSuccess();
      }
    };

    // Check every half second until permissions are granted
    const interval = setInterval(checkPermissions, 500);

    return () => clearInterval(interval); // Cleanup on unmount
  }, [onSuccess]);

  const renderCheckingPermissions = () => (
    <div>
      <p>Checking webcam and microphone permissions...</p>
    </div>
  );

  const renderEnableWebcamPopupInstructions = () => (
    <div>
      <h1>Please enable your webcam and microphone</h1>
      <p>To enable your webcam and microphone:</p>

      {browser === "Chrome" && (
        <img
          src="instructions/enable_webcam_popup_chrome.jpg"
          alt="Chrome Instructions"
        />
      )}
      {browser === "Firefox" && (
        <img
          src="instructions/enable_webcam_popup_firefox.jpg"
          alt="Firefox Instructions"
        />
      )}
      {browser === "Safari" && (
        <img
          src="instructions/enable_webcam_popup_safari.jpg"
          alt="Safari Instructions"
        />
      )}
      {browser === "Edge" && (
        <img
          src="instructions/enable_webcam_popup_edge.jpg"
          alt="Edge Instructions"
        />
      )}
      {browser === "Unknown" && (
        <div>
          <p>Unrecognized Browser</p>
          <p>
            Please see your browser help documentation or use a different
            browser.
          </p>
        </div>
      )}
    </div>
  );

  const renderEnableWebcamFallbackInstructions = () => (
    <div>
      <h1>
        It looks like you have denied permission to use the webcam or microphone
      </h1>
      <p>To enable your webcam and microphone:</p>

      {browser === "Chrome" && (
        <img
          src="instructions/enable_webcam_fallback_chrome.jpg"
          alt="Chrome Fallback Instructions"
        />
      )}
      {browser === "Firefox" && (
        <img
          src="instructions/enable_webcam_fallback_firefox.jpg"
          alt="Firefox Fallback Instructions"
        />
      )}
      {browser === "Safari" && (
        <img
          src="instructions/enable_webcam_fallback_safari.jpg"
          alt="Safari Fallback Instructions"
        />
      )}
      {browser === "Edge" && (
        <img
          src="instructions/enable_webcam_fallback_edge.jpg"
          alt="Edge Fallback Instructions"
        />
      )}
      {browser === "Unknown" && (
        <div>
          <p>Unrecognized Browser</p>
          <p>
            Please see your browser help documentation or use a different
            browser.
          </p>
        </div>
      )}
      <p>Then refresh the page.</p>
    </div>
  );

  const renderUserInteractionPrompt = () => (
    // Prompt user to interact with the page to enable permissions
    <div>
      <h1>Click below to start webcam setup</h1>
      <Button handleClick={() => setHasInteracted(true)}>Start</Button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 shadow-lg w-2xl text-center">
        {hasInteracted === false && renderUserInteractionPrompt()}

        {hasInteracted &&
          (permissions.camera === "unknown" ||
            permissions.microphone === "unknown") &&
          renderCheckingPermissions()}

        {hasInteracted &&
          (permissions.camera === "prompt" ||
            permissions.microphone === "prompt") &&
          renderEnableWebcamPopupInstructions()}

        {hasInteracted &&
          (permissions.camera === "denied" ||
            permissions.microphone === "denied") &&
          renderEnableWebcamFallbackInstructions()}

        {hasInteracted &&
          permissions.camera === "granted" &&
          permissions.microphone === "granted" && (
            <p>Permissions granted. Loading...</p>
          )}
      </div>
    </div>
  );
}
