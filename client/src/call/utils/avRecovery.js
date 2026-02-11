/**
 * A/V Recovery Utilities
 *
 * This module provides intelligent diagnosis and targeted recovery for audio/video issues.
 *
 * ## Problem Being Solved
 *
 * Previously, the "Fix A/V" button immediately reloaded the page after collecting diagnostics.
 * This approach has several problems:
 *
 * 1. **Safari device ID rotation** - Page reload causes Safari to rotate device IDs,
 *    potentially losing the user's preferred device and falling back to a different device.
 *
 * 2. **Disruptive UX** - Full page reload interrupts the user's experience and reconnects
 *    the entire call, even when the issue might be fixable with a simple operation.
 *
 * 3. **No soft fix attempt** - We don't try any in-place recovery before resorting to reload.
 *
 * 4. **May not fix the issue** - The reload might not address the actual root cause.
 *
 * ## Solution Approach
 *
 * This module implements a diagnosis → targeted fix → escalation approach:
 *
 * 1. **Diagnose**: Analyze diagnostic data to identify likely root causes for each reported issue
 * 2. **Soft Fix**: Attempt targeted fixes (e.g., resume AudioContext, re-acquire device)
 * 3. **Validate**: Re-collect diagnostics to check if the fix worked
 * 4. **Escalate**: Only offer page reload as a last resort, with appropriate warnings
 *
 * ## Issue → Root Cause → Fix Mapping
 *
 * ### "I can't hear others" (cant-hear)
 * - AudioContext suspended → Resume AudioContext
 * - Speaker not set → Re-align speaker device
 * - Remote participant muted → Inform user (no fix possible)
 *
 * ### "Others can't hear me" (others-cant-hear-me)
 * - Mic track ended → Re-acquire microphone
 * - Mic muted → Unmute via Daily
 * - No microphone active → Re-align microphone device
 * - Permission revoked → Show permission prompt
 *
 * ### "I can't see others" (cant-see)
 * - Remote participant camera off → Inform user (no fix possible)
 * - Video subscription issue → Update subscriptions
 *
 * ### "Others can't see me" (others-cant-see-me)
 * - Camera track ended → Re-acquire camera
 * - Camera muted → Unmute via Daily
 * - Permission revoked → Show permission prompt
 *
 * @see https://github.com/Watts-Lab/deliberation-empirica/issues/1166
 */

/**
 * Possible root causes for A/V issues, with detection logic and fix strategies.
 *
 * Each cause has:
 * - id: Unique identifier
 * - issueTypes: Which user-reported issues this cause could explain
 * - description: Human-readable explanation
 * - detect: Function that checks if this cause is present in diagnostics
 * - fixable: Whether we can attempt an automated fix
 * - fixDescription: What the fix does (for logging/UI)
 */
