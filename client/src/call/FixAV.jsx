import React, { useCallback, useState } from "react";
import * as Sentry from "@sentry/react";
import { useDaily, useLocalSessionId, useDevices } from "@daily-co/daily-react";
import { usePlayers } from "@empirica/core/player/classic/react";
import { Button } from "../components/Button";
import { latestDesiredSubscriptions, currentRoomPositions } from "./Call";
import {
  diagnoseIssues,
  attemptSoftFixes,
  validateFixes,
  generateRecoverySummary,
} from "./utils/avRecovery";
import { findMatchingDevice } from "./utils/deviceAlignment";

/**
 * Collects comprehensive diagnostic data for A/V troubleshooting.
 *
 * This function gathers:
 * - Daily participant states and track subscriptions
 * - Audio device information (input/output)
 * - Network statistics
 * - Browser AudioContext state
 * - Browser permission states
 * - Local media transmission state (whether mic/camera tracks are enabled and flowing)
 * - Device alignment (whether preferred devices match actual devices in use)
 *
 * @param {Object} callObject - Daily call object
 * @param {string} localSessionId - Current participant's Daily session ID
 * @param {Object} player - Empirica player object (optional, for device alignment check)
 * @param {AudioContext} audioContext - Shared AudioContext instance (optional)
 * @returns {Promise<Object>} Diagnostic data object
 */
