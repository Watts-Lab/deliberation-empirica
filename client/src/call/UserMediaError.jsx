import React, { useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/react";
import { Button } from "../components/Button";
import { Select } from "../components/Select";
import {
  useGetMicCameraPermissions,
  PermissionDeniedGuidance,
} from "../components/PermissionRecovery";

const refreshPage = () => {
  console.log(
    "make sure to allow access to your microphone and camera in your browser's permissions"
  );
  window.location.reload();
};

function DevicePicker({ deviceType, devices, onSwitchDevice }) {
  const [selectedId, setSelectedId] = useState(devices[0]?.deviceId ?? "");

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-slate-100 p-4">
      <p className="text-sm text-slate-700">
        Your selected {deviceType} isn't available. Choose one to use:
      </p>
      <Select
        options={devices.map((d) => ({ label: d.label, value: d.deviceId }))}
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        testId="devicePickerSelect"
      />
      <Button
        handleClick={() => onSwitchDevice(deviceType, selectedId)}
        testId="switchDeviceButton"
        className="px-6"
      >
        Switch to this device
      </Button>
    </div>
  );
}

// Copy keyed by [deviceType][dailyErrorType] for cause-specific messaging.
// "permissions" and "not-found" have their own UI branches (PermissionDeniedGuidance
// and DevicePicker respectively), so the steps here are only shown for other causes.
const deviceErrorCopy = {
  "camera-error": {
    permissions: {
      title: "Camera access denied",
    },
    "in-use": {
      title: "Camera in use",
      steps: [
        "Close any other app (Zoom, Meet, FaceTime, etc.) that may be using your camera.",
        "Reload the page to retry connecting.",
      ],
    },
    "not-found": {
      title: "Camera not available",
    },
    constraints: {
      title: "Camera unavailable",
      steps: [
        "Your camera may not support the required settings.",
        "Try a different camera if one is available, or reload the page.",
      ],
    },
    default: {
      title: "Camera problem",
      steps: [
        "Check that your camera is plugged in and not in use by another app.",
        "Reload the page to retry connecting.",
      ],
    },
  },
  "mic-error": {
    permissions: {
      title: "Microphone access denied",
    },
    "in-use": {
      title: "Microphone in use",
      steps: [
        "Close any other app that may be using your microphone.",
        "Check that your headset or microphone is plugged in and not muted.",
        "Reload the page to retry connecting.",
      ],
    },
    "not-found": {
      title: "Microphone not available",
    },
    constraints: {
      title: "Microphone unavailable",
      steps: [
        "Your microphone may not support the required settings.",
        "Try a different microphone if one is available, or reload the page.",
      ],
    },
    default: {
      title: "Microphone problem",
      steps: [
        "Check that your microphone is plugged in and not in use by another app.",
        "Reload the page to retry connecting.",
      ],
    },
  },
  default: {
    permissions: {
      title: "Camera and microphone access denied",
    },
    "in-use": {
      title: "Camera and microphone in use",
      steps: [
        "Close any other app (Zoom, Meet, FaceTime, etc.) that may be using your camera or microphone.",
        "Reload the page to retry connecting.",
      ],
    },
    "not-found": {
      title: "Camera and microphone not available",
    },
    constraints: {
      title: "Camera and microphone unavailable",
      steps: [
        "Your camera or microphone may not support the required settings.",
        "Try different devices if available, or reload the page.",
      ],
    },
    default: {
      title: "Camera or microphone problem",
      steps: [
        "Check that your camera and microphone are plugged in and not in use by another app.",
        "Reload the page to retry connecting.",
      ],
    },
  },
};

function getErrorCopy(errorType, dailyErrorType) {
  const deviceCopy = deviceErrorCopy[errorType] || deviceErrorCopy.default;
  return deviceCopy[dailyErrorType] || deviceCopy.default;
}

