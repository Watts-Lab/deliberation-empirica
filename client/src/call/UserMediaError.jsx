import React, { useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { Button } from "../components/Button";

const safeText = (val, fallback) => {
  if (typeof val === "string" && val.trim()) {
    return val;
  }
  return fallback;
};

const refreshPage = () => {
  console.log(
    "make sure to allow access to your microphone and camera in your browser's permissions"
  );
  window.location.reload();
};

const deviceErrorCopy = {
  "camera-error": {
    title: "Camera blocked",
    message: "We couldn't access your camera.",
    steps: [
      "Use the lock icon in your browser's address bar to allow camera access.",
      "Close any other app (Zoom, Meet, FaceTime, etc.) that may be using your camera.",
      "Reload the page to retry connecting.",
    ],
  },
  "mic-error": {
    title: "Microphone blocked",
    message: "We couldn't access your microphone.",
    steps: [
      "Use the lock icon in your browser's address bar to allow microphone access.",
      "Check that your headset or microphone is plugged in and not muted.",
      "Reload the page to retry connecting.",
    ],
  },
  default: {
    title: "Camera or mic blocked",
    message:
      "We couldn't access your camera or microphone. Please check your browser permissions.",
    steps: [
      "Use the lock icon in your browser's address bar to allow camera and microphone access.",
      "Close other applications that might already be using your camera or microphone.",
      "Once you've adjusted settings, reload the page.",
    ],
  },
};

export function UserMediaError({ error }) {
  // ------------------- fallback UI when media permissions fail ---------------------
  const copy = deviceErrorCopy[error?.type] ?? deviceErrorCopy.default;
  const message = safeText(error?.message, copy.message);
  const { steps } = copy;
  const { title } = copy;
  const { audioOk, videoOk } = error?.details || {};
  const [deviceSurvey, setDeviceSurvey] = useState(null);

  useEffect(() => {
    if (!error) return;
    let cancelled = false;

    const recordError = async () => {
      const details = {
        type: error?.type,
        message: error?.message,
        audioOk,
        videoOk,
        raw: error,
      };

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
          }
          console.info("Enumerated media devices", survey);
        } else {
          details.deviceSurvey = { note: "enumerateDevices unavailable" };
        }
      } catch (err) {
        details.deviceSurveyError = err?.message || String(err);
        console.warn("Failed to enumerate media devices", err);
      }

      console.error("User media error", details);
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
    <div className="flex h-full w-full items-center justify-center bg-slate-950/30 p-6">
      <div className="flex w-full max-w-xl flex-col gap-4 rounded-2xl border border-red-500/50 bg-slate-900/70 p-8 text-slate-100 shadow-2xl">
        <div>
          <h1 className="text-2xl font-semibold text-red-200">{title}</h1>
          <p className="mt-2 text-sm text-slate-200">{message}</p>
          {(audioOk !== undefined || videoOk !== undefined) && (
            <div className="mt-2 text-xs text-slate-300">
              <div>
                Camera check:{" "}
                {videoOk === false ? "blocked or failing" : "ok / unknown"}
              </div>
              <div>
                Mic check:{" "}
                {audioOk === false ? "blocked or failing" : "ok / unknown"}
              </div>
            </div>
          )}
          {deviceSurvey && (
            <div className="mt-2 text-xs text-slate-300">
              <div>Detected cameras: {deviceSurvey.cameraCount}</div>
              <div>Detected microphones: {deviceSurvey.micCount}</div>
              {deviceSurvey.cameraCount === 0 && (
                <div className="text-red-200">
                  No camera found. Plug one in, allow browser/OS permissions,
                  then reload.
                </div>
              )}
            </div>
          )}
        </div>

        {steps.length > 0 && (
          <ul className="list-disc space-y-2 rounded-xl bg-slate-900/60 p-4 text-left text-sm text-slate-200">
            {steps.map((step, idx) => (
              <li key={`${step}-${idx}`}>{step}</li>
            ))}
          </ul>
        )}

        <Button
          handleClick={refreshPage}
          testId="retryUserMedia"
          className="px-6"
        >
          Reload and retry
        </Button>
      </div>
    </div>
  );
}
