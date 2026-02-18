import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  DailyAudio,
  useDaily,
  useDevices,
  useLocalSessionId,
} from "@daily-co/daily-react";
import {
  useGame,
  usePlayer,
  useStage,
  useStageTimer,
} from "@empirica/core/player/classic/react";
import * as Sentry from "@sentry/react";

import { Tray } from "./Tray";
import { Call } from "./Call";
import { useDailyEventLogger } from "./hooks/eventLogger";
import { useAutoDiagnostics } from "./useAutoDiagnostics";
import { useAudioContextMonitor } from "./useAudioContextMonitor";
import { UserMediaError } from "./UserMediaError";
import {
  useProgressLabel,
  useGetElapsedTime,
} from "../components/progressLabel";
import { findMatchingDevice } from "./utils/deviceAlignment";

export function VideoCall({
  showNickname,
  showTitle,
  showSelfView = true,
  showReportMissing = true,
  showAudioMute = true,
  showVideoMute = true,
  layout,
  rooms,
}) {
  // ------------------- load Empirica + Daily context ---------------------
  const game = useGame();
  const player = usePlayer();
  const callObject = useDaily();
  const stage = useStage();
  const stageTimer = useStageTimer();

  useDailyEventLogger();

  // ------------------- monitor AudioContext state for autoplay debugging ---------------------
  // Browsers (especially Safari) may suspend AudioContext due to autoplay policies.
  // This hook monitors AudioContext state and provides controls to resume it.
  const {
    audioContextState,
    needsUserInteraction,
    resumeAudioContext,
    audioContext,
  } = useAudioContextMonitor();

  // ------------------- auto-respond to diagnostic requests from roommates ---------------------
  // When another participant reports an A/V issue, they may request diagnostics from us.
  // This hook listens for those requests and automatically sends our diagnostic data to Sentry.
  useAutoDiagnostics(audioContext);

  // ------------------- mirror Nickname into the Daily room ---------------------
  // Set display name in Daily call based on previously set player name/title.
  let displayName = "";
  if (showNickname && player.get("name")) {
    displayName += player.get("name");
  }
  if (showTitle && player.get("title")) {
    if (displayName) {
      displayName += " - ";
    }
    displayName += player.get("title");
  }
  if (!displayName) {
    displayName = `Participant ${player.get("position")}`;
  }

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return;
    try {
      callObject.setUserName(displayName);
    } catch (err) {
      console.warn("Failed to set Daily username", err);
    }
  }, [callObject, displayName]);

  // ------------------- remember player Daily IDs for layout + UI ---------------------
  // Store Daily ID in player data for later matching with video feeds
  // and for displaying participant lists by position.
  // We also strictly log the association between dailyId, progressLabel, and time.
  const dailyId = useLocalSessionId();
  const progressLabel = useProgressLabel();
  const getElapsedTime = useGetElapsedTime();
  const stageElapsed = (stageTimer?.elapsed || 0) / 1000;

  // Store progressLabel in ref so event handlers always access current value
  // (getElapsedTime is now stable and always returns current values from ProgressLabelContext)
  const progressLabelRef = useRef(progressLabel);
  progressLabelRef.current = progressLabel;

  useEffect(() => {
    if (!dailyId) return;

    // 1. Maintain simple list and current ID (legacy/display usage)
    // This is needed for video feed matching, so set it immediately
    if (player.get("dailyId") !== dailyId) {
      player.set("dailyId", dailyId); // for matching with videos later
      player.append("dailyIds", dailyId); // for displaying by position
    }

    // 2. Log structured history for science data
    // We'll log when "joined-meeting" event fires (see separate useEffect below)
  }, [dailyId, player]);

  // Log dailyIdHistory when we actually join the meeting
  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return undefined;

    const logDailyIdHistory = () => {
      const currentDailyId = dailyId;
      const currentProgressLabel = progressLabelRef.current; // Always current via ref

      if (!currentDailyId) return;

      // Avoid duplicate entries
      const history = player.get("dailyIdHistory") || [];
      const lastEntry = history[history.length - 1];

      if (
        lastEntry &&
        lastEntry.dailyId === currentDailyId &&
        lastEntry.progressLabel === currentProgressLabel
      ) {
        return; // Already logged this dailyId + progressLabel
      }

      try {
        player.append("dailyIdHistory", {
          dailyId: currentDailyId,
          progressLabel: currentProgressLabel,
          stageElapsed: getElapsedTime(), // Stable function, always returns current time
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Failed to log dailyIdHistory:", err);
      }
    };

    // Set up event listener for future joins
    callObject.on("joined-meeting", logDailyIdHistory);

    // Also check if we're already joined (catch race condition)
    const currentState = callObject.meetingState?.();
    if (currentState === "joined-meeting") {
      logDailyIdHistory();
    }

    return () => {
      callObject.off("joined-meeting", logDailyIdHistory);
    };
    // Note: progressLabel and getElapsedTime are intentionally NOT in dependencies.
    // - progressLabel: We only want to log when joining a new Daily session (dailyId changes),
    //   not when progressLabel changes within the same session. We access the current value
    //   via progressLabelRef when the event fires.
    // - getElapsedTime: Stable function from ProgressLabelContext that always returns current
    //   elapsed time via internal refs. Never recreated, so no need in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callObject, dailyId, player]);

  // ------------------- manage room joins/leaves ---------------------
  // Join and leave the Daily room when roomUrl changes
  const roomUrl = game.get("dailyUrl");
  const joiningMeetingRef = useRef(false);

  useEffect(() => {
    if (roomUrl) return undefined; // URL arrived — nothing to warn about
    // Delay the warning to avoid firing during the brief window between the game
    // starting and the server finishing the async createRoom() call.
    const timer = setTimeout(() => {
      console.warn(
        "[VideoCall] No Daily room URL after 5 s (game.get('dailyUrl') is still empty).",
        "In a test environment, check that DAILY_APIKEY is configured on the server.",
        "In production, the server may have failed to create the Daily room."
      );
    }, 5000);
    return () => clearTimeout(timer);
  }, [roomUrl]);

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.() || !roomUrl) return undefined;
    // `roomUrl` is only populated when the batch config had checkVideo/checkAudio enabled.
    // When both flags are false we skip Daily entirely (handy for layout demos), so this
    // effect bails before trying to join a non-existent room.

    const joinRoom = async () => {
      const meetingState = callObject.meetingState?.();
      if (meetingState === "joined-meeting" || joiningMeetingRef.current)
        return;

      console.log("Trying to join Daily room:", roomUrl);
      joiningMeetingRef.current = true;

      try {
        await callObject.join({ url: roomUrl });
        console.log("Joined Daily room:", roomUrl);

        // TEMP: Disable autoGainControl to test if it's causing quiet audio issues.
        // Keep echo cancellation and noise suppression enabled.
        // See: https://docs.daily.co/reference/daily-js/instance-methods/set-input-devices-async
        try {
          await callObject.setInputDevicesAsync({
            audioSource: {
              autoGainControl: false,
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
          console.log("Disabled AGC via setInputDevicesAsync");
        } catch (agcErr) {
          console.warn("Failed to disable AGC:", agcErr);
        }
      } catch (err) {
        console.error("Error joining Daily room", roomUrl, err);
      } finally {
        joiningMeetingRef.current = false;
      }
    };

    joinRoom(); // in a function to allow async/await

    return () => {
      // cleanup on unmount or roomUrl change
      if (!callObject || callObject.isDestroyed?.()) return;
      const state = callObject.meetingState?.();

      if (
        // state === "joining" ||
        state === "joined-meeting" ||
        state === "loaded"
      ) {
        // only leave if we are in the process of joining or already joined
        console.log("Leaving Daily room");
        callObject.leave();
      }
    };
  }, [callObject, roomUrl]);

  // ------------------- signal server when the call begins ---------------------
  // Signal the server to start recording when we have joined the call.

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
      // Daily may emit joined-meeting before Empirica gives us a stage object;
      // (happens because the join happens immediately when the stage starts)
      // remember the intent and retry once stage is ready rather than dropping
      // the recording trigger entirely.

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

  // ------------------- capture device permission failures ---------------------
  const [deviceError, setDeviceError] = useState(null);

  // ------------------- handle audio playback failures ---------------------
  // Browsers may block audio playback until user interacts with the page.
  // This can happen after tab switches or due to autoplay policies.
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);

  // ------------------- track operations requiring user gesture ---------------------
  // Safari and some browsers require user gestures for certain operations (setSinkId, AudioContext resume).
  // Track which operations failed and need a user gesture to retry.
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

    // Resume the AudioContext (requires user gesture)
    resumeAudioContext().catch((err) => {
      console.error("[Audio] Failed to resume AudioContext:", err);
    });
  }, [resumeAudioContext]);

  // ------------------- handle setup operations requiring user gesture ---------------------
  const handleSetupFailure = useCallback((operation, error, details) => {
    if (error?.name === "NotAllowedError" || error?.message?.includes("user gesture")) {
      console.warn(`[Setup] ${operation} requires user gesture:`, error.message);

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
          browser: navigator.userAgent,
        },
        extra: { error: error?.message, details },
      });
    }
  }, []);

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return undefined;

    const handleDeviceError =
      (type) =>
      (ev = {}) => {
        const rawMessage =
          typeof ev.errorMsg === "string"
            ? ev.errorMsg
            : ev?.errorMsg?.message || ev?.error?.message;

        // Extract Daily's error type (e.g., "not-found", "permissions", "in-use", "constraints")
        const dailyErrorType =
          ev?.error?.type || ev?.errorMsg?.type || ev?.type;

        setDeviceError({
          type,
          message: rawMessage || null,
          dailyErrorType: dailyErrorType || null,
          dailyEvent: ev, // Preserve the full Daily event for diagnosis
        });
      };

    const fatalHandler = handleDeviceError("fatal-devices-error");
    const cameraHandler = handleDeviceError("camera-error");
    const micHandler = handleDeviceError("mic-error");

    callObject.on("fatal-devices-error", fatalHandler);
    callObject.on("camera-error", cameraHandler);
    callObject.on("mic-error", micHandler);

    return () => {
      callObject.off("fatal-devices-error", fatalHandler);
      callObject.off("camera-error", cameraHandler);
      callObject.off("mic-error", micHandler);
    };
  }, [callObject]);

  // ------------------- monitor browser permissions during call ---------------------
  // Users can revoke permissions mid-call (accidentally or intentionally), and browsers
  // can auto-revoke permissions for inactive tabs. Detect this immediately so it appears
  // in Sentry breadcrumbs when users report AV issues.
  useEffect(() => {
    if (!navigator.permissions) return undefined;

    let camPerm = null;
    let micPerm = null;

    const monitorPermissions = async () => {
      try {
        [camPerm, micPerm] = await Promise.all([
          navigator.permissions.query({ name: "camera" }),
          navigator.permissions.query({ name: "microphone" }),
        ]);

        const handlePermChange = (type, permObj) => () => {
          console.warn(
            `[Permissions] ${type} permission changed to: ${permObj.state}`
          );

          if (permObj.state === "denied") {
            console.error(
              `[Permissions] ${type} permission DENIED during call!`
            );
            // This will appear in Sentry breadcrumbs when users report issues
          }
        };

        camPerm.onchange = handlePermChange("camera", camPerm);
        micPerm.onchange = handlePermChange("microphone", micPerm);
      } catch (err) {
        console.warn("[Permissions] Cannot monitor permission changes:", err);
      }
    };

    monitorPermissions();

    return () => {
      // Clean up permission listeners to prevent memory leaks
      if (camPerm) camPerm.onchange = null;
      if (micPerm) micPerm.onchange = null;
    };
  }, []);

  // ------------------- track page visibility/focus for debugging ---------------------
  // Firefox may suspend media API calls when tab loses focus. Track these events
  // to correlate with connection issues (issue #1187).
  useEffect(() => {
    const logVisibilityEvent = (eventType, detail = {}) => {
      const entry = {
        event: eventType,
        timestamp: new Date().toISOString(),
        stageElapsed: getElapsedTime(),
        progressLabel: progressLabelRef.current,
        ...detail,
      };
      console.log(`[Visibility] ${eventType}`, entry);
      try {
        player.append("visibilityHistory", entry);
      } catch (err) {
        console.warn("Failed to log visibilityHistory:", err);
      }
    };

    const handleVisibilityChange = () => {
      logVisibilityEvent(document.hidden ? "hidden" : "visible", {
        visibilityState: document.visibilityState,
      });
    };

    const handleFocus = () => {
      logVisibilityEvent("focus");
    };

    const handleBlur = () => {
      logVisibilityEvent("blur");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    // Log initial state
    logVisibilityEvent("mount", {
      visibilityState: document.visibilityState,
      hasFocus: document.hasFocus(),
    });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, [player, getElapsedTime]);

  // ------------------- align Daily devices with Empirica preferences ---------------------
  // Make sure that we're using the input devices we selected in the setup stage.
  // This is a bit tricky because the device lists may not be immediately
  // available, and we also need to handle the case where a user has
  // selected a device that is not actually available (anymore).
  // The logic below tries to handle these cases gracefully, but there
  // may still be edge cases that are not covered.
  const devices = useDevices();
  const preferredCameraId = player?.get("cameraId") ?? "waiting";
  const preferredMicId = player?.get("micId") ?? "waiting";
  const preferredSpeakerId = player?.get("speakerId") ?? "waiting";
  // Labels help match devices when Safari rotates device IDs
  const preferredCameraLabel = player?.get("cameraLabel") ?? null;
  const preferredMicLabel = player?.get("micLabel") ?? null;
  const preferredSpeakerLabel = player?.get("speakerLabel") ?? null;
  const updatingMicRef = useRef(false);
  const updatingCameraRef = useRef(false);
  const updatingSpeakerRef = useRef(false);
  // Track devices we've already logged as unavailable to prevent log spam
  const loggedUnavailableCameraRef = useRef(null);
  const loggedUnavailableMicRef = useRef(null);
  const loggedUnavailableSpeakerRef = useRef(null);

  // Unified handler to complete all pending setup operations in one user gesture
  const handleCompleteSetup = useCallback(async () => {
    console.log("[Setup] Completing setup with user gesture");
    const operations = [];
    const operationNames = [];

    // Batch all pending operations
    if (pendingGestureOperations.speaker && pendingOperationDetails.speaker) {
      operationNames.push("speaker");
      operations.push(
        devices.setSpeaker(pendingOperationDetails.speaker.speakerId)
          .then(() => {
            console.log("[Setup] Speaker set successfully via user gesture");
            setPendingGestureOperations((prev) => ({ ...prev, speaker: false }));
            setPendingOperationDetails((prev) => ({ ...prev, speaker: null }));
          })
          .catch((err) => {
            console.error("[Setup] Failed to set speaker even with user gesture:", err);
            throw new Error(`Speaker: ${err.message}`);
          })
      );
    }

    if (pendingGestureOperations.audioContext || needsUserInteraction) {
      operationNames.push("audioContext");
      operations.push(
        resumeAudioContext()
          .then(() => {
            console.log("[Setup] AudioContext resumed successfully via user gesture");
            setPendingGestureOperations((prev) => ({ ...prev, audioContext: false }));
            setPendingOperationDetails((prev) => ({ ...prev, audioContext: null }));
          })
          .catch((err) => {
            console.error("[Setup] Failed to resume AudioContext even with user gesture:", err);
            throw new Error(`AudioContext: ${err.message}`);
          })
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

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return;

    // Wait for device lists to be populated before trying to align
    const camerasLoaded = devices?.cameras && devices.cameras.length > 0;
    const microphonesLoaded =
      devices?.microphones && devices.microphones.length > 0;

    const alignCamera = async () => {
      // Use utility to find best matching device (ID → label → fallback)
      const result = findMatchingDevice(
        devices?.cameras,
        preferredCameraId,
        preferredCameraLabel
      );
      if (!result) return;

      const { device: targetCamera, matchType } = result;
      const targetId = targetCamera.device.deviceId;

      // Skip if we're already using this device
      if (devices?.currentCam?.device?.deviceId === targetId) return;

      // Log device alignment for analytics
      Sentry.addBreadcrumb({
        category: "device-alignment",
        message: `Camera aligned via ${matchType} match`,
        level: matchType === "fallback" ? "warning" : "info",
        data: {
          deviceType: "camera",
          matchType,
          preferredId: preferredCameraId,
          preferredLabel: preferredCameraLabel,
          actualId: targetId,
          actualLabel: targetCamera.device.label,
        },
      });

      // Alert if preferred device not found (fallback used)
      if (matchType === "fallback") {
        Sentry.captureMessage("Preferred camera not found, using fallback", {
          level: "warning",
          tags: { deviceType: "camera", matchType: "fallback" },
          extra: {
            preferred: {
              id: preferredCameraId,
              label: preferredCameraLabel,
            },
            fallback: {
              id: targetId,
              label: targetCamera.device.label,
            },
            availableDevices: devices?.cameras?.map((c) => ({
              id: c.device.deviceId,
              label: c.device.label,
            })),
          },
        });
      }

      console.log(`Setting camera via ${matchType} match`, {
        preferredCameraId,
        preferredCameraLabel,
        targetId,
        targetLabel: targetCamera.device.label,
        matchType,
      });
      loggedUnavailableCameraRef.current = null;
      updatingCameraRef.current = true;
      try {
        if (!callObject.isDestroyed?.()) {
          await callObject.setInputDevicesAsync({
            videoDeviceId: targetId,
          });
        }
      } catch (err) {
        console.error(`Failed to set camera via ${matchType} match`, err);
        // If we failed on a non-fallback match, try the fallback device
        if (matchType !== "fallback" && devices?.cameras?.[0]) {
          const fallbackId = devices.cameras[0].device.deviceId;
          console.log("Retrying with fallback camera", {
            fallbackId,
            fallbackLabel: devices.cameras[0].device.label,
          });
          try {
            if (!callObject.isDestroyed?.()) {
              await callObject.setInputDevicesAsync({
                videoDeviceId: fallbackId,
              });
            }
          } catch (fallbackErr) {
            console.error("Fallback camera also failed", fallbackErr);
          }
        }
      } finally {
        updatingCameraRef.current = false;
      }
    };

    const alignMic = async () => {
      // Use utility to find best matching device (ID → label → fallback)
      const result = findMatchingDevice(
        devices?.microphones,
        preferredMicId,
        preferredMicLabel
      );
      if (!result) return;

      const { device: targetMic, matchType } = result;
      const targetId = targetMic.device.deviceId;

      // Skip if we're already using this device
      if (devices?.currentMic?.device?.deviceId === targetId) return;

      // Log device alignment for analytics
      Sentry.addBreadcrumb({
        category: "device-alignment",
        message: `Microphone aligned via ${matchType} match`,
        level: matchType === "fallback" ? "warning" : "info",
        data: {
          deviceType: "microphone",
          matchType,
          preferredId: preferredMicId,
          preferredLabel: preferredMicLabel,
          actualId: targetId,
          actualLabel: targetMic.device.label,
        },
      });

      // Alert if preferred device not found (fallback used)
      if (matchType === "fallback") {
        Sentry.captureMessage("Preferred microphone not found, using fallback", {
          level: "warning",
          tags: { deviceType: "microphone", matchType: "fallback" },
          extra: {
            preferred: {
              id: preferredMicId,
              label: preferredMicLabel,
            },
            fallback: {
              id: targetId,
              label: targetMic.device.label,
            },
            availableDevices: devices?.microphones?.map((m) => ({
              id: m.device.deviceId,
              label: m.device.label,
            })),
          },
        });
      }

      console.log(`Setting microphone via ${matchType} match`, {
        preferredMicId,
        preferredMicLabel,
        targetId,
        targetLabel: targetMic.device.label,
        matchType,
      });
      loggedUnavailableMicRef.current = null;
      updatingMicRef.current = true;
      try {
        if (!callObject.isDestroyed?.()) {
          await callObject.setInputDevicesAsync({
            audioDeviceId: targetId,
          });
        }
      } catch (err) {
        console.error(`Failed to set microphone via ${matchType} match`, err);
        // If we failed on a non-fallback match, try the fallback device
        if (matchType !== "fallback" && devices?.microphones?.[0]) {
          const fallbackId = devices.microphones[0].device.deviceId;
          console.log("Retrying with fallback microphone", {
            fallbackId,
            fallbackLabel: devices.microphones[0].device.label,
          });
          try {
            if (!callObject.isDestroyed?.()) {
              await callObject.setInputDevicesAsync({
                audioDeviceId: fallbackId,
              });
            }
          } catch (fallbackErr) {
            console.error("Fallback microphone also failed", fallbackErr);
          }
        }
      } finally {
        updatingMicRef.current = false;
      }
    };

    const alignSpeaker = async () => {
      // Use utility to find best matching device (ID → label → fallback)
      const result = findMatchingDevice(
        devices?.speakers,
        preferredSpeakerId,
        preferredSpeakerLabel
      );
      if (!result) return;

      const { device: targetSpeaker, matchType } = result;
      const targetId = targetSpeaker.device.deviceId;

      // Skip if we're already using this device
      if (devices?.currentSpeaker?.device?.deviceId === targetId) return;

      // Log device alignment for analytics
      Sentry.addBreadcrumb({
        category: "device-alignment",
        message: `Speaker aligned via ${matchType} match`,
        level: matchType === "fallback" ? "warning" : "info",
        data: {
          deviceType: "speaker",
          matchType,
          preferredId: preferredSpeakerId,
          preferredLabel: preferredSpeakerLabel,
          actualId: targetId,
          actualLabel: targetSpeaker.device.label,
        },
      });

      // Alert if preferred device not found (fallback used)
      if (matchType === "fallback") {
        Sentry.captureMessage("Preferred speaker not found, using fallback", {
          level: "warning",
          tags: { deviceType: "speaker", matchType: "fallback" },
          extra: {
            preferred: {
              id: preferredSpeakerId,
              label: preferredSpeakerLabel,
            },
            fallback: {
              id: targetId,
              label: targetSpeaker.device.label,
            },
            availableDevices: devices?.speakers?.map((s) => ({
              id: s.device.deviceId,
              label: s.device.label,
            })),
          },
        });
      }

      console.log(`Setting speaker via ${matchType} match`, {
        preferredSpeakerId,
        preferredSpeakerLabel,
        targetId,
        targetLabel: targetSpeaker.device.label,
        matchType,
      });
      loggedUnavailableSpeakerRef.current = null;
      updatingSpeakerRef.current = true;
      try {
        if (!callObject.isDestroyed?.()) {
          // Daily uses setOutputDeviceAsync for speakers (audio output)
          await devices.setSpeaker(targetId);
          // Success - clear any pending state for this operation
          setPendingGestureOperations((prev) => ({ ...prev, speaker: false }));
          setPendingOperationDetails((prev) => ({ ...prev, speaker: null }));
        }
      } catch (err) {
        console.error(`Failed to set speaker via ${matchType} match`, err);

        // Check if this is a gesture requirement error (Safari setSinkId)
        if (err?.name === "NotAllowedError" || err?.message?.includes("user gesture")) {
          handleSetupFailure("speaker", err, {
            speakerId: targetId,
            speakerLabel: targetSpeaker.device.label,
          });
        } else if (matchType !== "fallback" && devices?.speakers?.[0]) {
          // If we failed on a non-fallback match for other reasons, try the fallback device
          const fallbackId = devices.speakers[0].device.deviceId;
          console.log("Retrying with fallback speaker", {
            fallbackId,
            fallbackLabel: devices.speakers[0].device.label,
          });
          try {
            await devices.setSpeaker(fallbackId);
            // Success - clear any pending state
            setPendingGestureOperations((prev) => ({ ...prev, speaker: false }));
            setPendingOperationDetails((prev) => ({ ...prev, speaker: null }));
          } catch (fallbackErr) {
            console.error("Fallback speaker also failed", fallbackErr);
            // Check if fallback also needs gesture
            if (
              fallbackErr?.name === "NotAllowedError" ||
              fallbackErr?.message?.includes("user gesture")
            ) {
              handleSetupFailure("speaker", fallbackErr, {
                speakerId: fallbackId,
                speakerLabel: devices.speakers[0].device.label,
              });
            }
          }
        }
      } finally {
        updatingSpeakerRef.current = false;
      }
    };

    const speakersLoaded = devices?.speakers && devices.speakers.length > 0;

    if (
      camerasLoaded &&
      preferredCameraId !== "waiting" &&
      updatingCameraRef.current === false &&
      devices?.currentCam?.device?.deviceId !== preferredCameraId
    )
      alignCamera();

    if (
      microphonesLoaded &&
      preferredMicId !== "waiting" &&
      updatingMicRef.current === false &&
      devices?.currentMic?.device?.deviceId !== preferredMicId
    )
      alignMic();

    if (
      speakersLoaded &&
      preferredSpeakerId !== "waiting" &&
      updatingSpeakerRef.current === false &&
      devices?.currentSpeaker?.device?.deviceId !== preferredSpeakerId
    )
      alignSpeaker();
  }, [
    callObject,
    devices,
    preferredCameraId,
    preferredMicId,
    preferredSpeakerId,
    preferredCameraLabel,
    preferredMicLabel,
    preferredSpeakerLabel,
    devices?.currentCam?.device?.deviceId,
    devices?.currentMic?.device?.deviceId,
    devices?.currentSpeaker?.device?.deviceId,
    handleSetupFailure,
  ]);

  // ------------------- render call surface + tray ---------------------
  // On narrow layouts (< md) the discussion column stacks vertically, so ensure
  // we keep some vertical space reserved for the call; larger breakpoints can
  // continue to stretch based on the surrounding flex layout.

  return (
    <div className="flex h-full w-full flex-col min-h-[320px] md:min-h-0">
      <div className="flex h-full w-full flex-1 flex-col overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950/30 shadow-lg">
        {deviceError ? (
          <UserMediaError error={deviceError} />
        ) : (
          <>
            <div className="flex-1 overflow-hidden">
              <Call
                showNickname={showNickname}
                showTitle={showTitle}
                showSelfView={showSelfView}
                layout={layout}
                rooms={rooms}
              />
            </div>
            <Tray
              showReportMissing={showReportMissing}
              showAudioMute={showAudioMute}
              showVideoMute={showVideoMute}
              player={player}
              stageElapsed={stageElapsed}
              progressLabel={progressLabel}
              audioContext={audioContext}
              resumeAudioContext={resumeAudioContext}
              roomUrl={roomUrl}
            />
          </>
        )}
      </div>
      <DailyAudio onPlayFailed={handleAudioPlayFailed} />
      {/* DEBUG: Log overlay condition for issue #1187 */}
      {(() => {
        const shouldShow = Object.values(pendingGestureOperations).some(Boolean) ||
          audioPlaybackBlocked || needsUserInteraction;
        console.log('[DEBUG overlay]', {
          pendingGestureOperations,
          audioPlaybackBlocked,
          needsUserInteraction,
          audioContextState,
          shouldShow,
        });
        return null;
      })()}
      {/* Unified setup completion prompt - shows when any operations require user gesture */}
      {(Object.values(pendingGestureOperations).some(Boolean) ||
        (audioPlaybackBlocked || needsUserInteraction)) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-sm rounded-lg bg-slate-800 p-6 text-center shadow-xl">
            {Object.values(pendingGestureOperations).some(Boolean) ? (
              // Speaker or other setup operations need user gesture
              <>
                <p className="mb-4 text-white">
                  Click below to enable audio.
                </p>
                <button
                  type="button"
                  onClick={handleCompleteSetup}
                  className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
                >
                  Enable Audio
                </button>
              </>
            ) : (
              // Fallback to simple audio-only prompt
              <>
                <p className="mb-4 text-white">
                  {audioContextState === "suspended"
                    ? "Audio is paused. Click below to enable sound."
                    : "Audio playback was blocked by your browser."}
                </p>
                <button
                  type="button"
                  onClick={handleEnableAudio}
                  className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
                >
                  Enable audio
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
