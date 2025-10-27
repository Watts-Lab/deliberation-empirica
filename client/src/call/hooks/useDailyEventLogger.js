import { useDaily, useDailyEvent } from "@daily-co/daily-react";
import { useCallback, useEffect, useRef } from "react";
import {
  usePlayer,
  useStageTimer,
  useStage,
} from "@empirica/core/player/classic/react";

/**
 * Centralized Daily event logging.
 *
 * Why this hook exists:
 *  - Tray buttons (or other UI) should only change state; logging the effects
 *    belongs in one predictable place.
 *  - We log from Daily.js events so we capture *every* toggle, even ones
 *    triggered via keyboard shortcuts or external controls.
 *  - All entries are written to `player.stage` with an elapsed stage timestamp
 *    so downstream analysis can reconstruct the meeting timeline.
 */
export function useDailyEventLogger() {
  const callObject = useDaily();
  const player = usePlayer();
  const stageTimer = useStageTimer();
  const stage = useStage();

  /**
   * Write a structured event to the current Empirica stage.
   * We prefer stage timer seconds over wall-clock time so that
   * analytics line up with the stage duration even if clients have
   * skewed system clocks.
   */
  const logEvent = useCallback(
    (event, data = {}) => {
      if (!player?.stage) return;

      let elapsedSeconds = null;
      if (typeof stageTimer?.elapsed === "number") {
        elapsedSeconds = stageTimer.elapsed / 1000;
      } else {
        const startedAt = player.get("localStageStartTime");
        if (startedAt) {
          elapsedSeconds = (Date.now() - startedAt) / 1000;
        }
      }

      player.stage.append("speakerEvents", {
        event,
        timestamp: elapsedSeconds,
        debug: data,
      });
    },
    [player, stageTimer]
  );

  useDailyEvent("joined-meeting", (ev) => {
    const dailyId = ev?.participants?.local?.user_id;

    if (player && dailyId) {
      try {
        player.append("dailyIds", dailyId);
      } catch (err) {
        console.error("Failed to append Daily ID", err);
      }
      try {
        player.set("dailyId", dailyId);
      } catch (err) {
        console.error("Failed to set current Daily ID", err);
      }
    }

    // if we are the first to join, trigger server-side action to start recording
    if (stage && stage.get("callStarted") !== true) {
      try {
        stage.set("callStarted", true);
      } catch (err) {
        console.error("Failed to set callStarted flag", err);
      }
    }

    logEvent("joined-meeting", { dailyId });
  });

  useDailyEvent("left-meeting", (ev) => {
    if (player) {
      try {
        player.set("dailyId", null);
      } catch (err) {
        console.error("Failed to clear Daily ID", err);
      }
    }

    logEvent("left-meeting", { reason: ev?.reason });
  });

  useDailyEvent("local-track-started", (ev) => {
    if (ev?.kind === "video") {
      logEvent("video-unmuted");
    }
    if (ev?.kind === "audio") {
      logEvent("audio-unmuted");
    }
  });

  useDailyEvent("local-track-stopped", (ev) => {
    if (ev?.kind === "video") {
      logEvent("video-muted");
    }
    if (ev?.kind === "audio") {
      logEvent("audio-muted");
    }
  });

  // Once per second Daily re-evaluates network health for the local participant.
  // We only care when the rating actually changes (0–5).
  useDailyEvent("network-quality-change", (ev) => {
    if (ev?.quality == null) return;
    logEvent("network-quality-change", {
      quality: ev.quality,
      reason: ev.reason,
    });
  });

  const pollIntervalRef = useRef(null);

  useEffect(() => {
    if (!callObject) return undefined;

    // Some metrics (bitrate, packet loss) are only available through
    // `getNetworkStats()`. Poll every 30s to create a coarse timeline.
    const poll = async () => {
      try {
        const networkStats = await callObject.getNetworkStats();
        logEvent("network-stats", networkStats);
      } catch (err) {
        console.warn("Failed to fetch network stats", err);
      }
    };

    // Log immediately so the first snapshot exists even on short calls.
    poll();
    pollIntervalRef.current = setInterval(poll, 30000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [callObject, logEvent]);
}
