/**
 * Tests for A/V Recovery System
 *
 * These tests are CRITICAL for ensuring the intelligent A/V diagnosis system
 * works correctly. If you're refactoring this code, ensure all tests pass.
 *
 * Key behaviors to preserve:
 * 1. diagnoseIssues() must return causes sorted by priority
 * 2. Only causes relevant to reported issues should be returned
 * 3. attemptSoftFixes() must categorize unfixable causes separately
 * 4. validateFixes() must correctly detect resolved vs still-present issues
 * 5. generateRecoverySummary() must return correct status for all scenarios
 *
 * @see https://github.com/Watts-Lab/deliberation-empirica/issues/1166
 */

import { describe, it, expect, vi } from "vitest";
import {
  ROOT_CAUSES,
  diagnoseIssues,
  attemptSoftFixes,
  validateFixes,
  generateRecoverySummary,
} from "./avRecovery";

describe("avRecovery", () => {
  describe("ROOT_CAUSES", () => {
    it("has all expected root causes defined", () => {
      expect(ROOT_CAUSES.audioContextSuspended).toBeDefined();
      expect(ROOT_CAUSES.speakerNotSet).toBeDefined();
      expect(ROOT_CAUSES.microphoneTrackEnded).toBeDefined();
      expect(ROOT_CAUSES.microphoneMuted).toBeDefined();
      expect(ROOT_CAUSES.microphoneNotActive).toBeDefined();
      expect(ROOT_CAUSES.cameraTrackEnded).toBeDefined();
      expect(ROOT_CAUSES.cameraMuted).toBeDefined();
      expect(ROOT_CAUSES.cameraNotActive).toBeDefined();
      expect(ROOT_CAUSES.remoteParticipantMuted).toBeDefined();
      expect(ROOT_CAUSES.remoteParticipantCameraOff).toBeDefined();
    });

    it("each root cause has required properties", () => {
      for (const cause of Object.values(ROOT_CAUSES)) {
        expect(cause.id).toBeDefined();
        expect(cause.issueTypes).toBeInstanceOf(Array);
        expect(cause.description).toBeDefined();
        expect(typeof cause.detect).toBe("function");
        expect(typeof cause.fixable).toBe("boolean");
        expect(cause.fixDescription).toBeDefined();
        expect(typeof cause.priority).toBe("number");
      }
    });
  });

  describe("diagnoseIssues", () => {
    it("returns empty array for empty inputs", () => {
      expect(diagnoseIssues([], {})).toEqual([]);
      expect(diagnoseIssues(null, {})).toEqual([]);
      expect(diagnoseIssues(["cant-hear"], null)).toEqual([]);
    });

    it("detects audioContextSuspended for cant-hear issue", () => {
      const diagnostics = {
        audioContextState: "suspended",
      };
      const causes = diagnoseIssues(["cant-hear"], diagnostics);

      expect(causes).toHaveLength(1);
      expect(causes[0].id).toBe("audioContextSuspended");
      expect(causes[0].fixable).toBe(true);
    });

    it("detects speakerNotSet for cant-hear issue", () => {
      const diagnostics = {
        audioContextState: "running",
        deviceAlignment: {
          speaker: { currentId: null },
        },
      };
      const causes = diagnoseIssues(["cant-hear"], diagnostics);

      expect(causes.some((c) => c.id === "speakerNotSet")).toBe(true);
    });

    it("detects microphoneMuted for others-cant-hear-me issue", () => {
      const diagnostics = {
        localMediaState: {
          audioTrack: { enabled: false },
        },
      };
      const causes = diagnoseIssues(["others-cant-hear-me"], diagnostics);

      expect(causes.some((c) => c.id === "microphoneMuted")).toBe(true);
    });

    it("detects microphoneTrackEnded for others-cant-hear-me issue", () => {
      const diagnostics = {
        localMediaState: {
          audioTrack: { readyState: "ended" },
        },
      };
      const causes = diagnoseIssues(["others-cant-hear-me"], diagnostics);

      expect(causes.some((c) => c.id === "microphoneTrackEnded")).toBe(true);
    });

    it("detects cameraMuted for others-cant-see-me issue", () => {
      const diagnostics = {
        localMediaState: {
          videoTrack: { enabled: false },
        },
      };
      const causes = diagnoseIssues(["others-cant-see-me"], diagnostics);

      expect(causes.some((c) => c.id === "cameraMuted")).toBe(true);
    });

    it("detects remoteParticipantMuted for cant-hear issue", () => {
      const diagnostics = {
        participants: [
          { local: true, audio: {} },
          { local: false, audio: { off: { byUser: true } } },
        ],
      };
      const causes = diagnoseIssues(["cant-hear"], diagnostics);

      expect(causes.some((c) => c.id === "remoteParticipantMuted")).toBe(true);
    });

    it("sorts causes by priority", () => {
      const diagnostics = {
        audioContextState: "suspended",
        deviceAlignment: {
          speaker: { currentId: null },
        },
      };
      const causes = diagnoseIssues(["cant-hear"], diagnostics);

      // audioContextSuspended (priority 1) should come before speakerNotSet (priority 2)
      const audioContextIndex = causes.findIndex(
        (c) => c.id === "audioContextSuspended"
      );
      const speakerIndex = causes.findIndex((c) => c.id === "speakerNotSet");

      expect(audioContextIndex).toBeLessThan(speakerIndex);
    });

    it("only returns causes relevant to reported issues", () => {
      const diagnostics = {
        audioContextState: "suspended",
        localMediaState: {
          audioTrack: { enabled: false },
        },
      };
      // Only report cant-hear, not others-cant-hear-me
      const causes = diagnoseIssues(["cant-hear"], diagnostics);

      // Should detect audioContextSuspended (for cant-hear)
      expect(causes.some((c) => c.id === "audioContextSuspended")).toBe(true);
      // Should NOT detect microphoneMuted (that's for others-cant-hear-me)
      expect(causes.some((c) => c.id === "microphoneMuted")).toBe(false);
    });
  });

  describe("attemptSoftFixes", () => {
    it("returns empty result for empty causes", async () => {
      const result = await attemptSoftFixes([], {});

      expect(result.attempted).toEqual([]);
      expect(result.fixed).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(result.unfixable).toEqual([]);
    });

    it("categorizes unfixable causes correctly", async () => {
      const causes = [
        { id: "remoteParticipantMuted", fixable: false },
        { id: "microphonePermissionDenied", fixable: false },
      ];

      const result = await attemptSoftFixes(causes, {});

      expect(result.unfixable).toHaveLength(2);
      expect(result.attempted).toHaveLength(0);
    });

    it("calls resumeAudioContext for audioContextSuspended", async () => {
      const resumeAudioContext = vi.fn().mockResolvedValue();
      const causes = [
        {
          id: "audioContextSuspended",
          fixable: true,
          fixDescription: "Resume browser audio",
        },
      ];

      const result = await attemptSoftFixes(causes, { resumeAudioContext });

      expect(resumeAudioContext).toHaveBeenCalled();
      expect(result.fixed).toHaveLength(1);
      expect(result.fixed[0].id).toBe("audioContextSuspended");
    });

    it("calls setLocalAudio for microphoneMuted", async () => {
      const callObject = {
        setLocalAudio: vi.fn().mockResolvedValue(),
      };
      const causes = [
        { id: "microphoneMuted", fixable: true, fixDescription: "Unmute mic" },
      ];

      const result = await attemptSoftFixes(causes, { callObject });

      expect(callObject.setLocalAudio).toHaveBeenCalledWith(true);
      expect(result.fixed).toHaveLength(1);
    });

    it("calls setLocalVideo for cameraMuted", async () => {
      const callObject = {
        setLocalVideo: vi.fn().mockResolvedValue(),
      };
      const causes = [
        { id: "cameraMuted", fixable: true, fixDescription: "Turn on camera" },
      ];

      const result = await attemptSoftFixes(causes, { callObject });

      expect(callObject.setLocalVideo).toHaveBeenCalledWith(true);
      expect(result.fixed).toHaveLength(1);
    });

    it("handles errors and adds to failed list", async () => {
      const resumeAudioContext = vi
        .fn()
        .mockRejectedValue(new Error("Failed"));
      const causes = [
        {
          id: "audioContextSuspended",
          fixable: true,
          fixDescription: "Resume browser audio",
        },
      ];

      const result = await attemptSoftFixes(causes, { resumeAudioContext });

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toBe("Failed");
    });
  });

  describe("validateFixes", () => {
    it("returns empty result for empty causes", () => {
      const result = validateFixes([], {}, {});

      expect(result.resolved).toEqual([]);
      expect(result.stillPresent).toEqual([]);
    });

    it("detects resolved issues", () => {
      const causes = [{ id: "audioContextSuspended" }];
      const beforeDiagnostics = { audioContextState: "suspended" };
      const afterDiagnostics = { audioContextState: "running" };

      const result = validateFixes(causes, beforeDiagnostics, afterDiagnostics);

      expect(result.resolved).toHaveLength(1);
      expect(result.stillPresent).toHaveLength(0);
    });

    it("detects still-present issues", () => {
      const causes = [{ id: "audioContextSuspended" }];
      const beforeDiagnostics = { audioContextState: "suspended" };
      const afterDiagnostics = { audioContextState: "suspended" };

      const result = validateFixes(causes, beforeDiagnostics, afterDiagnostics);

      expect(result.resolved).toHaveLength(0);
      expect(result.stillPresent).toHaveLength(1);
    });

    it("treats all causes as still-present when afterDiagnostics is null", () => {
      const causes = [
        { id: "audioContextSuspended" },
        { id: "microphoneMuted" },
      ];
      const beforeDiagnostics = { audioContextState: "suspended" };

      const result = validateFixes(causes, beforeDiagnostics, null);

      expect(result.stillPresent).toHaveLength(2);
      expect(result.resolved).toHaveLength(0);
    });

    it("handles missing beforeDiagnostics gracefully", () => {
      const causes = [{ id: "audioContextSuspended" }];
      const afterDiagnostics = { audioContextState: "running" };

      // Even without beforeDiagnostics, should still mark as resolved
      // since the issue is not detected in afterDiagnostics
      const result = validateFixes(causes, null, afterDiagnostics);

      expect(result.resolved).toHaveLength(1);
      expect(result.stillPresent).toHaveLength(0);
    });
  });

  describe("generateRecoverySummary", () => {
    it("returns success status when all fixes resolved", () => {
      const fixResult = {
        fixed: [{ id: "audioContextSuspended", fixDescription: "Resume audio" }],
        failed: [],
        unfixable: [],
      };
      const validation = {
        resolved: [{ id: "audioContextSuspended", fixDescription: "Resume audio" }],
        stillPresent: [],
      };

      const summary = generateRecoverySummary(fixResult, validation);

      expect(summary.status).toBe("success");
      expect(summary.message).toBe("Issue resolved");
    });

    it("returns partial status when some fixes worked", () => {
      const fixResult = {
        fixed: [{ id: "audioContextSuspended", fixDescription: "Resume audio" }],
        failed: [],
        unfixable: [],
      };
      const validation = {
        resolved: [{ id: "audioContextSuspended", fixDescription: "Resume audio" }],
        stillPresent: [{ id: "speakerNotSet", description: "Speaker not set" }],
      };

      const summary = generateRecoverySummary(fixResult, validation);

      expect(summary.status).toBe("partial");
      expect(summary.message).toBe("Partially resolved");
    });

    it("returns failed status when all fixes failed", () => {
      const fixResult = {
        fixed: [],
        failed: [{ id: "audioContextSuspended", fixDescription: "Resume audio", error: "Failed" }],
        unfixable: [],
      };
      const validation = {
        resolved: [],
        stillPresent: [],
      };

      const summary = generateRecoverySummary(fixResult, validation);

      expect(summary.status).toBe("failed");
      expect(summary.message).toBe("Could not fix automatically");
    });

    it("returns unfixable status when only unfixable causes found", () => {
      const fixResult = {
        fixed: [],
        failed: [],
        unfixable: [{ id: "remoteParticipantMuted", fixDescription: "Ask others to unmute" }],
      };
      const validation = null;

      const summary = generateRecoverySummary(fixResult, validation);

      expect(summary.status).toBe("unfixable");
      expect(summary.message).toBe("This issue requires manual action");
    });

    it("returns unknown status when no causes found", () => {
      const fixResult = {
        fixed: [],
        failed: [],
        unfixable: [],
        attempted: [],
      };
      const validation = {
        resolved: [],
        stillPresent: [],
      };

      const summary = generateRecoverySummary(fixResult, validation);

      expect(summary.status).toBe("unknown");
      expect(summary.message).toBe("No specific cause identified");
    });

    it("returns partial status when fixes resolved but unfixable causes exist", () => {
      const fixResult = {
        fixed: [{ id: "audioContextSuspended", fixDescription: "Resume audio" }],
        failed: [],
        unfixable: [{ id: "remoteParticipantMuted", fixDescription: "Ask others to unmute" }],
      };
      const validation = {
        resolved: [{ id: "audioContextSuspended", fixDescription: "Resume audio" }],
        stillPresent: [],
      };

      const summary = generateRecoverySummary(fixResult, validation);

      // Should be partial, not success, because there are unfixable causes
      expect(summary.status).toBe("partial");
      expect(summary.message).toBe("Fixed what we could");
      // Should include both the resolved fix and the unfixable info
      expect(summary.details.some(d => d.includes("Resume audio"))).toBe(true);
      expect(summary.details.some(d => d.includes("Ask others to unmute"))).toBe(true);
    });
  });

  /**
   * Integration-style tests for multi-issue scenarios.
   * These test the full diagnosis flow with realistic diagnostic data.
   */
  describe("multi-issue scenarios", () => {
    it("diagnoses multiple causes for multiple reported issues", () => {
      const diagnostics = {
        audioContextState: "suspended",
        localMediaState: {
          audioTrack: { enabled: false },
        },
      };

      // User reports both "can't hear" and "others can't hear me"
      const causes = diagnoseIssues(
        ["cant-hear", "others-cant-hear-me"],
        diagnostics
      );

      // Should find both audioContextSuspended (for cant-hear)
      // and microphoneMuted (for others-cant-hear-me)
      expect(causes.some((c) => c.id === "audioContextSuspended")).toBe(true);
      expect(causes.some((c) => c.id === "microphoneMuted")).toBe(true);
    });

    it("handles 'other' issue type gracefully (no specific diagnosis)", () => {
      const diagnostics = {
        audioContextState: "running",
        localMediaState: {
          audioTrack: { enabled: true, readyState: "live" },
          videoTrack: { enabled: true, readyState: "live" },
        },
      };

      // User reports "something else" - we have no specific causes for this
      const causes = diagnoseIssues(["other"], diagnostics);

      // Should return empty since no ROOT_CAUSES map to 'other'
      expect(causes).toEqual([]);
    });

    it("correctly identifies when all remote participants are muted", () => {
      const diagnostics = {
        audioContextState: "running",
        participants: [
          { local: true, audio: { off: null } },
          { local: false, audio: { off: { byUser: true } } },
          { local: false, audio: { off: { byUser: true } } },
        ],
      };

      const causes = diagnoseIssues(["cant-hear"], diagnostics);

      expect(causes.some((c) => c.id === "remoteParticipantMuted")).toBe(true);
    });

    it("does NOT identify remoteParticipantMuted when some are unmuted", () => {
      const diagnostics = {
        audioContextState: "running",
        participants: [
          { local: true, audio: { off: null } },
          { local: false, audio: { off: { byUser: true } } }, // muted
          { local: false, audio: { off: null } }, // not muted
        ],
      };

      const causes = diagnoseIssues(["cant-hear"], diagnostics);

      // Should NOT detect remoteParticipantMuted since not ALL are muted
      expect(causes.some((c) => c.id === "remoteParticipantMuted")).toBe(false);
    });
  });

  /**
   * Tests for device re-acquisition scenarios.
   * Critical for Safari device ID rotation handling.
   */
  describe("device re-acquisition", () => {
    it("calls setInputDevicesAsync for microphoneTrackEnded with correct device", async () => {
      const setInputDevicesAsync = vi.fn().mockResolvedValue();
      const callObject = { setInputDevicesAsync };
      const devices = {
        microphones: [
          { device: { deviceId: "mic-1", label: "Built-in Mic" } },
          { device: { deviceId: "mic-2", label: "External Mic" } },
        ],
      };
      const player = {
        get: vi.fn((key) => {
          if (key === "micId") return "mic-1";
          if (key === "micLabel") return "Built-in Mic";
          return null;
        }),
      };
      const findMatchingDevice = (devs, id, label) => {
        const match = devs.find((d) => d.device.deviceId === id);
        return match ? { device: match, matchType: "id" } : null;
      };

      const causes = [
        {
          id: "microphoneTrackEnded",
          fixable: true,
          fixDescription: "Re-acquire mic",
        },
      ];

      const result = await attemptSoftFixes(causes, {
        callObject,
        devices,
        player,
        findMatchingDevice,
      });

      expect(setInputDevicesAsync).toHaveBeenCalledWith({
        audioDeviceId: "mic-1",
      });
      expect(result.fixed).toHaveLength(1);
    });

    it("calls setInputDevicesAsync for cameraTrackEnded", async () => {
      const setInputDevicesAsync = vi.fn().mockResolvedValue();
      const callObject = { setInputDevicesAsync };
      const devices = {
        cameras: [{ device: { deviceId: "cam-1", label: "FaceTime Camera" } }],
      };
      const player = {
        get: vi.fn((key) => {
          if (key === "cameraId") return "cam-1";
          if (key === "cameraLabel") return "FaceTime Camera";
          return null;
        }),
      };
      const findMatchingDevice = (devs, id, label) => {
        const match = devs.find((d) => d.device.deviceId === id);
        return match ? { device: match, matchType: "id" } : null;
      };

      const causes = [
        {
          id: "cameraTrackEnded",
          fixable: true,
          fixDescription: "Re-acquire camera",
        },
      ];

      const result = await attemptSoftFixes(causes, {
        callObject,
        devices,
        player,
        findMatchingDevice,
      });

      expect(setInputDevicesAsync).toHaveBeenCalledWith({
        videoDeviceId: "cam-1",
      });
      expect(result.fixed).toHaveLength(1);
    });

    it("calls setSpeaker for speakerNotSet", async () => {
      const setSpeaker = vi.fn().mockResolvedValue();
      const devices = {
        speakers: [
          { device: { deviceId: "spk-1", label: "MacBook Speakers" } },
        ],
        setSpeaker,
      };
      const player = {
        get: vi.fn((key) => {
          if (key === "speakerId") return "spk-1";
          if (key === "speakerLabel") return "MacBook Speakers";
          return null;
        }),
      };
      const findMatchingDevice = (devs, id, label) => {
        const match = devs.find((d) => d.device.deviceId === id);
        return match ? { device: match, matchType: "id" } : null;
      };

      const causes = [
        {
          id: "speakerNotSet",
          fixable: true,
          fixDescription: "Re-align speaker",
        },
      ];

      const result = await attemptSoftFixes(causes, {
        devices,
        player,
        findMatchingDevice,
      });

      expect(setSpeaker).toHaveBeenCalledWith("spk-1");
      expect(result.fixed).toHaveLength(1);
    });
  });

  /**
   * Tests for network issue detection.
   * Important for informing users about connectivity problems.
   */
  describe("network issue detection", () => {
    it("detects high packet loss as network issue", () => {
      const diagnostics = {
        networkStats: {
          stats: {
            latest: {
              videoRecvPacketLoss: 0.1, // 10% packet loss
              rtt: 100,
            },
          },
        },
      };

      const causes = diagnoseIssues(["cant-hear"], diagnostics);

      expect(causes.some((c) => c.id === "networkIssues")).toBe(true);
    });

    it("detects high RTT as network issue", () => {
      const diagnostics = {
        networkStats: {
          stats: {
            latest: {
              videoRecvPacketLoss: 0.01,
              rtt: 600, // 600ms RTT
            },
          },
        },
      };

      const causes = diagnoseIssues(["cant-see"], diagnostics);

      expect(causes.some((c) => c.id === "networkIssues")).toBe(true);
    });

    it("does not flag good network as issue", () => {
      const diagnostics = {
        networkStats: {
          stats: {
            latest: {
              videoRecvPacketLoss: 0.01, // 1% packet loss
              rtt: 50, // 50ms RTT
            },
          },
        },
      };

      const causes = diagnoseIssues(["cant-hear"], diagnostics);

      expect(causes.some((c) => c.id === "networkIssues")).toBe(false);
    });
  });

  /**
   * Tests for permission denial scenarios.
   * These are unfixable and require user action.
   */
  describe("permission denial handling", () => {
    it("identifies microphone permission denied as unfixable", () => {
      const diagnostics = {
        browserPermissions: {
          microphone: "denied",
        },
      };

      const causes = diagnoseIssues(["others-cant-hear-me"], diagnostics);

      const permCause = causes.find(
        (c) => c.id === "microphonePermissionDenied"
      );
      expect(permCause).toBeDefined();
      expect(permCause.fixable).toBe(false);
    });

    it("identifies camera permission denied as unfixable", () => {
      const diagnostics = {
        browserPermissions: {
          camera: "denied",
        },
      };

      const causes = diagnoseIssues(["others-cant-see-me"], diagnostics);

      const permCause = causes.find((c) => c.id === "cameraPermissionDenied");
      expect(permCause).toBeDefined();
      expect(permCause.fixable).toBe(false);
    });
  });
});
