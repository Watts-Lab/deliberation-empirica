import { useEffect } from "react";

/**
 * Track Daily session IDs on the Empirica player for data science use.
 *
 * Maintains two pieces of player state:
 * - `dailyId` / `dailyIds`: current and historical session IDs for video feed matching
 * - `dailyIdHistory`: structured log with progressLabel and timestamps for analysis
 *
 * Effect 2 (the history logger) attaches a `joined-meeting` listener AND
 * reruns whenever `progressLabel` changes. The second part is defensive:
 * if Daily's `joined-meeting` event doesn't fire on a given remount (e.g.
 * because `useCallLifecycle` detected the callObject was already in
 * `"joined-meeting"` state from a prior orphaned join and skipped its own
 * `join()`), the progressLabel-driven rerun still triggers the immediate
 * `meetingState()` check and logs the entry. Dedup on `(dailyId,
 * progressLabel)` prevents the rerun from creating duplicates.
 *
 * This belt-and-suspenders matters because dailyIdHistory is the only map
 * from stage to recording session id — if an entry is missed, the
 * downstream video-composition pipeline can't match recordings to stages.
 * Regression context: conversation-processing-pipeline#36 (156 participants
 * with dailyIdHistory.length === 1 despite 3-4 video stages each).
 *
 * @param {Object} callObject - Daily call object
 * @param {string} dailyId - Current Daily session ID (from useLocalSessionId)
 * @param {Object} player - Empirica player object
 * @param {string} progressLabel - Current progress label
 * @param {Function} getElapsedTime - Stable function returning current elapsed time
 */
export function useDailyIdTracking(
  callObject,
  dailyId,
  player,
  progressLabel,
  getElapsedTime
) {
  useEffect(() => {
    if (!dailyId) return;

    // Maintain simple list and current ID (legacy/display usage)
    // This is needed for video feed matching, so set it immediately
    if (player.get("dailyId") !== dailyId) {
      player.set("dailyId", dailyId); // for matching with videos later
      player.append("dailyIds", dailyId); // for displaying by position
    }
  }, [dailyId, player]);

  // Log dailyIdHistory when we actually join the meeting (or whenever
  // progressLabel / dailyId change and we're already joined).
  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return undefined;

    const logDailyIdHistory = () => {
      if (!dailyId) return;

      // Avoid duplicate entries for the same (dailyId, progressLabel) pair.
      // With progressLabel in the effect deps, this guard is what prevents
      // the effect rerun from double-logging when we're already joined.
      const history = player.get("dailyIdHistory") || [];
      const lastEntry = history[history.length - 1];
      if (
        lastEntry &&
        lastEntry.dailyId === dailyId &&
        lastEntry.progressLabel === progressLabel
      ) {
        return;
      }

      try {
        player.append("dailyIdHistory", {
          dailyId,
          progressLabel,
          stageElapsed: getElapsedTime(),
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Failed to log dailyIdHistory:", err);
      }
    };

    callObject.on("joined-meeting", logDailyIdHistory);

    // Fallback: log immediately if we're already joined. Catches the
    // orphaned-join case where useCallLifecycle skipped its own join()
    // because meetingState was already "joined-meeting", so no new
    // joined-meeting event will fire for this mount.
    if (callObject.meetingState?.() === "joined-meeting") {
      logDailyIdHistory();
    }

    return () => {
      callObject.off("joined-meeting", logDailyIdHistory);
    };
    // getElapsedTime is intentionally excluded — it's a stable function from
    // ProgressLabelContext that always returns current elapsed time via
    // internal refs. Including it would add no value and would be flagged
    // by exhaustive-deps if the identity ever changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callObject, dailyId, player, progressLabel]);
}
