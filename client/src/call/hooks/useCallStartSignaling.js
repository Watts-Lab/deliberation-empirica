import { useEffect, useRef } from "react";

/**
 * Start recording client-side when the participant joins the Daily call.
 *
 * Recording is started via the Daily.js SDK (callObject.startRecording) rather
 * than via the server-side REST API to avoid 429 rate-limit errors when multiple
 * games start simultaneously (issue #949). Daily deduplicates — calling
 * startRecording when already recording is a no-op, so every participant
 * safely calls it.
 *
 * @param {Object} callObject - Daily call object
 * @param {boolean} recordingEnabled - whether video recording is enabled for this game
 */
export function useCallStartSignaling(callObject, recordingEnabled) {
  const recordingStartedRef = useRef(false);

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return undefined;

    const handleJoined = () => {
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

    // If already joined (effect ran after joined-meeting fired), start immediately
    if (callObject.meetingState?.() === "joined-meeting") {
      handleJoined();
    }

    return () => {
      callObject.off("joined-meeting", handleJoined);
    };
  }, [callObject, recordingEnabled]);
}
