import { useCallback, useEffect, useState } from "react";
import * as Sentry from "@sentry/react";

// Cause-severity priority for errors on the same device channel.
// A showing error is only replaced by one of strictly higher priority.
// Defined outside the hook so per-device useCallbacks don't need it as a dep.
const DEVICE_ERROR_PRIORITY = {
  permissions: 5,
  "in-use": 4,
  "not-found": 3,
  constraints: 2,
};

/**
 * Manage device error state and listen for Daily error events.
 *
 * Three independent error states — one per device type. Errors are shown
 * sequentially (camera → mic → speaker) rather than merged into one modal,
 * matching the Zoom/Meet pattern of addressing each device separately.
 *
 * Each setter deduplicates: Firefox can fire hundreds of camera-error/mic-error
 * events on tab focus-regain, and we must not trigger a re-render per event.
 *
 * @param {Object} callObject - Daily call object
 * @param {Object} bannerCallbacks - { addDeviceBanner } for routing not-found to banners
 * @returns {{
 *   cameraError: Object|null, setCameraError: Function,
 *   micError: Object|null, setMicError: Function,
 *   speakerError: Object|null, setSpeakerError: Function,
 *   deviceError: Object|null,
 *   fatalError: Object|null, setFatalError: Function,
 *   networkInterrupted: boolean,
 * }}
 */
export function useDeviceErrors(callObject, { addDeviceBanner } = {}) {
  const [cameraError, setCameraErrorRaw] = useState(null);
  const [micError, setMicErrorRaw] = useState(null);
  const [speakerError, setSpeakerErrorRaw] = useState(null);

  // keepPrev: returns true when the existing error should not be replaced by e.
  // - e is null/falsy → always clear (caller explicitly cleared)
  // - same dailyErrorType → skip duplicate (prevents Firefox re-render storms)
  // - existing priority strictly higher → keep (permissions beats in-use)
  const keepPrev = (prev, e) =>
    !!(
      e &&
      prev &&
      (prev.dailyErrorType === e.dailyErrorType ||
        (DEVICE_ERROR_PRIORITY[prev.dailyErrorType] ?? 1) >
          (DEVICE_ERROR_PRIORITY[e.dailyErrorType] ?? 1))
    );

  const setCameraError = useCallback(
    (e) => setCameraErrorRaw((prev) => (keepPrev(prev, e) ? prev : e)),
    [],
  );
  const setMicError = useCallback(
    (e) => setMicErrorRaw((prev) => (keepPrev(prev, e) ? prev : e)),
    [],
  );
  const setSpeakerError = useCallback(
    (e) => setSpeakerErrorRaw((prev) => (keepPrev(prev, e) ? prev : e)),
    [],
  );

  // Active error: camera first (most critical — user can't be seen), then mic, then speaker.
  // When the user resolves the camera error the mic error surfaces automatically, then speaker.
  const deviceError = cameraError || micError || speakerError;

  const [fatalError, setFatalError] = useState(null);
  const [networkInterrupted, setNetworkInterrupted] = useState(false);

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return undefined;

    const handleDeviceError =
      (type) =>
      async (ev = {}) => {
        const rawMessage =
          typeof ev.errorMsg === "string"
            ? ev.errorMsg
            : ev?.errorMsg?.message || ev?.error?.message;

        // Extract Daily's error type (e.g., "not-found", "permissions", "in-use", "constraints")
        const dailyErrorType =
          ev?.error?.type || ev?.errorMsg?.type || ev?.type;

        // Route not-found errors to banner system instead of modal
        if (
          dailyErrorType === "not-found" &&
          type !== "fatal-devices-error" &&
          addDeviceBanner
        ) {
          const deviceName = type === "camera-error" ? "Camera" : "Microphone";
          const deviceType = type === "camera-error" ? "camera" : "microphone";
          addDeviceBanner({
            deviceType,
            message: `${deviceName} disconnected — switching to default...`,
          });
          return;
        }

        const errorObj = {
          type,
          message: rawMessage || null,
          dailyErrorType: dailyErrorType || null,
          dailyEvent: ev, // Preserve the full Daily event for diagnosis
        };
        if (type === "camera-error" || type === "fatal-devices-error") {
          setCameraError(errorObj);
        } else if (type === "mic-error") {
          setMicError(errorObj);
        }
      };

    const fatalHandler = handleDeviceError("fatal-devices-error");
    const cameraHandler = handleDeviceError("camera-error");
    const micHandler = handleDeviceError("mic-error");

    callObject.on("fatal-devices-error", fatalHandler);
    callObject.on("camera-error", cameraHandler);
    callObject.on("mic-error", micHandler);

    // ---- Fatal call error (connection lost, ejected, room expired, etc.) ----
    const handleFatalError = (ev) => {
      const errorType = ev?.type || ev?.error?.type || "unknown";
      const errorMsg =
        ev?.msg || ev?.errorMsg || ev?.error?.msg || "An error occurred";
      setFatalError({ type: errorType, message: errorMsg });
      Sentry.captureMessage("Fatal Daily error", {
        level: "error",
        extra: { type: errorType, message: errorMsg, event: ev },
      });
    };
    callObject.on("error", handleFatalError);

    // ---- Network connection interrupted / reconnected ----
    // Show the banner only if the interruption persists for 5 seconds.
    // Brief blips resolve silently without interrupting participant flow.
    let networkTimerId = null;
    const handleNetworkConnection = (ev) => {
      const interrupted = ev?.event === "interrupted";
      if (interrupted) {
        Sentry.addBreadcrumb({
          category: "network",
          message: `Network ${ev?.type || "connection"} interrupted`,
          level: "warning",
          data: { connectionType: ev?.type },
        });
        if (!networkTimerId) {
          networkTimerId = setTimeout(() => {
            setNetworkInterrupted(true);
            networkTimerId = null;
          }, 5000);
        }
      } else {
        // Reconnected — cancel pending timer or clear the banner
        if (networkTimerId) {
          clearTimeout(networkTimerId);
          networkTimerId = null;
        }
        setNetworkInterrupted(false);
      }
    };
    callObject.on("network-connection", handleNetworkConnection);

    return () => {
      if (networkTimerId) clearTimeout(networkTimerId);
      callObject.off("fatal-devices-error", fatalHandler);
      callObject.off("camera-error", cameraHandler);
      callObject.off("mic-error", micHandler);
      callObject.off("error", handleFatalError);
      callObject.off("network-connection", handleNetworkConnection);
    };
  }, [callObject, setCameraError, setMicError, addDeviceBanner]);

  return {
    cameraError,
    setCameraError,
    micError,
    setMicError,
    speakerError,
    setSpeakerError,
    deviceError,
    fatalError,
    setFatalError,
    networkInterrupted,
  };
}