export const ROOT_CAUSES = {
  audioContextSuspended: {
    id: "audioContextSuspended",
    issueTypes: ["cant-hear"],
    description: "Browser audio is paused (autoplay policy)",
    detect: (diagnostics) => diagnostics.audioContextState === "suspended",
    fixable: true,
    fixDescription: "Resume browser audio",
    priority: 1, // Higher priority = try first
  },

  speakerNotSet: {
    id: "speakerNotSet",
    issueTypes: ["cant-hear"],
    description: "No speaker device is active",
    detect: (diagnostics) =>
      diagnostics.deviceAlignment?.speaker?.currentId === null,
    fixable: true,
    fixDescription: "Re-align speaker device",
    priority: 2,
  },

  microphoneTrackEnded: {
    id: "microphoneTrackEnded",
    issueTypes: ["others-cant-hear-me"],
    description: "Microphone stream has ended",
    detect: (diagnostics) =>
      diagnostics.localMediaState?.audioTrack?.readyState === "ended",
    fixable: true,
    fixDescription: "Re-acquire microphone",
    priority: 1,
  },

  microphoneMuted: {
    id: "microphoneMuted",
    issueTypes: ["others-cant-hear-me"],
    description: "Microphone is muted",
    detect: (diagnostics) =>
      diagnostics.localMediaState?.audioTrack?.enabled === false,
    fixable: true,
    fixDescription: "Unmute microphone",
    priority: 1,
  },

  microphoneNotActive: {
    id: "microphoneNotActive",
    issueTypes: ["others-cant-hear-me"],
    description: "No microphone device is active",
    detect: (diagnostics) =>
      diagnostics.deviceAlignment?.microphone?.currentId === null,
    fixable: true,
    fixDescription: "Re-align microphone device",
    priority: 2,
  },

  microphonePermissionDenied: {
    id: "microphonePermissionDenied",
    issueTypes: ["others-cant-hear-me"],
    description: "Microphone permission was denied",
    detect: (diagnostics) =>
      diagnostics.browserPermissions?.microphone === "denied",
    fixable: false,
    fixDescription: "User must grant microphone permission in browser settings",
    priority: 0,
  },

  cameraTrackEnded: {
    id: "cameraTrackEnded",
    issueTypes: ["others-cant-see-me"],
    description: "Camera stream has ended",
    detect: (diagnostics) =>
      diagnostics.localMediaState?.videoTrack?.readyState === "ended",
    fixable: true,
    fixDescription: "Re-acquire camera",
    priority: 1,
  },

  cameraMuted: {
    id: "cameraMuted",
    issueTypes: ["others-cant-see-me"],
    description: "Camera is turned off",
    detect: (diagnostics) =>
      diagnostics.localMediaState?.videoTrack?.enabled === false,
    fixable: true,
    fixDescription: "Turn on camera",
    priority: 1,
  },

  cameraNotActive: {
    id: "cameraNotActive",
    issueTypes: ["others-cant-see-me"],
    description: "No camera device is active",
    detect: (diagnostics) =>
      diagnostics.deviceAlignment?.camera?.currentId === null,
    fixable: true,
    fixDescription: "Re-align camera device",
    priority: 2,
  },

  cameraPermissionDenied: {
    id: "cameraPermissionDenied",
    issueTypes: ["others-cant-see-me"],
    description: "Camera permission was denied",
    detect: (diagnostics) =>
      diagnostics.browserPermissions?.camera === "denied",
    fixable: false,
    fixDescription: "User must grant camera permission in browser settings",
    priority: 0,
  },

  remoteParticipantMuted: {
    id: "remoteParticipantMuted",
    issueTypes: ["cant-hear"],
    description: "Other participant(s) have muted their microphone",
    detect: (diagnostics) => {
      const remoteParticipants = (diagnostics.participants || []).filter(
        (p) => !p.local
      );
      return (
        remoteParticipants.length > 0 &&
        remoteParticipants.every((p) => p.audio?.off?.byUser)
      );
    },
    fixable: false,
    fixDescription: "Ask other participants to unmute",
    priority: 3,
  },

  remoteParticipantCameraOff: {
    id: "remoteParticipantCameraOff",
    issueTypes: ["cant-see"],
    description: "Other participant(s) have turned off their camera",
    detect: (diagnostics) => {
      const remoteParticipants = (diagnostics.participants || []).filter(
        (p) => !p.local
      );
      return (
        remoteParticipants.length > 0 &&
        remoteParticipants.every((p) => p.video?.off?.byUser)
      );
    },
    fixable: false,
    fixDescription: "Ask other participants to turn on their camera",
    priority: 3,
  },

  networkIssues: {
    id: "networkIssues",
    issueTypes: ["cant-hear", "cant-see"],
    description: "Network connection has quality issues",
    detect: (diagnostics) => {
      const stats = diagnostics.networkStats?.stats?.latest;
      if (!stats) return false;
      // High packet loss (>5%) or high RTT (>500ms) indicates network issues
      const packetLoss = stats.videoRecvPacketLoss || stats.audioRecvPacketLoss;
      const rtt = stats.rtt;
      return packetLoss > 0.05 || rtt > 500;
    },
    fixable: false,
    fixDescription: "Check network connection",
    priority: 4,
  },
};

/**
 * Diagnoses the likely root causes for a set of user-reported issues.
 *
 * @param {string[]} reportedIssues - Array of issue types (e.g., ['cant-hear', 'others-cant-hear-me'])
 * @param {Object} diagnostics - Diagnostic data from collectAVDiagnostics()
 * @returns {Object[]} Array of detected causes, sorted by priority (highest first)
 *
 * Each returned cause includes:
 * - id: Cause identifier
 * - description: Human-readable description
 * - fixable: Whether we can attempt an automated fix
 * - fixDescription: What the fix does
 * - priority: Sorting priority
 */
