import React from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { VideoCall } from "../../../../client/src/components/discussion/call/VideoCall";

/**
 * Component Tests for Client-Side Recording (Issue #949)
 *
 * Tests: REC-001 to REC-006
 *
 * These tests verify that useCallStartSignaling correctly:
 * 1. Starts raw-tracks recording when a participant joins the call
 * 2. Deduplicates within a stage (only one call per stage)
 * 3. Does NOT start recording when recordingEnabled is false
 * 4. Defers Sentry alerts and suppresses them when another participant succeeds
 * 5. Fires Sentry when no participant confirms recording
 *
 * Infrastructure:
 * - window.mockCallObject._startRecordingCalls: array of call logs
 * - window.__mockStartRecordingBehavior: set BEFORE mount to 'reject' for failure tests
 * - window.mockSentryCaptures: Sentry mock capture store
 */

// Base config: recording enabled, participant joined
const recordingEnabledConfig = {
  empirica: {
    currentPlayerId: "p0",
    players: [
      {
        id: "p0",
        attrs: { position: "0", dailyId: "daily-p0", name: "Test User" },
      },
    ],
    game: {
      attrs: { dailyUrl: "https://test.daily.co/room", recordingEnabled: true },
    },
    stage: { attrs: {}, id: "stage-1" },
    stageTimer: { elapsed: 0 },
  },
  daily: {
    localSessionId: "daily-p0",
    participantIds: ["daily-p0"],
    videoTracks: { "daily-p0": { isOff: false, subscribed: true } },
    audioTracks: { "daily-p0": { isOff: false, subscribed: true } },
  },
};

// Config with recording disabled
const recordingDisabledConfig = {
  empirica: {
    currentPlayerId: "p0",
    players: [
      {
        id: "p0",
        attrs: { position: "0", dailyId: "daily-p0", name: "Test User" },
      },
    ],
    game: { attrs: { dailyUrl: "https://test.daily.co/room" } },
    stage: { attrs: {}, id: "stage-1" },
    stageTimer: { elapsed: 0 },
  },
  daily: {
    localSessionId: "daily-p0",
    participantIds: ["daily-p0"],
    videoTracks: { "daily-p0": { isOff: false, subscribed: true } },
    audioTracks: { "daily-p0": { isOff: false, subscribed: true } },
  },
};

