import { useCallback, useState } from "react";
import * as Sentry from "@sentry/react";

function getCoarseBrowser() {
  const ua = navigator.userAgent || "";
  if (/Edg/.test(ua)) return "Edge";
  if (/Chrome/.test(ua)) return "Chrome";
  if (/Safari/.test(ua)) return "Safari";
  if (/Firefox/.test(ua)) return "Firefox";
  return "Other";
}

/**
 * Manage gesture-gated operations (audio playback, speaker setSinkId, AudioContext resume).
 *
 * Safari and some browsers require user gestures for certain operations. This hook
 * tracks which operations failed and need a user gesture to retry, and provides
 * handlers to complete them all in a single click.
 *
 * @param {Object} params
 * @param {Object} params.devices - Daily useDevices() result (for setSpeaker)
 * @param {Function} params.resumeAudioContext - From useAudioContextMonitor
 * @param {boolean} params.needsUserInteraction - From useAudioContextMonitor
 * @param {boolean} params.blurredWhileSuspended - From useAudioContextMonitor
 * @param {boolean} params.joinStalled - From useCallLifecycle
 * @param {Function} params.clearJoinStalled - From useCallLifecycle
 * @param {string} params.audioContextState - From useAudioContextMonitor
 * @returns {{
 *   audioPlaybackBlocked: boolean,
 *   pendingGestureOperations: Object,
 *   pendingOperationDetails: Object,
 *   setPendingGestureOperations: Function,
 *   setPendingOperationDetails: Function,
 *   handleAudioPlayFailed: Function,
 *   handleEnableAudio: Function,
 *   handleSetupFailure: Function,
 *   handleCompleteSetup: Function,
 *   showGesturePrompt: boolean,
 * }}
 */
