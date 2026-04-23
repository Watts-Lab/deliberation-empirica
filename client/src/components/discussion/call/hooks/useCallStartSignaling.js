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

    // Track deferred Sentry timers so we can cancel on cleanup
    const pendingTimers = [];

    const attemptStartRecording = (trigger, attempt = 1) => {
      const result = callObject.startRecording({ type: "raw-tracks" });
      if (result && typeof result.then === "function") {
        result.then(
          () => console.log("[Recording] Started raw-tracks recording from client", {
            trigger, attempt,
          }),
          (err) => {
            console.warn("[Recording] Failed to start recording:", err.message, {
              trigger, attempt,
            });
            recordingStartedRef.current = false;

            // Defer Sentry alert: wait 5s and check if another participant
            // successfully started recording (indicated by recording-started
            // event setting recordingConfirmedRef). This avoids false alarms
            // when one client fails but another succeeds — Daily broadcasts
            // recording-started to all participants regardless of who initiated.
            const timer = setTimeout(() => {
              if (!recordingConfirmedRef.current) {
                Sentry.captureMessage("Recording not started for stage", {
                  level: "error",
                  extra: { triggeringError: err.message, stageId, trigger, attempt },
                });
              }
            }, 5000);
            pendingTimers.push(timer);
          }
        );
      } else {
        console.warn("[Recording] startRecording() returned non-Promise; call may be in transitional state", {
          trigger, attempt, meetingState: callObject.meetingState?.(),
        });
        recordingStartedRef.current = false;

        // Retry once after 500ms — Daily's recording API may not be ready
        // at the same tick as joined-meeting (see DELIBERATION-EMPIRICA-RK).
        if (attempt < 2) {
          const retryTimer = setTimeout(() => {
            if (!recordingConfirmedRef.current && !recordingStartedRef.current) {
              console.log("[Recording] Retrying startRecording", { trigger, attempt: attempt + 1 });
              recordingStartedRef.current = true;
              attemptStartRecording(trigger, attempt + 1);
            }
          }, 500);
          pendingTimers.push(retryTimer);
        } else {
          // Defer Sentry alert: if no participant confirms recording within 5s,
          // surface the issue so we don't silently miss a whole stage of recording.
          const timer = setTimeout(() => {
            if (!recordingConfirmedRef.current) {
              Sentry.captureMessage("Recording not started for stage", {
                level: "error",
                extra: { triggeringError: "non-promise return", stageId, trigger },
              });
            }
          }, 5000);
          pendingTimers.push(timer);
        }
      }
    };

    const startRecordingIfNeeded = (trigger) => {
      if (recordingEnabled && !recordingStartedRef.current) {
        recordingStartedRef.current = true;
        attemptStartRecording(trigger);
      }
    };

    const handleJoined = () => {
      startRecordingIfNeeded("joined-meeting-event");
    };

    const handleRecordingStarted = () => {
      recordingConfirmedRef.current = true;
      console.log("[Recording] Confirmed: recording-started event received");
    };

    const handleRecordingError = (event) => {
      console.error("[Recording] recording-error event:", event);
      recordingStartedRef.current = false;

      // Same deferred check: only alert Sentry if no participant got
      // recording running within 5s of this error.
      const timer = setTimeout(() => {
        if (!recordingConfirmedRef.current) {
          Sentry.captureMessage("Daily recording-error — no recording confirmed", {
            level: "error",
            extra: { event, stageId },
          });
        }
      }, 5000);
      pendingTimers.push(timer);
    };

    callObject.on("joined-meeting", handleJoined);
    callObject.on("recording-started", handleRecordingStarted);
    callObject.on("recording-error", handleRecordingError);

    // If already joined (effect ran after joined-meeting fired), start immediately
    if (callObject.meetingState?.() === "joined-meeting") {
      console.log("[Recording] Already joined at effect start, attempting recording", {
        stageId,
        meetingState: callObject.meetingState?.(),
      });
      startRecordingIfNeeded("already-joined-at-effect-start");
    }

    return () => {
      pendingTimers.forEach(clearTimeout);
      callObject.off("joined-meeting", handleJoined);
      callObject.off("recording-started", handleRecordingStarted);
      callObject.off("recording-error", handleRecordingError);
    };
  }, [callObject, recordingEnabled, stageId]);
}
