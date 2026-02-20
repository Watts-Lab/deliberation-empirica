/**
 * Shared permission recovery utilities used in both the setup flow (GetPermissions)
 * and the in-call error recovery (UserMediaError).
 *
 * Exports:
 *   useGetMicCameraPermissions() — hook that queries camera/mic permission state
 *                                  and fires onchange when the state changes
 *   PermissionDeniedGuidance    — browser-specific instructions + screenshot image
 */
import React, { useState, useEffect, useCallback } from "react";
import { useGetBrowser } from "./hooks";

/**
 * Queries the browser's camera and microphone permission state and subscribes
 * to onchange events so the component re-renders when the user grants/denies
 * permissions in browser settings.
 *
 * Returns: { permissions: { camera, microphone }, refreshPermissions }
 * where each value is "granted" | "denied" | "prompt" | "unknown"
 */
export function useGetMicCameraPermissions() {
  const [permissions, setPermissions] = useState({
    camera: "unknown",
    microphone: "unknown",
  });

  const refreshPermissions = useCallback(async () => {
    try {
      const cameraPerm = await navigator.permissions.query({ name: "camera" });
      const micPerm = await navigator.permissions.query({
        name: "microphone",
      });

      setPermissions({
        camera: cameraPerm.state,
        microphone: micPerm.state,
      });

      cameraPerm.onchange = () => {
        setPermissions((prev) => ({ ...prev, camera: cameraPerm.state }));
      };
      micPerm.onchange = () => {
        setPermissions((prev) => ({ ...prev, microphone: micPerm.state }));
      };
    } catch (err) {
      setPermissions({ camera: "unknown", microphone: "unknown" });
    }
  }, []);

  useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions]);

  return { permissions, refreshPermissions };
}

/**
 * Browser-specific instructions for re-granting camera/mic permissions.
 * Shows a screenshot appropriate for the detected browser and a short message.
 *
 * Props:
 *   needsVideo {boolean} — whether camera permission is needed (default true)
 *   needsAudio {boolean} — whether microphone permission is needed (default true)
 */
export function PermissionDeniedGuidance({ needsVideo = true, needsAudio = true }) {
  const browser = useGetBrowser();

  const summary =
    needsVideo && needsAudio
      ? "the webcam or microphone"
      : needsVideo
      ? "the webcam"
      : "the microphone";

  return (
    <div>
      <p>
        It looks like you have denied permission to use {summary}. Please
        enable it in your browser settings.
      </p>
      {browser === "Chrome" && (
        <img
          src="instructions/enable_webcam_fallback_chrome.jpg"
          alt="Chrome: click the lock icon in the address bar, then allow camera and microphone"
        />
      )}
      {browser === "Firefox" && (
        <img
          src="instructions/enable_webcam_fallback_firefox.jpg"
          alt="Firefox: click the camera icon in the address bar to allow access"
        />
      )}
      {browser === "Safari" && (
        <img
          src="instructions/enable_webcam_fallback_safari.jpg"
          alt="Safari: go to Safari > Settings for this website to allow camera and microphone"
        />
      )}
      {browser === "Edge" && (
        <img
          src="instructions/enable_webcam_fallback_edge.jpg"
          alt="Edge: click the lock icon in the address bar to allow camera and microphone"
        />
      )}
    </div>
  );
}