export function UserMediaError({ error, onDismiss, onSwitchDevice }) {
  // ------------------- fallback UI when media permissions fail ---------------------
  const copy = getErrorCopy(error?.type, error?.dailyErrorType);
  const { title } = copy;
  const steps = copy.steps || [];
  const { audioOk, videoOk } = error?.details || {};
  const [deviceSurvey, setDeviceSurvey] = useState(null);
  // availableDevices holds full deviceIds for the picker (separate from deviceSurvey
  // which only stores truncated IDs for safe Sentry logging)
  const [availableDevices, setAvailableDevices] = useState(null);

  // ------------------- permission monitoring for auto-reload ---------------------
  // When dailyErrorType === "permissions", the browser has blocked camera/mic access.
  // Watch for the user to re-grant permissions so we can auto-reload the page,
  // allowing Daily to re-acquire devices cleanly without a manual reload.
  //
  // We only auto-reload if permissions were actually denied when the error first
  // appeared — this avoids false positives where the error had a different root
  // cause (device not-found, in-use, etc.) but the permission query still returns
  // "granted".
  const isPermissionsError = error?.dailyErrorType === "permissions";
  const isNotFoundError = error?.dailyErrorType === "not-found";
  const pickerDevices =
    isNotFoundError && availableDevices
      ? error?.type === "camera-error"
        ? availableDevices.cameras
        : availableDevices.microphones
      : [];
  const pickerDeviceType =
    error?.type === "camera-error" ? "camera" : "microphone";
  const { permissions } = useGetMicCameraPermissions();
  const deniedOnMountRef = useRef(null);
  const autoReloadFiredRef = useRef(false);

  useEffect(() => {
    if (!isPermissionsError) return;
    if (deniedOnMountRef.current !== null) return; // Captured already
    // Wait until permissions API has responded (not "unknown")
    if (permissions.camera === "unknown" || permissions.microphone === "unknown") return;
    deniedOnMountRef.current =
      permissions.camera === "denied" || permissions.microphone === "denied";
  }, [isPermissionsError, permissions]);

  useEffect(() => {
    if (!isPermissionsError) return;
    if (deniedOnMountRef.current !== true) return; // Skip if not initially denied
    if (autoReloadFiredRef.current) return;
    if (permissions.camera === "granted" && permissions.microphone === "granted") {
      autoReloadFiredRef.current = true;
      console.log("[UserMediaError] Permissions re-granted — reloading to reconnect");
      refreshPage();
    }
  }, [isPermissionsError, permissions]);

  useEffect(() => {
    if (!error) return;
    let cancelled = false;

    const recordError = async () => {
      const details = {
        type: error?.type,
        message: error?.message,
        dailyErrorType: error?.dailyErrorType, // e.g., "not-found", "permissions", "in-use"
        audioOk,
        videoOk,
        dailyEvent: error?.dailyEvent, // Full Daily event for diagnosis
      };

      // Check browser permissions state for additional context
      try {
        if (navigator.permissions) {
          const [camPerm, micPerm] = await Promise.all([
            navigator.permissions.query({ name: "camera" }).catch(() => null),
            navigator.permissions.query({ name: "microphone" }).catch(() => null),
          ]);
          details.permissions = {
            camera: camPerm?.state || "unknown", // "granted", "denied", "prompt"
            microphone: micPerm?.state || "unknown",
          };
        }
      } catch (permErr) {
        details.permissionsError = permErr?.message || String(permErr);
      }

      try {
        if (navigator?.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cameras = devices.filter((d) => d.kind === "videoinput");
          const microphones = devices.filter((d) => d.kind === "audioinput");
          const survey = {
            cameraCount: cameras.length,
            micCount: microphones.length,
            cameras: cameras.map((d, idx) => ({
              label: d.label || `Camera ${idx + 1}`,
              idSuffix: d.deviceId?.slice(-6) || "unknown",
            })),
            microphones: microphones.map((d, idx) => ({
              label: d.label || `Microphone ${idx + 1}`,
              idSuffix: d.deviceId?.slice(-6) || "unknown",
            })),
          };
          details.deviceSurvey = survey;
          if (!cancelled) {
            setDeviceSurvey(survey);
            setAvailableDevices({
              cameras: cameras.map((d, idx) => ({
                label: d.label || `Camera ${idx + 1}`,
                deviceId: d.deviceId,
              })),
              microphones: microphones.map((d, idx) => ({
                label: d.label || `Microphone ${idx + 1}`,
                deviceId: d.deviceId,
              })),
            });
          }
          console.info("Enumerated media devices", survey);
        } else {
          details.deviceSurvey = { note: "enumerateDevices unavailable" };
        }
      } catch (err) {
        details.deviceSurveyError = err?.message || String(err);
        console.warn("Failed to enumerate media devices", err);
      }

      // Build summary for easy scanning
      const permStatus = details.permissions
        ? `cam=${details.permissions.camera}, mic=${details.permissions.microphone}`
        : "permissions unknown";
      const deviceCount = details.deviceSurvey
        ? `${details.deviceSurvey.cameraCount} cam, ${details.deviceSurvey.micCount} mic`
        : "devices unknown";
      const summary = `${error?.type || "unknown"} error (${error?.dailyErrorType || "no daily type"}): ${permStatus}, ${deviceCount}`;
      details.summary = summary;

      console.error("[Media Error]", summary, details);
      if (Sentry?.captureMessage) {
        Sentry.captureMessage("User media error", {
          level: "error",
          extra: details,
        });
      }
    };

    recordError();

    return () => {
      cancelled = true;
    };
  }, [audioOk, error, videoOk]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-red-600">{title}</h1>

      {isPermissionsError ? (
        // Browser-specific guidance with screenshot images
        <PermissionDeniedGuidance
          needsVideo={error?.type !== "mic-error"}
          needsAudio={error?.type !== "camera-error"}
        />
      ) : isNotFoundError && pickerDevices.length > 0 && onSwitchDevice ? (
        // Device disconnected — let user pick a replacement without reloading
        <DevicePicker
          deviceType={pickerDeviceType}
          devices={pickerDevices}
          onSwitchDevice={onSwitchDevice}
        />
      ) : (
        // Generic steps for other errors (in-use, constraints, etc.)
        steps.length > 0 && (
          <ul className="list-disc space-y-2 rounded-xl bg-slate-100 p-4 text-left text-sm text-slate-700">
            {steps.map((step, idx) => (
              // eslint-disable-next-line react/no-array-index-key
              <li key={idx}>{step}</li>
            ))}
          </ul>
        )
      )}

      <Button
        handleClick={refreshPage}
        testId="retryUserMedia"
        className="px-6"
      >
        Reload and retry
      </Button>
    </div>
  );
}