test.describe("Client-Side Recording (useCallStartSignaling)", () => {
  /**
   * REC-001: startRecording called on join when recordingEnabled=true
   *
   * Validates:
   * - callObject.startRecording({ type: "raw-tracks" }) is called
   * - Called when meetingState is already "joined-meeting" at effect time
   */
  test("REC-001: startRecording called when participant joins with recording enabled", async ({
    mount,
    page,
  }) => {
    test.slow();
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: recordingEnabledConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // The mock call object starts in 'joined-meeting' state, so the hook
    // should detect that and call startRecording immediately.
    // Poll until the call appears (avoids flaky fixed timeouts).
    await expect(async () => {
      const calls = await page.evaluate(
        () => window.mockCallObject._startRecordingCalls,
      );
      expect(calls.length).toBeGreaterThanOrEqual(1);
    }).toPass({ timeout: 5000 });

    const calls = await page.evaluate(
      () => window.mockCallObject._startRecordingCalls,
    );
    expect(calls[0].options).toEqual({ type: "raw-tracks" });
  });

  /**
   * REC-002: startRecording NOT called when recordingEnabled is false/absent
   *
   * Validates:
   * - No startRecording call when game.recordingEnabled is not set
   */
  test("REC-002: startRecording not called when recording disabled", async ({
    mount,
    page,
  }) => {
    test.slow();
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: recordingDisabledConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Give effects time to run, then verify no recording calls
    await page.waitForTimeout(1000);

    const calls = await page.evaluate(
      () => window.mockCallObject._startRecordingCalls,
    );
    expect(calls.length).toBe(0);
  });

  /**
   * REC-003: Deduplication — second joined-meeting in same stage doesn't
   *          trigger a duplicate startRecording call
   *
   * Validates:
   * - recordingStartedRef guard prevents redundant calls within a stage
   */
  test("REC-003: deduplication prevents duplicate startRecording in same stage", async ({
    mount,
    page,
  }) => {
    test.slow();
    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: recordingEnabledConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Wait for initial startRecording to fire
    await expect(async () => {
      const calls = await page.evaluate(
        () => window.mockCallObject._startRecordingCalls,
      );
      expect(calls.length).toBeGreaterThanOrEqual(1);
    }).toPass({ timeout: 5000 });

    const initialCount = await page.evaluate(
      () => window.mockCallObject._startRecordingCalls.length,
    );

    // Emit joined-meeting again (simulating a reconnection within the same stage)
    await page.evaluate(() => {
      window.mockCallObject.emit("joined-meeting", {});
    });
    await page.waitForTimeout(500);

    // Should NOT have triggered another startRecording (ref guard)
    const finalCount = await page.evaluate(
      () => window.mockCallObject._startRecordingCalls.length,
    );
    expect(finalCount).toBe(initialCount);
  });

  /**
   * REC-004: Sentry suppressed when recording-started event confirms recording
   *
   * Validates:
   * - startRecording fails (rejects) on mount
   * - recording-started event fires (another participant started recording)
   * - No Sentry error captured (false alarm suppressed)
   */
  test("REC-004: Sentry suppressed when another participant starts recording", async ({
    mount,
    page,
  }) => {
    test.slow();

    // Configure startRecording to reject BEFORE mount
    await page.evaluate(() => {
      window.__mockStartRecordingBehavior = "reject";
    });

    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: recordingEnabledConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Wait for the rejected startRecording to run (sets up 5s Sentry timer)
    await page.waitForTimeout(500);

    // Reset Sentry so we only see recording-related captures
    await page.evaluate(() => window.mockSentryCaptures.reset());

    // Simulate another participant successfully starting recording
    await page.evaluate(() => {
      window.mockCallObject.emit("recording-started", {});
    });

    // Wait past the 5s deferred Sentry timer
    await page.waitForTimeout(6000);

    // Sentry should NOT have a recording failure message
    const captures = await page.evaluate(() => window.mockSentryCaptures);
    const recordingErrors = captures.messages.filter(
      (m) => m.message === "Recording not started for stage",
    );
    expect(recordingErrors.length).toBe(0);
  });

  /**
   * REC-005: Sentry fires when no participant confirms recording
   *
   * Validates:
   * - startRecording fails (rejects) on mount
   * - No recording-started event fires within 5s
   * - Sentry.captureMessage fires with level "error"
   */
  test("REC-005: Sentry fires when recording never confirmed", async ({
    mount,
    page,
  }) => {
    test.slow();

    // Configure startRecording to reject BEFORE mount
    await page.evaluate(() => {
      window.__mockStartRecordingBehavior = "reject";
    });

    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: recordingEnabledConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Reset Sentry after mount so we start clean
    await page.evaluate(() => window.mockSentryCaptures.reset());

    // Wait past the 5s deferred Sentry timer (no recording-started event)
    await page.waitForTimeout(6000);

    const captures = await page.evaluate(() => window.mockSentryCaptures);
    const recordingErrors = captures.messages.filter(
      (m) => m.message === "Recording not started for stage",
    );
    expect(recordingErrors.length).toBeGreaterThanOrEqual(1);
    expect(recordingErrors[0].hint.level).toBe("error");
    expect(recordingErrors[0].hint.extra.triggeringError).toBeTruthy();
  });

  /**
   * REC-005b: No crash when startRecording returns undefined (non-Promise)
   *
   * Validates:
   * - callObject.startRecording() returns undefined (transitional state)
   * - Component does NOT crash (no TypeError on .then())
   * - Sentry fires deferred alert when no recording confirmed
   *
   * Regression test for #1226
   */
  test("REC-005b: no crash when startRecording returns undefined", async ({
    mount,
    page,
  }) => {
    test.slow();

    // Configure startRecording to return undefined BEFORE mount
    await page.evaluate(() => {
      window.__mockStartRecordingBehavior = "return-undefined";
    });

    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: recordingEnabledConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Verify startRecording was called (but returned undefined)
    await expect(async () => {
      const calls = await page.evaluate(
        () => window.mockCallObject._startRecordingCalls,
      );
      expect(calls.length).toBeGreaterThanOrEqual(1);
    }).toPass({ timeout: 5000 });

    // Reset Sentry after mount so we start clean
    await page.evaluate(() => window.mockSentryCaptures.reset());

    // Wait past the 5s deferred Sentry timer (no recording-started event)
    await page.waitForTimeout(6000);

    // Sentry should fire with "non-promise return" as the triggering error
    const captures = await page.evaluate(() => window.mockSentryCaptures);
    const recordingErrors = captures.messages.filter(
      (m) => m.message === "Recording not started for stage",
    );
    expect(recordingErrors.length).toBeGreaterThanOrEqual(1);
    expect(recordingErrors[0].hint.level).toBe("error");
    expect(recordingErrors[0].hint.extra.triggeringError).toBe(
      "non-promise return",
    );
  });

  /**
   * REC-006: Sentry fires on recording-error when no recording confirmed
   *
   * Validates:
   * - Daily fires recording-error event
   * - No recording-started event fires within 5s
   * - Sentry captures with appropriate message
   */
  test("REC-006: Sentry fires on recording-error when not confirmed", async ({
    mount,
    page,
  }) => {
    test.slow();

    const component = await mount(<VideoCall showSelfView />, {
      hooksConfig: recordingEnabledConfig,
    });
    await expect(component).toBeVisible({ timeout: 15000 });

    // Reset Sentry after mount
    await page.evaluate(() => window.mockSentryCaptures.reset());

    // Fire a recording-error event
    await page.evaluate(() => {
      window.mockCallObject.emit("recording-error", {
        errorMsg: "recording failed",
        error: { type: "recording-error" },
      });
    });

    // Wait past the 5s deferred Sentry timer
    await page.waitForTimeout(6000);

    const captures = await page.evaluate(() => window.mockSentryCaptures);
    const recordingErrors = captures.messages.filter(
      (m) =>
        m.message === "Daily recording-error \u2014 no recording confirmed",
    );
    expect(recordingErrors.length).toBeGreaterThanOrEqual(1);
    expect(recordingErrors[0].hint.level).toBe("error");
  });
});
