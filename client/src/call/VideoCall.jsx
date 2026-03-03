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
import { useAutoDiagnostics } from "./hooks/useAutoDiagnostics";
import { useAudioContextMonitor } from "./hooks/useAudioContextMonitor";
import { UserMediaError } from "./UserMediaError";
import { CallBanner } from "./CallBanner";
import {
  useProgressLabel,
  useGetElapsedTime,
} from "../components/progressLabel";
import { findMatchingDevice } from "./utils/deviceAlignment";
import { Modal } from "../components/Modal";

const fatalErrorMessages = {
  "connection-error": {
    title: "Connection lost",
    subtitle: "Your connection to the call was interrupted.",
    showRejoin: true,
  },
  ejected: {
    title: "Removed from call",
    subtitle: "You were removed by the moderator.",
    showRejoin: false,
  },
  "exp-room": {
    title: "Session expired",
    subtitle: "This call session has expired.",
    showRejoin: false,
  },
  "exp-token": {
    title: "Session expired",
    subtitle: "Your meeting token has expired.",
    showRejoin: false,
  },
  "meeting-full": {
    title: "Call is full",
    subtitle: "The call has reached its participant limit.",
    showRejoin: false,
  },
  "not-allowed": {
    title: "Not authorized",
    subtitle: "You are not authorized to join this call.",
    showRejoin: false,
  },
};