export function useGesturePrompt({
  devices,
  resumeAudioContext,
  needsUserInteraction,
  blurredWhileSuspended,
  joinStalled,
  clearJoinStalled,
  audioContextState,
}) {
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);

  const [pendingGestureOperations, setPendingGestureOperations] = useState({
    speaker: false,
    audioContext: false,
  });
  const [pendingOperationDetails, setPendingOperationDetails] = useState({
    speaker: null,
    audioContext: null,
  });

  const handleAudioPlayFailed = useCallback((e) => {
    console.warn("[Audio] Playback failed:", e);
    // Only show the prompt if it looks like an autoplay/gesture issue
    if (e.name === "NotAllowedError" || e.message?.includes("user gesture")) {
      setAudioPlaybackBlocked(true);
    }
  }, []);

  const handleEnableAudio = useCallback(() => {
    // User clicked, which provides the gesture context browsers need.
    // The DailyAudio component will retry on its own when tracks update.
    setAudioPlaybackBlocked(false);
    // Clear join stalled state (issue #1187) - user gesture restores focus
    clearJoinStalled();

    // Resume the AudioContext (requires user gesture)
    resumeAudioContext().catch((err) => {
      console.error("[Audio] Failed to resume AudioContext:", err);
    });
  }, [resumeAudioContext, clearJoinStalled]);

  const handleSetupFailure = useCallback((operation, error, details) => {
    if (
      error?.name === "NotAllowedError" ||
      error?.message?.includes("user gesture")
    ) {
      console.warn(
        `[Setup] ${operation} requires user gesture:`,
        error.message,
      );

      setPendingGestureOperations((prev) => ({
        ...prev,
        [operation]: true,
      }));
      setPendingOperationDetails((prev) => ({
        ...prev,
        [operation]: details,
      }));

      // Log to Sentry for monitoring browser policy trends
      Sentry.captureMessage("Setup operation requires user gesture", {
        level: "info",
        tags: {
          operation,
          browser: getCoarseBrowser(),
        },
        extra: { error: error?.message, details },
      });
    }
  }, []);

  // Unified handler to complete all pending setup operations in one user gesture
  const handleCompleteSetup = useCallback(async () => {
    console.log("[Setup] Completing setup with user gesture");
    const operations = [];
    const operationNames = [];

    // Batch all pending operations
    if (pendingGestureOperations.speaker && pendingOperationDetails.speaker) {
      operationNames.push("speaker");
      operations.push(
        devices
          .setSpeaker(pendingOperationDetails.speaker.speakerId)
          .then(() => {
            console.log("[Setup] Speaker set successfully via user gesture");
            setPendingGestureOperations((prev) => ({
              ...prev,
              speaker: false,
            }));
            setPendingOperationDetails((prev) => ({ ...prev, speaker: null }));
          })
          .catch((err) => {
            console.error(
              "[Setup] Failed to set speaker even with user gesture:",
              err,
            );
            throw new Error(`Speaker: ${err.message}`);
          }),
      );
    }

    if (pendingGestureOperations.audioContext || needsUserInteraction) {
      operationNames.push("audioContext");
      operations.push(
        resumeAudioContext()
          .then(() => {
            console.log(
              "[Setup] AudioContext resumed successfully via user gesture",
            );
            setPendingGestureOperations((prev) => ({
              ...prev,
              audioContext: false,
            }));
            setPendingOperationDetails((prev) => ({
              ...prev,
              audioContext: null,
            }));
          })
          .catch((err) => {
            console.error(
              "[Setup] Failed to resume AudioContext even with user gesture:",
              err,
            );
            throw new Error(`AudioContext: ${err.message}`);
          }),
      );
    }

    if (operations.length === 0) {
      console.log("[Setup] No pending operations to complete");
      return;
    }

    try {
      // Execute all operations in parallel (all within the same user gesture)
      await Promise.all(operations);

      // Log success to Sentry
      Sentry.captureMessage("Setup completed via user gesture", {
        level: "info",
        tags: { browser: navigator.userAgent },
        extra: {
          operations: operationNames,
          success: true,
        },
      });

      console.log("[Setup] All operations completed successfully");

      // Also clear the audioPlaybackBlocked flag if audio was enabled
      setAudioPlaybackBlocked(false);
    } catch (err) {
      console.error("[Setup] Some operations failed:", err);
      Sentry.captureException(err, {
        tags: { context: "setup-completion" },
        extra: {
          attemptedOperations: operationNames,
        },
      });
      // Keep failed operations in pending state for potential retry
    }
  }, [
    pendingGestureOperations,
    pendingOperationDetails,
    needsUserInteraction,
    devices,
    resumeAudioContext,
  ]);

  // Computed: should the gesture prompt modal be shown?
  const showGesturePrompt =
    Object.values(pendingGestureOperations).some(Boolean) ||
    audioPlaybackBlocked ||
    needsUserInteraction ||
    blurredWhileSuspended ||
    joinStalled;

  // Computed: what type of prompt to show
  const hasSetupOperations = Object.values(pendingGestureOperations).some(
    Boolean,
  );

  // Build the prompt message
  let gesturePromptMessage;
  if (hasSetupOperations) {
    gesturePromptMessage = "Click below to enable audio.";
  } else if (joinStalled) {
    gesturePromptMessage = "Video connection paused. Click below to continue.";
  } else if (blurredWhileSuspended) {
    gesturePromptMessage = "Click below to enable audio and video.";
  } else if (audioContextState === "suspended") {
    gesturePromptMessage = "Audio is paused. Click below to enable sound.";
  } else {
    gesturePromptMessage = "Audio playback was blocked by your browser.";
  }

  // Build the button label
  let gesturePromptButtonLabel;
  if (hasSetupOperations) {
    gesturePromptButtonLabel = "Enable Audio";
  } else if (joinStalled || blurredWhileSuspended) {
    gesturePromptButtonLabel = "Continue";
  } else {
    gesturePromptButtonLabel = "Enable audio";
  }

  return {
    audioPlaybackBlocked,
    pendingGestureOperations,
    pendingOperationDetails,
    setPendingGestureOperations,
    setPendingOperationDetails,
    handleAudioPlayFailed,
    handleEnableAudio,
    handleSetupFailure,
    handleCompleteSetup,
    showGesturePrompt,
    hasSetupOperations,
    gesturePromptMessage,
    gesturePromptButtonLabel,
  };
}