export async function collectAVDiagnostics(
  callObject,
  localSessionId,
  player = null,
  audioContext = null
) {
  // Capture current state for debugging
  const participants = callObject?.participants?.() || {};
  const participantSummary = Object.entries(participants).map(([id, p]) => ({
    id: id.slice(0, 8),
    local: p.local,
    owner: p.owner,
    permissions: p.permissions,
    audio: {
      subscribed: p.tracks?.audio?.subscribed,
      state: p.tracks?.audio?.state,
      off: p.tracks?.audio?.off, // reason track is off (e.g., "user", "bandwidth")
      blocked: p.tracks?.audio?.blocked, // browser blocked playback
    },
    video: {
      subscribed: p.tracks?.video?.subscribed,
      state: p.tracks?.video?.state,
      off: p.tracks?.video?.off,
      blocked: p.tracks?.video?.blocked,
    },
  }));

  // Convert desired subscriptions Map to a plain object for Sentry.
  // The Map stores what tracks SHOULD be subscribed based on layout,
  // which helps diagnose mismatches between desired and actual state.
  const desiredSubscriptions = Object.fromEntries(
    latestDesiredSubscriptions.current || new Map()
  );

  // Get audio device info (input from Daily, output from browser)
  let audioDevices = null;
  try {
    const inputDevices = callObject?.getInputDevices?.();
    const browserDevices = await navigator.mediaDevices?.enumerateDevices();
    const audioOutputs = browserDevices?.filter(
      (d) => d.kind === "audiooutput"
    );
    audioDevices = {
      currentMic: inputDevices?.mic || null,
      currentCamera: inputDevices?.camera || null,
      audioOutputCount: audioOutputs?.length || 0,
      audioOutputs: audioOutputs?.map((d) => ({
        label: d.label || "Unknown",
        idSuffix: d.deviceId?.slice(-6) || "unknown",
      })),
    };
  } catch (err) {
    audioDevices = { error: err?.message || String(err) };
  }

  // Get network stats for quality diagnosis
  let networkStats = null;
  try {
    networkStats = await callObject?.getNetworkStats?.();
  } catch (err) {
    networkStats = { error: err?.message || String(err) };
  }

  // Check AudioContext state (suspended = autoplay blocked)
  let audioContextState = "unknown";
  try {
    if (audioContext) {
      audioContextState = audioContext.state;
    } else {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        audioContextState = ctx.state;
        ctx.close().catch(() => {});
      }
    }
  } catch (err) {
    audioContextState = `error: ${err?.message || String(err)}`;
  }

  // Check browser permissions state
  let browserPermissions = null;
  try {
    if (navigator.permissions) {
      const [camPerm, micPerm] = await Promise.all([
        navigator.permissions.query({ name: "camera" }).catch(() => null),
        navigator.permissions.query({ name: "microphone" }).catch(() => null),
      ]);
      browserPermissions = {
        camera: camPerm?.state || "unknown",
        microphone: micPerm?.state || "unknown",
      };
    }
  } catch (err) {
    browserPermissions = { error: err?.message || String(err) };
  }

  // Check if we're actively transmitting local media
  // This helps diagnose WebRTC autoplay exemption (active capture allows AudioContext)
  let localMediaState = null;
  try {
    const localAudio = await callObject?.localAudio?.();
    const localVideo = await callObject?.localVideo?.();
    localMediaState = {
      audioTrack: localAudio
        ? {
            enabled: localAudio.enabled,
            muted: localAudio.muted,
            readyState: localAudio.readyState, // "live" or "ended"
          }
        : null,
      videoTrack: localVideo
        ? {
            enabled: localVideo.enabled,
            muted: localVideo.muted,
            readyState: localVideo.readyState,
          }
        : null,
    };
  } catch (err) {
    localMediaState = { error: err?.message || String(err) };
  }

  // Check device alignment (whether preferred devices match actual devices in use)
  // This helps diagnose issues where device IDs become unavailable after page reload
  // We also check label matching since Safari rotates device IDs but labels stay consistent
  let deviceAlignment = null;
  try {
    const preferredCameraId = player?.get?.("cameraId");
    const preferredMicId = player?.get?.("micId");
    const preferredSpeakerId = player?.get?.("speakerId");
    const preferredCameraLabel = player?.get?.("cameraLabel");
    const preferredMicLabel = player?.get?.("micLabel");
    const preferredSpeakerLabel = player?.get?.("speakerLabel");
    const inputDevices = callObject?.getInputDevices?.();
    const outputDevices = callObject?.getOutputDevices?.();

    deviceAlignment = {
      camera: {
        preferredId: preferredCameraId || null,
        preferredLabel: preferredCameraLabel || null,
        currentId: inputDevices?.camera?.deviceId || null,
        currentLabel: inputDevices?.camera?.label || null,
        matchedById:
          preferredCameraId && inputDevices?.camera?.deviceId
            ? preferredCameraId === inputDevices.camera.deviceId
            : null,
        matchedByLabel:
          preferredCameraLabel && inputDevices?.camera?.label
            ? preferredCameraLabel === inputDevices.camera.label
            : null,
      },
      microphone: {
        preferredId: preferredMicId || null,
        preferredLabel: preferredMicLabel || null,
        currentId: inputDevices?.mic?.deviceId || null,
        currentLabel: inputDevices?.mic?.label || null,
        matchedById:
          preferredMicId && inputDevices?.mic?.deviceId
            ? preferredMicId === inputDevices.mic.deviceId
            : null,
        matchedByLabel:
          preferredMicLabel && inputDevices?.mic?.label
            ? preferredMicLabel === inputDevices.mic.label
            : null,
      },
      speaker: {
        preferredId: preferredSpeakerId || null,
        preferredLabel: preferredSpeakerLabel || null,
        currentId: outputDevices?.speaker?.deviceId || null,
        currentLabel: outputDevices?.speaker?.label || null,
        matchedById:
          preferredSpeakerId && outputDevices?.speaker?.deviceId
            ? preferredSpeakerId === outputDevices.speaker.deviceId
            : null,
        matchedByLabel:
          preferredSpeakerLabel && outputDevices?.speaker?.label
            ? preferredSpeakerLabel === outputDevices.speaker.label
            : null,
      },
    };
  } catch (err) {
    deviceAlignment = { error: err?.message || String(err) };
  }
  return {
    participants: participantSummary,
    desiredSubscriptions,
    meetingState: callObject?.meetingState?.(),
    localSessionId,
    audioDevices,
    networkStats,
    audioContextState,
    browserPermissions,
    localMediaState,
    deviceAlignment,
  };
}

