import { useCallback, useEffect, useRef } from "react";

/**
 * Signal the server to start recording when the participant joins the call.
 *
 * Daily may emit `joined-meeting` before Empirica gives us a stage object
 * (because the join happens immediately when the stage starts). This hook
 * remembers the intent and retries once stage is ready, rather than dropping
 * the recording trigger entirely.
 *
 * @param {Object} callObject - Daily call object
 * @param {Object} stage - Empirica stage object
 */
export function useCallStartSignaling(callObject, stage) {
  const pendingCallStartRef = useRef(false);

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
    };

    callObject.on("joined-meeting", handleJoined);

    return () => {
      callObject.off("joined-meeting", handleJoined);
    };
  }, [callObject, attemptCallStartFlag]);

  useEffect(() => {
    attemptCallStartFlag();
  }, [attemptCallStartFlag, stage]);
}
