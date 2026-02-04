import { useDaily, useDailyEvent } from "@daily-co/daily-react";
import { useCallback, useEffect, useRef } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { useGetElapsedTime } from "../../components/progressLabel";

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
  const getElapsedTime = useGetElapsedTime();

  /**
   * Write a structured event to the current Empirica stage.
   * We use the elapsed time from context so that analytics line up
   * with the stage duration even if clients have skewed system clocks.
   */
  const logEvent = useCallback(
    (event, data = {}) => {
      if (!player?.stage) return;

      const elapsedSeconds = getElapsedTime();

      player.stage.append("speakerEvents", {
        event,
        timestamp: elapsedSeconds,
        debug: data,
        position: player.get("position"),
      });
    },
    [player, getElapsedTime]
  );

  useDailyEvent("joined-meeting", (ev) => {
    const dailyId = ev?.participants?.local?.user_id;
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

  // Log Daily errors for debugging. These often indicate permission or device issues.
  useDailyEvent("error", (ev) => {
    console.log("[Daily] Error event:", {
      type: ev?.type,
      errorMsg: ev?.errorMsg,
      error: ev?.error,
    });
  });

  // Log remote participant track changes for subscription debugging.
  // These show up in Sentry breadcrumbs when a user reports an AV issue.
  const lastParticipantState = useRef({});
  const onParticipantUpdated = useCallback((ev) => {
    if (!ev?.participant || ev.participant.local) return; // skip local participant
    const p = ev.participant;
    const newState = {
      audio: {
        subscribed: p.tracks?.audio?.subscribed,
        state: p.tracks?.audio?.state,
      },
      video: {
        subscribed: p.tracks?.video?.subscribed,
        state: p.tracks?.video?.state,
      },
    };
    const lastState = lastParticipantState.current[p.session_id];
    if (JSON.stringify(newState) === JSON.stringify(lastState)) return;
    lastParticipantState.current[p.session_id] = newState;
    console.log("[Daily] Remote participant updated:", {
      sessionId: p.session_id?.slice(0, 8),
      ...newState,
    });
  }, []);
  useDailyEvent("participant-updated", onParticipantUpdated);

  const pollIntervalRef = useRef(null);

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return undefined;

    // Some metrics (bitrate, packet loss) are only available through
    // `getNetworkStats()`. Poll every 30s to create a coarse timeline.
    let cancelled = false;

    const poll = async () => {
      if (cancelled || !callObject || callObject.isDestroyed?.()) return;
      try {
        const networkStats = await callObject.getNetworkStats();
        logEvent("network-stats", networkStats);
      } catch (err) {
        if (!callObject.isDestroyed?.()) {
          console.warn("Failed to fetch network stats", err);
        }
      }
    };

    // Log immediately so the first snapshot exists even on short calls.
    poll();
    pollIntervalRef.current = setInterval(poll, 30000);

    return () => {
      cancelled = true;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [callObject, logEvent]);
}

export function useStageEventLogger() {
  const player = usePlayer();
  const getElapsedTime = useGetElapsedTime();
  const playerRef = useRef(player);
  const getElapsedRef = useRef(getElapsedTime);

  // Keep refs in sync with the latest player/getter objects so the logger callback
  // can stay memoized (important for downstream deps) while still logging fresh data.
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    getElapsedRef.current = getElapsedTime;
  }, [getElapsedTime]);

  return useCallback((event, data = {}) => {
    const currentPlayer = playerRef.current;
    const currentGetElapsed = getElapsedRef.current;
    if (!currentPlayer?.stage) return;

    const elapsedSeconds = currentGetElapsed();

    currentPlayer.stage.append("speakerEvents", {
      event,
      timestamp: elapsedSeconds,
      debug: data,
      position: currentPlayer.get("position"),
    });

    console.log(`Logged stage event: ${event}`, {
      event,
      timestamp: elapsedSeconds,
      debug: data,
      position: currentPlayer.get("position"),
    });
  }, []);
}
