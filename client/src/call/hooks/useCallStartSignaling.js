import { useEffect, useRef } from "react";
import * as Sentry from "@sentry/react";

/**
 * Start recording client-side when the participant joins the Daily call.
 *
 * Recording is started via the Daily.js SDK (callObject.startRecording) rather
 * than via the server-side REST API to avoid 429 rate-limit errors when multiple
 * games start simultaneously (issue #949). Daily deduplicates — calling
 * startRecording when already recording is a no-op, so every participant
 * safely calls it.
 *
 * The stageId dependency ensures recording restarts for each video stage,
 * since the server calls stopRecording at the end of each stage.
 *
 * @param {Object} callObject - Daily call object
 * @param {boolean} recordingEnabled - whether video recording is enabled for this game
 * @param {string} stageId - current Empirica stage ID (triggers re-start per stage)
 */
export function useCallStartSignaling(callObject, recordingEnabled, stageId) {
  const recordingStartedRef = useRef(false);
  const recordingConfirmedRef = useRef(false);

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return undefined;

    // Reset on stage change so recording starts fresh for each video stage
    recordingStartedRef.current = false;
    recordingConfirmedRef.current = false;

    const startRecordingIfNeeded = () => {
      if (recordingEnabled && !recordingStartedRef.current) {
        recordingStartedRef.current = true;
        callObject.startRecording({ type: "raw-tracks" }).then(
          () => console.log("[Recording] Started raw-tracks recording from client"),
          (err) => {
            console.warn("[Recording] Failed to start recording:", err.message);
            Sentry.captureMessage("Client-side recording start failed", {
              level: "warning",
              extra: { error: err.message, stageId },
            });
            recordingStartedRef.current = false;
          }
        );
      }
    };

    const handleJoined = () => {
      startRecordingIfNeeded();
    };

    const handleRecordingStarted = () => {
      recordingConfirmedRef.current = true;
      console.log("[Recording] Confirmed: recording-started event received");
    };

    const handleRecordingError = (event) => {
      console.error("[Recording] recording-error event:", event);
      Sentry.captureMessage("Daily recording-error event", {
        level: "error",
        extra: { event, stageId },
      });
      recordingStartedRef.current = false;
    };

    callObject.on("joined-meeting", handleJoined);
    callObject.on("recording-started", handleRecordingStarted);
    callObject.on("recording-error", handleRecordingError);

    // If already joined (effect ran after joined-meeting fired), start immediately
    if (callObject.meetingState?.() === "joined-meeting") {
      startRecordingIfNeeded();
    }

    return () => {
      callObject.off("joined-meeting", handleJoined);
      callObject.off("recording-started", handleRecordingStarted);
      callObject.off("recording-error", handleRecordingError);
    };
  }, [callObject, recordingEnabled, stageId]);
}
