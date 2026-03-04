import { useEffect } from "react";
import * as Sentry from "@sentry/react";

/**
 * Proactively monitor local media tracks for silent failures.
 *
 * Silently ended tracks (browser killed them, device sleep, etc.) leave the
 * user with frozen video or dead audio and no indication. This hook polls
 * track `readyState` every 5 seconds and auto-recovers by re-acquiring
 * the device.
 *
 * @param {Object} callObject - Daily call object
 */
export function useTrackMonitor(callObject) {
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
}