export function diagnoseIssues(reportedIssues, diagnostics) {
  if (!reportedIssues || reportedIssues.length === 0 || !diagnostics) {
    return [];
  }

  const detectedCauses = [];

  for (const cause of Object.values(ROOT_CAUSES)) {
    // Check if this cause applies to any of the reported issues
    const appliesTo = cause.issueTypes.some((issueType) =>
      reportedIssues.includes(issueType)
    );

    if (!appliesTo) continue;

    // Check if this cause is detected in the diagnostics
    try {
      if (cause.detect(diagnostics)) {
        detectedCauses.push({
          id: cause.id,
          description: cause.description,
          fixable: cause.fixable,
          fixDescription: cause.fixDescription,
          priority: cause.priority,
        });
      }
    } catch (err) {
      console.warn(`[AV Recovery] Error detecting cause ${cause.id}:`, err);
    }
  }

  // Sort by priority (lower number = higher priority = first)
  detectedCauses.sort((a, b) => a.priority - b.priority);

  return detectedCauses;
}

/**
 * Attempts to fix the identified root causes using available tools.
 *
 * @param {Object[]} causes - Array of detected causes from diagnoseIssues()
 * @param {Object} tools - Object containing fix utilities:
 *   - callObject: Daily call object
 *   - resumeAudioContext: Function to resume AudioContext
 *   - devices: Daily devices hook result
 *   - player: Empirica player object
 *   - findMatchingDevice: Device matching utility
 * @returns {Promise<Object>} Result object with:
 *   - attempted: Causes that were attempted to fix
 *   - fixed: Causes that were successfully fixed
 *   - failed: Causes that failed to fix
 *   - unfixable: Causes that cannot be automatically fixed
 */
export async function attemptSoftFixes(causes, tools) {
  const result = {
    attempted: [],
    fixed: [],
    failed: [],
    unfixable: [],
  };

  if (!causes || causes.length === 0) {
    return result;
  }

  const {
    callObject,
    resumeAudioContext,
    devices,
    player,
    findMatchingDevice,
  } = tools;

  for (const cause of causes) {
    if (!cause.fixable) {
      result.unfixable.push(cause);
      continue;
    }

    result.attempted.push(cause);

    try {
      let fixSuccess = false;

      switch (cause.id) {
        case "audioContextSuspended":
          if (resumeAudioContext) {
            await resumeAudioContext();
            fixSuccess = true;
            console.log("[AV Recovery] Resumed AudioContext");
          }
          break;

        case "speakerNotSet":
          if (devices?.speakers?.length > 0 && devices?.setSpeaker) {
            const preferredSpeakerId = player?.get?.("speakerId");
            const preferredSpeakerLabel = player?.get?.("speakerLabel");
            const match = findMatchingDevice?.(
              devices.speakers,
              preferredSpeakerId,
              preferredSpeakerLabel
            );
            if (match) {
              await devices.setSpeaker(match.device.device.deviceId);
              fixSuccess = true;
              console.log("[AV Recovery] Re-aligned speaker device");
            }
          }
          break;

        case "microphoneTrackEnded":
        case "microphoneNotActive":
          if (callObject && devices?.microphones?.length > 0) {
            const preferredMicId = player?.get?.("micId");
            const preferredMicLabel = player?.get?.("micLabel");
            const match = findMatchingDevice?.(
              devices.microphones,
              preferredMicId,
              preferredMicLabel
            );
            if (match) {
              await callObject.setInputDevicesAsync({
                audioDeviceId: match.device.device.deviceId,
              });
              fixSuccess = true;
              console.log("[AV Recovery] Re-acquired microphone");
            }
          }
          break;

        case "microphoneMuted":
          if (callObject) {
            await callObject.setLocalAudio(true);
            fixSuccess = true;
            console.log("[AV Recovery] Unmuted microphone");
          }
          break;

        case "cameraTrackEnded":
        case "cameraNotActive":
          if (callObject && devices?.cameras?.length > 0) {
            const preferredCameraId = player?.get?.("cameraId");
            const preferredCameraLabel = player?.get?.("cameraLabel");
            const match = findMatchingDevice?.(
              devices.cameras,
              preferredCameraId,
              preferredCameraLabel
            );
            if (match) {
              await callObject.setInputDevicesAsync({
                videoDeviceId: match.device.device.deviceId,
              });
              fixSuccess = true;
              console.log("[AV Recovery] Re-acquired camera");
            }
          }
          break;

        case "cameraMuted":
          if (callObject) {
            await callObject.setLocalVideo(true);
            fixSuccess = true;
            console.log("[AV Recovery] Turned on camera");
          }
          break;

        default:
          console.warn(`[AV Recovery] No fix implemented for ${cause.id}`);
      }

      if (fixSuccess) {
        result.fixed.push(cause);
      } else {
        result.failed.push(cause);
      }
    } catch (err) {
      console.error(`[AV Recovery] Failed to fix ${cause.id}:`, err);
      result.failed.push({ ...cause, error: err?.message || String(err) });
    }
  }

  return result;
}