/**
 * Modal state machine:
 * - 'select' - User is selecting issues
 * - 'diagnosing' - Running diagnosis and attempting soft fixes
 * - 'success' - Fix succeeded
 * - 'partial' - Some fixes worked, others didn't
 * - 'failed' - Soft fixes failed, offer escalation options
 * - 'unfixable' - Issue is on other participant's side or requires manual action
 */

/**
 * Hook for reporting audio/video issues with intelligent diagnosis and targeted fixes.
 *
 * Instead of immediately reloading the page, this hook:
 * 1. Collects diagnostic data
 * 2. Diagnoses likely root causes based on reported issues
 * 3. Attempts targeted soft fixes (e.g., resume AudioContext, re-acquire device)
 * 4. Validates whether the fixes worked
 * 5. Shows appropriate feedback and escalation options if needed
 *
 * This approach avoids unnecessary page reloads which can cause issues like
 * Safari device ID rotation and disruptive UX.
 *
 * @see https://github.com/Watts-Lab/deliberation-empirica/issues/1166
 */
export function useFixAV(
  player,
  stageElapsed,
  progressLabel,
  audioContext = null,
  resumeAudioContext = null
) {
  const callObject = useDaily();
  const localSessionId = useLocalSessionId();
  const players = usePlayers();
  const devices = useDevices();
  const [showFixModal, setShowFixModal] = useState(false);
  const [selectedIssues, setSelectedIssues] = useState([]);
  const [modalState, setModalState] = useState("select"); // 'select' | 'diagnosing' | 'success' | 'partial' | 'failed' | 'unfixable'
  const [recoverySummary, setRecoverySummary] = useState(null);
  const [diagnosedCauses, setDiagnosedCauses] = useState([]);

  const openFixAV = useCallback(() => {
    setShowFixModal(true);
    setSelectedIssues([]);
    setModalState("select");
    setRecoverySummary(null);
    setDiagnosedCauses([]);
  }, []);

  const toggleIssue = useCallback((issueValue) => {
    setSelectedIssues((prev) =>
      prev.includes(issueValue)
        ? prev.filter((v) => v !== issueValue)
        : [...prev, issueValue]
    );
  }, []);

  const handleSubmitFix = useCallback(async () => {
    if (selectedIssues.length === 0) return;

    // Transition to diagnosing state
    setModalState("diagnosing");

    // Generate unique issue ID for correlating all related reports
    const avIssueId = `${localSessionId}-${Date.now()}`;

    // Collect diagnostic data using shared function
    const diagnosticData = await collectAVDiagnostics(
      callObject,
      localSessionId,
      player,
      audioContext
    );

    // Build summary for easy scanning
    const remoteCount = diagnosticData.participants.filter(
      (p) => !p.local
    ).length;
    const issueList = selectedIssues.join(", ");
    const summary = `User reported "${issueList}" with ${remoteCount} remote participant(s), audioContext=${diagnosticData.audioContextState}`;

    // Diagnose likely root causes
    const causes = diagnoseIssues(selectedIssues, diagnosticData);
    setDiagnosedCauses(causes);
    console.log("[AV Recovery] Diagnosed causes:", causes);

    // Attempt soft fixes for fixable causes
    const fixResult = await attemptSoftFixes(causes, {
      callObject,
      resumeAudioContext,
      devices,
      player,
      findMatchingDevice,
    });
    console.log("[AV Recovery] Fix result:", fixResult);

    // Wait briefly for changes to take effect
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Re-collect diagnostics to validate fixes
    const afterDiagnostics = await collectAVDiagnostics(
      callObject,
      localSessionId,
      player,
      audioContext
    );

    // Validate which fixes actually worked
    const validation = validateFixes(
      fixResult.attempted,
      diagnosticData,
      afterDiagnostics
    );
    console.log("[AV Recovery] Validation:", validation);

    // Generate user-friendly summary
    const recoverySummaryResult = generateRecoverySummary(fixResult, validation);
    setRecoverySummary(recoverySummaryResult);

    // Set modal state based on result
    setModalState(recoverySummaryResult.status);

    // Build report data with recovery attempt info
    const reportData = {
      summary,
      userReportedIssues: selectedIssues,
      avIssueId,
      diagnosedCauses: causes,
      fixAttempted: fixResult.attempted,
      fixResult: {
        fixed: fixResult.fixed,
        failed: fixResult.failed,
        unfixable: fixResult.unfixable,
      },
      validation,
      recoverySummary: recoverySummaryResult,
      beforeDiagnostics: diagnosticData,
      afterDiagnostics,
    };

    // Log to console (appears in Sentry breadcrumbs)
    console.log("[AV Issue]", summary, reportData);

    // Send to Sentry with avIssueId tag for correlation
    if (Sentry?.captureMessage) {
      Sentry.captureMessage("reportedAVError", {
        level: recoverySummaryResult.status === "success" ? "info" : "error",
        tags: {
          avIssueId,
          recoveryStatus: recoverySummaryResult.status,
        },
        extra: reportData,
      });
    }

    // Log to player data for science/research analysis
    if (player) {
      player.append("avReports", {
        issues: selectedIssues,
        stage: progressLabel,
        timestamp: stageElapsed,
        avIssueId,
        audioContextState: diagnosticData.audioContextState,
        meetingState: diagnosticData.meetingState,
        remoteParticipantCount: remoteCount,
        diagnosedCauses: causes.map((c) => c.id),
        recoveryStatus: recoverySummaryResult.status,
        fixesAttempted: fixResult.attempted.map((c) => c.id),
        fixesSucceeded: fixResult.fixed.map((c) => c.id),
      });
    }

    // Request diagnostics from roommates
    if (player && players && currentRoomPositions.current.length > 0) {
      const myPosition = String(player.get("position"));

      // Get all players in my room, excluding myself
      const roommatePlayers = players.filter((p) => {
        const pos = String(p.get("position"));
        return currentRoomPositions.current.includes(pos) && pos !== myPosition;
      });

      if (roommatePlayers.length > 0) {
        console.log(
          `[AV Issue] Requesting diagnostics from ${roommatePlayers.length} roommate(s)`,
          { avIssueId }
        );

        // Set diagnostic request on each roommate's player object
        roommatePlayers.forEach((roommatePlayer) => {
          try {
            roommatePlayer.append("avDiagnosticRequests", {
              avIssueId,
              reporterId: localSessionId,
              reporterPosition: myPosition,
              userReportedIssues: selectedIssues,
              timestamp: stageElapsed,
              stage: progressLabel,
            });
          } catch (err) {
            console.error(
              "[AV Issue] Failed to request diagnostics from roommate:",
              err
            );
          }
        });
      } else {
        console.log(
          "[AV Issue] No roommates found to request diagnostics from",
          { avIssueId, currentRoomPositions: currentRoomPositions.current }
        );
      }
    } else {
      console.log("[AV Issue] Skipping roommate diagnostics", {
        hasPlayer: !!player,
        hasPlayers: !!players,
        roomPositionsLength: currentRoomPositions.current.length,
      });
    }

    // If success, auto-close modal after a brief delay
    if (recoverySummaryResult.status === "success") {
      setTimeout(() => {
        setShowFixModal(false);
        setModalState("select");
      }, 2000);
    }
  }, [
    callObject,
    localSessionId,
    selectedIssues,
    player,
    players,
    stageElapsed,
    progressLabel,
    audioContext,
    resumeAudioContext,
    devices,
  ]);

  const handleCancelFix = useCallback(() => {
    setShowFixModal(false);
    setSelectedIssues([]);
    setModalState("select");
    setRecoverySummary(null);
    setDiagnosedCauses([]);
  }, []);

  // Escalation option: Leave and rejoin the call without a full page reload.
  // This preserves device IDs (avoiding Safari rotation) while reconnecting.
  const handleRejoinCall = useCallback(async () => {
    if (!callObject || callObject.isDestroyed?.()) return;

    console.log("[AV Recovery] Attempting to rejoin call");
    setModalState("diagnosing");

    try {
      const meetingState = callObject.meetingState?.();
      if (meetingState === "joined-meeting") {
        await callObject.leave();
        console.log("[AV Recovery] Left call, waiting before rejoining...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // The VideoCall component's useEffect will automatically rejoin
      // when it detects we're no longer in the meeting
      setShowFixModal(false);
      setModalState("select");
    } catch (err) {
      console.error("[AV Recovery] Failed to rejoin call:", err);
      // Fall back to reload
      window.location.reload();
    }
  }, [callObject]);

  // Last resort: Full page reload with Safari warning logged
  const handleReloadPage = useCallback(() => {
    console.log("[AV Recovery] User requested page reload");
    Sentry.addBreadcrumb({
      category: "av-recovery",
      message: "User triggered page reload after soft fix failed",
      level: "warning",
    });
    window.location.reload();
  }, []);

  const FixAVModal = useCallback(
    () =>
      showFixModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            {/* Issue Selection State */}
            {modalState === "select" && (
              <>
                <h2 className="mb-4 text-lg font-semibold text-slate-900">
                  What problems are you experiencing?
                </h2>
                <p className="mb-4 text-sm text-slate-600">
                  Select all that apply
                </p>
                <div className="mb-6 space-y-3">
                  {[
                    {
                      value: "cant-hear",
                      label: "I can't hear other participants",
                    },
                    {
                      value: "cant-see",
                      label: "I can't see other participants",
                    },
                    {
                      value: "others-cant-hear-me",
                      label: "Others can't hear me",
                    },
                    {
                      value: "others-cant-see-me",
                      label: "Others can't see me",
                    },
                    { value: "other", label: "Something else" },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        value={option.value}
                        checked={selectedIssues.includes(option.value)}
                        onChange={() => toggleIssue(option.value)}
                        className="h-4 w-4 rounded text-blue-600"
                      />
                      <span className="text-slate-700">{option.label}</span>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end gap-3">
                  <Button
                    primary={false}
                    handleClick={handleCancelFix}
                    className="px-4 py-2"
                  >
                    Cancel
                  </Button>
                  <Button
                    primary
                    handleClick={handleSubmitFix}
                    disabled={selectedIssues.length === 0}
                    className="px-4 py-2"
                  >
                    Diagnose &amp; Fix
                  </Button>
                </div>
              </>
            )}

            {/* Diagnosing State */}
            {modalState === "diagnosing" && (
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                </div>
                <h2 className="mb-2 text-lg font-semibold text-slate-900">
                  Attempting to fix...
                </h2>
                <p className="text-sm text-slate-600">
                  Diagnosing the issue and applying fixes
                </p>
              </div>
            )}

            {/* Success State */}
            {modalState === "success" && recoverySummary && (
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <svg
                      className="h-6 w-6 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
                <h2 className="mb-2 text-lg font-semibold text-green-700">
                  {recoverySummary.message}
                </h2>
                <div className="mb-4 text-sm text-slate-600">
                  {recoverySummary.details.map((detail, i) => (
                    <p key={i}>{detail}</p>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  This dialog will close automatically...
                </p>
              </div>
            )}

            {/* Partial Success State */}
            {modalState === "partial" && recoverySummary && (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                    <svg
                      className="h-5 w-5 text-yellow-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {recoverySummary.message}
                  </h2>
                </div>
                <div className="mb-4 space-y-1 text-sm text-slate-600">
                  {recoverySummary.details.map((detail, i) => (
                    <p key={i}>{detail}</p>
                  ))}
                </div>
                <p className="mb-4 text-sm text-slate-600">
                  If the issue persists, try these options:
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    primary
                    handleClick={handleRejoinCall}
                    className="w-full px-4 py-2"
                  >
                    Rejoin Call
                  </Button>
                  <Button
                    primary={false}
                    handleClick={handleReloadPage}
                    className="w-full px-4 py-2"
                  >
                    Reload Page
                  </Button>
                  <Button
                    primary={false}
                    handleClick={handleCancelFix}
                    className="w-full px-4 py-2 text-slate-500"
                  >
                    Close
                  </Button>
                </div>
              </>
            )}

            {/* Failed State */}
            {modalState === "failed" && recoverySummary && (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                    <svg
                      className="h-5 w-5 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {recoverySummary.message}
                  </h2>
                </div>
                <div className="mb-4 space-y-1 text-sm text-slate-600">
                  {recoverySummary.details.map((detail, i) => (
                    <p key={i}>{detail}</p>
                  ))}
                </div>
                <p className="mb-4 text-sm text-slate-600">
                  Try these options to resolve the issue:
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    primary
                    handleClick={handleRejoinCall}
                    className="w-full px-4 py-2"
                  >
                    Rejoin Call
                  </Button>
                  <Button
                    primary={false}
                    handleClick={handleReloadPage}
                    className="w-full px-4 py-2"
                  >
                    Reload Page
                  </Button>
                  <Button
                    primary={false}
                    handleClick={handleCancelFix}
                    className="w-full px-4 py-2 text-slate-500"
                  >
                    Close
                  </Button>
                </div>
              </>
            )}

            {/* Unfixable State (issue on other participant's side) */}
            {modalState === "unfixable" && recoverySummary && (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <svg
                      className="h-5 w-5 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {recoverySummary.message}
                  </h2>
                </div>
                <div className="mb-4 space-y-1 text-sm text-slate-600">
                  {recoverySummary.details.map((detail, i) => (
                    <p key={i}>{detail}</p>
                  ))}
                </div>
                {diagnosedCauses.some(
                  (c) =>
                    c.id === "remoteParticipantMuted" ||
                    c.id === "remoteParticipantCameraOff"
                ) && (
                  <p className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                    This issue appears to be on the other participant&apos;s
                    side. Try asking them to check their audio/video settings.
                  </p>
                )}
                <div className="flex justify-end gap-3">
                  <Button
                    primary={false}
                    handleClick={handleCancelFix}
                    className="px-4 py-2"
                  >
                    Close
                  </Button>
                </div>
              </>
            )}

            {/* Unknown State (no causes identified) */}
            {modalState === "unknown" && recoverySummary && (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                    <svg
                      className="h-5 w-5 text-slate-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {recoverySummary.message}
                  </h2>
                </div>
                <div className="mb-4 space-y-1 text-sm text-slate-600">
                  {recoverySummary.details.map((detail, i) => (
                    <p key={i}>{detail}</p>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    primary
                    handleClick={handleRejoinCall}
                    className="w-full px-4 py-2"
                  >
                    Rejoin Call
                  </Button>
                  <Button
                    primary={false}
                    handleClick={handleReloadPage}
                    className="w-full px-4 py-2"
                  >
                    Reload Page
                  </Button>
                  <Button
                    primary={false}
                    handleClick={handleCancelFix}
                    className="w-full px-4 py-2 text-slate-500"
                  >
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null,
    [
      showFixModal,
      modalState,
      selectedIssues,
      recoverySummary,
      diagnosedCauses,
      toggleIssue,
      handleSubmitFix,
      handleCancelFix,
      handleRejoinCall,
      handleReloadPage,
    ]
  );

  return { openFixAV, FixAVModal };
}
