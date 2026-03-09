import { useCallback, useEffect, useRef } from "react";

/**
 * Signal the server when the participant joins the call, and start recording
 * client-side if enabled.
 *
 * Recording is started via the Daily.js SDK (callObject.startRecording) rather
 * than via the server-side REST API to avoid 429 rate-limit errors when multiple
 * games start simultaneously (issue #949). Daily deduplicates — calling
 * startRecording when already recording is a no-op, so every participant
 * safely calls it.
 *
 * Daily may emit `joined-meeting` before Empirica gives us a stage object
 * (because the join happens immediately when the stage starts). This hook
 * remembers the intent and retries once stage is ready, rather than dropping
 * the recording trigger entirely.
 *
 * @param {Object} callObject - Daily call object
 * @param {Object} stage - Empirica stage object
 * @param {boolean} recordingEnabled - whether video recording is enabled for this game
 */
export function useCallStartSignaling(callObject, stage, recordingEnabled) {
  const pendingCallStartRef = useRef(false);
  const recordingStartedRef = useRef(false);

  const attemptCallStartFlag = useCallback(() => {
    if (!pendingCallStartRef.current) return;
    if (!stage || stage.get("callStarted") === true) return;
    try {
      stage.set("callStarted", true);
      pendingCallStartRef.current = false;
    } catch (err) {
      console.error("Failed to mark callStarted", err);
    }
  }, [stage]);

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return undefined;

    const handleJoined = () => {
      pendingCallStartRef.current = true;
      attemptCallStartFlag();

      // Start recording client-side (issue #949)
      if (recordingEnabled && !recordingStartedRef.current) {
        recordingStartedRef.current = true;
        callObject.startRecording({ type: "raw-tracks" }).then(
          () => console.log("[Recording] Started raw-tracks recording from client"),
          (err) => {
            console.warn("[Recording] Failed to start recording:", err.message);
            recordingStartedRef.current = false;
          }
        );
      }
    };

    callObject.on("joined-meeting", handleJoined);

    return () => {
      callObject.off("joined-meeting", handleJoined);
    };
  }, [callObject, attemptCallStartFlag, recordingEnabled]);

  useEffect(() => {
    attemptCallStartFlag();
  }, [attemptCallStartFlag, stage]);
}