/**
 * Validates whether the fixes were successful by comparing before/after diagnostics.
 *
 * @param {Object[]} causes - Causes that were attempted to fix
 * @param {Object} beforeDiagnostics - Diagnostics collected before fix attempt (used for comparison)
 * @param {Object} afterDiagnostics - Diagnostics collected after fix attempt
 * @returns {Object} Validation result with:
 *   - resolved: Causes that no longer appear in diagnostics
 *   - stillPresent: Causes that are still detected
 */
export function validateFixes(causes, beforeDiagnostics, afterDiagnostics) {
  const result = {
    resolved: [],
    stillPresent: [],
  };

  if (!causes || causes.length === 0) {
    return result;
  }

  // If we couldn't collect after diagnostics, assume fixes didn't work
  if (!afterDiagnostics) {
    console.warn("[AV Recovery] No after diagnostics available for validation");
    result.stillPresent = [...causes];
    return result;
  }

  for (const cause of causes) {
    const rootCause = ROOT_CAUSES[cause.id];
    if (!rootCause) continue;

    try {
      // Check if the cause was present before (sanity check)
      const wasPresent = beforeDiagnostics
        ? rootCause.detect(beforeDiagnostics)
        : true;

      // Check if the cause is still present after the fix
      const stillDetected = rootCause.detect(afterDiagnostics);

      if (stillDetected) {
        result.stillPresent.push(cause);
      } else if (wasPresent) {
        // Only count as resolved if it was actually present before
        result.resolved.push(cause);
      }
    } catch (err) {
      console.warn(`[AV Recovery] Error validating ${cause.id}:`, err);
      result.stillPresent.push(cause);
    }
  }

  return result;
}

/**
 * Generates a user-friendly summary of the recovery attempt.
 *
 * @param {Object} fixResult - Result from attemptSoftFixes()
 * @param {Object} validation - Result from validateFixes()
 * @returns {Object} Summary with:
 *   - status: 'success' | 'partial' | 'failed' | 'unfixable'
 *   - message: User-facing message
 *   - details: Array of detail messages
 */
export function generateRecoverySummary(fixResult, validation) {
  const { fixed, failed, unfixable } = fixResult;
  const { resolved, stillPresent } = validation || {
    resolved: [],
    stillPresent: [],
  };

  // If we fixed things and they're resolved, success
  // Note: unfixable causes don't prevent "success" since they require manual user action
  // and are informational (e.g., "remote participant muted")
  if (
    resolved.length > 0 &&
    stillPresent.length === 0 &&
    failed.length === 0
  ) {
    // If there are also unfixable causes, mention them but still report success for fixable ones
    if (unfixable.length > 0) {
      return {
        status: "partial",
        message: "Fixed what we could",
        details: [
          ...resolved.map((c) => `✓ ${c.fixDescription}`),
          ...unfixable.map((c) => `ℹ ${c.fixDescription}`),
        ],
      };
    }
    return {
      status: "success",
      message: "Issue resolved",
      details: resolved.map((c) => `✓ ${c.fixDescription}`),
    };
  }

  // If some things are still present but we fixed some
  if (resolved.length > 0 && stillPresent.length > 0) {
    return {
      status: "partial",
      message: "Partially resolved",
      details: [
        ...resolved.map((c) => `✓ ${c.fixDescription}`),
        ...stillPresent.map((c) => `✗ ${c.description} (still present)`),
      ],
    };
  }

  // If everything failed
  if (failed.length > 0 && resolved.length === 0) {
    return {
      status: "failed",
      message: "Could not fix automatically",
      details: failed.map(
        (c) => `✗ ${c.fixDescription}${c.error ? `: ${c.error}` : ""}`
      ),
    };
  }

  // If only unfixable causes were found
  if (unfixable.length > 0 && fixed.length === 0 && failed.length === 0) {
    return {
      status: "unfixable",
      message: "This issue requires manual action",
      details: unfixable.map((c) => `ℹ ${c.fixDescription}`),
    };
  }

  // No causes found at all
  return {
    status: "unknown",
    message: "No specific cause identified",
    details: [
      "Try rejoining the call, or reload the page if the issue persists.",
    ],
  };
}
