import React, { useCallback, useState } from "react";
import * as Sentry from "@sentry/react";
import { useDaily, useLocalSessionId } from "@daily-co/daily-react";
import { usePlayers } from "@empirica/core/player/classic/react";
import { Button } from "../components/Button";
import { latestDesiredSubscriptions, currentRoomPositions } from "./Call";

/**
 * Collects comprehensive diagnostic data for A/V troubleshooting.
 *
 * This function gathers:
 * - Daily participant states and track subscriptions
 * - Audio device information (input/output)
 * - Network statistics
 * - Browser AudioContext state
 * - Browser permission states
 *
 * @param {Object} callObject - Daily call object
 * @param {string} localSessionId - Current participant's Daily session ID
 * @returns {Promise<Object>} Diagnostic data object
 */
export async function collectAVDiagnostics(callObject, localSessionId) {
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
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      audioContextState = ctx.state;
      ctx.close().catch(() => {});
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

  return {
    participants: participantSummary,
    desiredSubscriptions,
    meetingState: callObject?.meetingState?.(),
    localSessionId,
    audioDevices,
    networkStats,
    audioContextState,
    browserPermissions,
  };
}

/**
 * Hook for reporting audio/video issues to Sentry and refreshing the page.
 * Returns an openFixAV function to show the issue reporting modal and
 * a FixAVModal component to render in the parent.
 */
export function useFixAV(player, stageElapsed, progressLabel) {
  const callObject = useDaily();
  const localSessionId = useLocalSessionId();
  const players = usePlayers();
  const [showFixModal, setShowFixModal] = useState(false);
  const [selectedIssues, setSelectedIssues] = useState([]);

  const openFixAV = useCallback(() => {
    setShowFixModal(true);
    setSelectedIssues([]);
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

    // Generate unique issue ID for correlating all related reports
    const avIssueId = `${localSessionId}-${Date.now()}`;

    // Collect diagnostic data using shared function
    const diagnosticData = await collectAVDiagnostics(callObject, localSessionId);

    // Build summary for easy scanning
    const remoteCount = diagnosticData.participants.filter((p) => !p.local).length;
    const issueList = selectedIssues.join(", ");
    const summary = `User reported "${issueList}" with ${remoteCount} remote participant(s), audioContext=${diagnosticData.audioContextState}`;

    const reportData = {
      summary,
      userReportedIssues: selectedIssues,
      avIssueId,
      ...diagnosticData,
    };

    // Log to console (appears in Sentry breadcrumbs)
    console.log("[AV Issue]", summary, reportData);

    // Send to Sentry with avIssueId tag for correlation
    if (Sentry?.captureMessage) {
      Sentry.captureMessage("reportedAVError", {
        level: "error",
        tags: { avIssueId },
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

    // Close modal and refresh page to attempt recovery
    setShowFixModal(false);
    window.location.reload();
  }, [callObject, localSessionId, selectedIssues, player, players, stageElapsed, progressLabel]);

  const handleCancelFix = useCallback(() => {
    setShowFixModal(false);
    setSelectedIssues([]);
  }, []);

  const FixAVModal = useCallback(
    () =>
      showFixModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              What problems are you experiencing?
            </h2>
            <p className="mb-4 text-sm text-slate-600">Select all that apply</p>
            <div className="mb-6 space-y-3">
              {[
                {
                  value: "cant-hear",
                  label: "I can't hear other participants",
                },
                { value: "cant-see", label: "I can't see other participants" },
                {
                  value: "others-cant-hear-me",
                  label: "Others can't hear me",
                },
                { value: "others-cant-see-me", label: "Others can't see me" },
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
                Submit &amp; Reload page
              </Button>
            </div>
          </div>
        </div>
      ) : null,
    [
      showFixModal,
      selectedIssues,
      toggleIssue,
      handleSubmitFix,
      handleCancelFix,
    ]
  );

  return { openFixAV, FixAVModal };
}