function FatalErrorOverlay({ error, onRejoin }) {
  const msg = fatalErrorMessages[error.type] || {
    title: "Call error",
    subtitle: error.message || "An unexpected error occurred.",
    showRejoin: true,
  };

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-xl">
        <h2 className="text-xl font-semibold text-slate-900">{msg.title}</h2>
        <p className="mt-2 text-slate-600">{msg.subtitle}</p>
        {msg.showRejoin && (
          <button
            type="button"
            data-test="rejoinCall"
            onClick={onRejoin}
            className="mt-4 rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
          >
            Rejoin Call
          </button>
        )}
      </div>
    </div>
  );
}

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
    blurredWhileSuspended,
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
  // Join and leave the Daily room when roomUrl changes.
  //
  // ## Firefox Tab Blur Issue (Issue #1187)
  // Firefox suspends WebRTC API calls (including callObject.join()) when the tab
  // is unfocused. This causes the join to hang indefinitely if the user switches
  // tabs before the page finishes loading. When this happens, the user sees
  // "Waiting for participant to connect..." because the join never completes.
  //
  // Solution: Detect when the join is taking too long AND the tab was blurred,
  // then show an overlay prompting the user to click. The click:
  // 1. Focuses the page, allowing the stalled join() to complete
  // 2. Provides a user gesture for AudioContext.resume() if needed
  //
  // The overlay auto-dismisses when the join completes (which happens shortly
  // after the page regains focus).
  const roomUrl = game.get("dailyUrl");
  const joiningMeetingRef = useRef(false);
  // For stall detection (issue #1187) - track if join is taking too long due to blur
  const joinStartTimeRef = useRef(null);
  const blurredDuringJoinRef = useRef(false);
  const [joinStalled, setJoinStalled] = useState(false);

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

    // Track blur events during join to detect stalled joins
    const handleBlurDuringJoin = () => {
      if (joiningMeetingRef.current) {
        blurredDuringJoinRef.current = true;
        // If page blurs during join, show prompt after short delay (not 5s)
        setTimeout(() => {
          if (joiningMeetingRef.current && blurredDuringJoinRef.current) {
            console.warn("[VideoCall] Join stalled - tab blurred during join");
            setJoinStalled(true);
          }
        }, 500);
      }
    };
    window.addEventListener("blur", handleBlurDuringJoin);

    // Fallback stall detection - if join takes > 5s and tab was blurred, prompt user
    const stallTimer = setTimeout(() => {
      if (joiningMeetingRef.current && blurredDuringJoinRef.current) {
        console.warn("[VideoCall] Join appears stalled due to tab blur - prompting user");
        setJoinStalled(true);
      }
    }, 5000);

    const joinRoom = async () => {
      const meetingState = callObject.meetingState?.();
      if (meetingState === "joined-meeting" || joiningMeetingRef.current)
        return;

      const joinStartTime = Date.now();
      joinStartTimeRef.current = joinStartTime;
      // Check if page is ALREADY unfocused when join starts
      const alreadyUnfocused = !document.hasFocus();
      blurredDuringJoinRef.current = alreadyUnfocused;

      // If page is already unfocused, show prompt quickly (Firefox suspends WebRTC when unfocused)
      if (alreadyUnfocused) {
        setTimeout(() => {
          if (joiningMeetingRef.current) {
            console.warn("[VideoCall] Join stalled - page was unfocused at start");
            setJoinStalled(true);
          }
        }, 500);
      }

      joiningMeetingRef.current = true;

      try {
        // Pass position in userData for immediate mapping by other participants
        // (avoids waiting for Empirica sync - see issue #1187)
        const position = player.get("position");
        await callObject.join({
          url: roomUrl,
          // Only include userData if position is defined (may be undefined if player hook hasn't resolved)
          userData: position != null ? { position } : undefined,
        });
        const joinDuration = Date.now() - joinStartTime;
        // Join succeeded - clear stalled state
        setJoinStalled(false);
        blurredDuringJoinRef.current = false;
        console.log("[VideoCall] Joined Daily room", {
          roomUrl,
          durationMs: joinDuration,
          hasFocus: document.hasFocus(),
          visibilityState: document.visibilityState,
        });
        // Flag slow joins for debugging (likely caused by tab blur)
        if (joinDuration > 5000) {
          console.warn("[VideoCall] Slow join detected", {
            durationMs: joinDuration,
            possibleCause: "Tab may have lost focus during join",
          });
        }

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
      clearTimeout(stallTimer);
      window.removeEventListener("blur", handleBlurDuringJoin);

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
  // Priority: permissions > in-use > not-found > constraints > unknown
  // Higher-priority errors should not be overwritten by lower-priority ones.
  const deviceErrorPriority = {
    permissions: 5,
    "in-use": 4,
    "not-found": 3,
    constraints: 2,
  };
  const [deviceError, setDeviceErrorRaw] = useState(null);
  const setDeviceError = useCallback((newError) => {
    if (newError === null) {
      setDeviceErrorRaw(null);
      return;
    }
    setDeviceErrorRaw((prev) => {
      if (!prev) return newError;
      const prevPrio = deviceErrorPriority[prev.dailyErrorType] ?? 1;
      const newPrio = deviceErrorPriority[newError.dailyErrorType] ?? 1;
      // When both camera and mic report the same cause, merge into a combined
      // error (type=null uses the "default" copy which says "Camera and microphone…")
      if (
        prev.dailyErrorType === newError.dailyErrorType &&
        prev.type !== newError.type &&
        prev.type !== null // not already merged
      ) {
        return { ...newError, type: null };
      }
      return newPrio >= prevPrio ? newError : prev;
    });
  }, []);
  const [fatalError, setFatalError] = useState(null);
  const [networkInterrupted, setNetworkInterrupted] = useState(false);
  // permissionRevoked state removed — permission denial from both the
  // Permissions API onchange listener and Daily's camera-error/mic-error
  // now flow through setDeviceError with dailyErrorType: "permissions".

  const handleSwitchDevice = useCallback(
    async (deviceType, deviceId) => {
      if (!callObject || callObject.isDestroyed?.()) return;
      try {
        if (deviceType === "camera") {
          await callObject.setInputDevicesAsync({ videoDeviceId: deviceId });
          player?.set("cameraId", deviceId);
        } else if (deviceType === "microphone") {
          await callObject.setInputDevicesAsync({ audioDeviceId: deviceId });
          player?.set("micId", deviceId);
        }
        setDeviceError(null);
      } catch (err) {
        console.warn("[VideoCall] Failed to switch device:", err);
      }
    },
    [callObject, player]
  );

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
    // Clear join stalled state (issue #1187) - user gesture restores focus
    setJoinStalled(false);
    blurredDuringJoinRef.current = false;

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
      async (ev = {}) => {
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
  }, [callObject]);

  // ------------------- W4: device reconnected auto-recovery ---------------------
  // When a device is unplugged, Daily fires not-found error. If the user plugs a
  // device back in, the browser fires `devicechange`. Listen for this and
  // auto-recover by switching to the newly available device.
  useEffect(() => {
    if (!deviceError || !callObject || callObject.isDestroyed?.()) return undefined;
    if (deviceError.dailyErrorType !== "not-found") return undefined;
    if (!navigator?.mediaDevices) return undefined;

    const handleDeviceChange = async () => {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const isCamera = deviceError.type === "camera-error";
        const relevantDevices = allDevices.filter((d) =>
          isCamera ? d.kind === "videoinput" : d.kind === "audioinput"
        );

        if (relevantDevices.length > 0) {
          const device = relevantDevices[0];
          if (isCamera) {
            await callObject.setInputDevicesAsync({
              videoDeviceId: device.deviceId,
            });
          } else {
            await callObject.setInputDevicesAsync({
              audioDeviceId: device.deviceId,
            });
          }
          setDeviceError(null);
          Sentry.addBreadcrumb({
            category: "device-recovery",
            message: `Device reconnected: auto-switched ${isCamera ? "camera" : "microphone"}`,
            level: "info",
          });
        }
      } catch (err) {
        console.warn("[VideoCall] Device reconnection auto-recovery failed:", err);
      }
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
    };
  }, [deviceError, callObject]);

  // ------------------- W7: proactive track monitoring ---------------------
  // Silently ended tracks (browser killed them, device sleep, etc.) leave the user
  // with frozen video or dead audio and no indication. Poll track readyState and
  // auto-recover by re-acquiring the device.
  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return undefined;

    const POLL_INTERVAL_MS = 5000;

    const checkTracks = async () => {
      try {
        const [audioTrack, videoTrack] = await Promise.all([
          callObject.localAudio?.(),
          callObject.localVideo?.(),
        ]);

        if (audioTrack?.readyState === "ended") {
          Sentry.addBreadcrumb({
            category: "track-monitor",
            message: "Audio track ended — attempting auto-recovery",
            level: "warning",
          });
          await callObject.setInputDevicesAsync({ audioDeviceId: true });
        }

        if (videoTrack?.readyState === "ended") {
          Sentry.addBreadcrumb({
            category: "track-monitor",
            message: "Video track ended — attempting auto-recovery",
            level: "warning",
          });
          await callObject.setInputDevicesAsync({ videoDeviceId: true });
        }
      } catch (err) {
        // Non-critical — don't crash the poll loop
        console.warn("[VideoCall] Track monitor check failed:", err);
      }
    };

    const intervalId = setInterval(checkTracks, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
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
            // Route through the unified device error path so the same
            // UserMediaError UI (with PermissionDeniedGuidance) is shown
            // regardless of whether the denial was detected by the
            // Permissions API or by Daily's camera-error/mic-error event.
            const errorType =
              type === "camera" ? "camera-error" : "mic-error";
            setDeviceError({
              type: errorType,
              message: `${type} permission revoked mid-call`,
              dailyErrorType: "permissions",
              dailyEvent: null, // No Daily event — detected via Permissions API
            });
            Sentry.addBreadcrumb({
              category: "permissions",
              message: `${type} permission revoked mid-call`,
              level: "warning",
            });
          }
          // Note: "granted" state change is handled by UserMediaError's
          // permission monitoring hook, which auto-reloads when permissions
          // flip from denied → granted.
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
  // NOTE: Disabled in component tests (detected via window.mockPlayers) because
  // the blur/focus listeners interfere with Playwright click handling.
  useEffect(() => {
    // Skip visibility tracking in component tests
    if (typeof window !== "undefined" && window.mockPlayers) {
      return undefined;
    }

    const logVisibilityEvent = (eventType, detail = {}) => {
      const entry = {
        event: eventType,
        timestamp: new Date().toISOString(),
        stageElapsed: getElapsedTime(),
        progressLabel: progressLabelRef.current,
        ...detail,
      };
      // Store to player state for analytics (no console log to reduce noise)
      try {
        player.append("visibilityHistory", entry);
      } catch (err) {
        // Silently fail - visibility tracking is non-critical
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

      // Preferred device not found — always show picker so user knows we're
      // switching to a different device than what they expected.
      if (matchType === "fallback") {
        Sentry.captureMessage("Preferred camera not found, showing picker", {
          level: "warning",
          tags: { deviceType: "camera", matchType: "fallback" },
          extra: {
            preferred: {
              id: preferredCameraId,
              label: preferredCameraLabel,
            },
            availableDevices: devices?.cameras?.map((c) => ({
              id: c.device.deviceId,
              label: c.device.label,
            })),
          },
        });
        setDeviceError({
          type: "camera-error",
          message: `Preferred camera "${preferredCameraLabel || preferredCameraId}" not found`,
          dailyErrorType: "not-found",
          dailyEvent: null, // No Daily event — detected during device alignment
        });
        return;
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
        if (devices?.cameras?.[0]) {
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

      // Preferred device not found — always show picker so user knows we're
      // switching to a different device than what they expected.
      if (matchType === "fallback") {
        Sentry.captureMessage("Preferred microphone not found, showing picker", {
          level: "warning",
          tags: { deviceType: "microphone", matchType: "fallback" },
          extra: {
            preferred: {
              id: preferredMicId,
              label: preferredMicLabel,
            },
            availableDevices: devices?.microphones?.map((m) => ({
              id: m.device.deviceId,
              label: m.device.label,
            })),
          },
        });
        setDeviceError({
          type: "mic-error",
          message: `Preferred microphone "${preferredMicLabel || preferredMicId}" not found`,
          dailyErrorType: "not-found",
          dailyEvent: null, // No Daily event — detected during device alignment
        });
        return;
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
        if (devices?.microphones?.[0]) {
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
        <div className="flex-1 overflow-hidden relative">
          <CallBanner visible={networkInterrupted}>
            Reconnecting…
          </CallBanner>
          {fatalError ? (
            <FatalErrorOverlay
              error={fatalError}
              onRejoin={() => {
                setFatalError(null);
                callObject.join({ url: roomUrl });
              }}
            />
          ) : (
            <Call
              showNickname={showNickname}
              showTitle={showTitle}
              showSelfView={showSelfView}
              layout={layout}
              rooms={rooms}
            />
          )}
          <Modal
            isOpen={!!deviceError && !fatalError}
            onClose={() => setDeviceError(null)}
            maxWidth="xl"
          >
            <UserMediaError
              error={deviceError}
              onSwitchDevice={handleSwitchDevice}
            />
          </Modal>
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
      </div>
      <DailyAudio onPlayFailed={handleAudioPlayFailed} />
      {/* Unified setup completion prompt - shows when any operations require user gesture */}
      {/* blurredWhileSuspended/joinStalled: if page lost focus during join/AudioContext, require explicit click */}
      <Modal
        isOpen={Object.values(pendingGestureOperations).some(Boolean) ||
          audioPlaybackBlocked || needsUserInteraction || blurredWhileSuspended || joinStalled}
        maxWidth="sm"
      >
        <div className="text-center">
          {Object.values(pendingGestureOperations).some(Boolean) ? (
            // Speaker or other setup operations need user gesture
            <>
              <p className="mb-4 text-slate-900">
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
              <p className="mb-4 text-slate-900">
                {(() => {
                  if (joinStalled) return "Video connection paused. Click below to continue.";
                  if (blurredWhileSuspended) return "Click below to enable audio and video.";
                  if (audioContextState === "suspended") return "Audio is paused. Click below to enable sound.";
                  return "Audio playback was blocked by your browser.";
                })()}
              </p>
              <button
                type="button"
                onClick={handleEnableAudio}
                className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
              >
                {joinStalled || blurredWhileSuspended ? "Continue" : "Enable audio"}
              </button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
