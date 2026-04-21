import { useEffect, useRef } from "react";

/**
 * Track Daily session IDs on the Empirica player for data science use.
 *
 * Maintains two pieces of player state:
 * - `dailyId` / `dailyIds`: current and historical session IDs for video feed matching
 * - `dailyIdHistory`: structured log with progressLabel and timestamps for analysis
 *
 * The history entry is only written when the `joined-meeting` event fires, not on
 * every progressLabel change within the same session.
 * In theory, we shouldn't have changes to progressLabel within a stage, because
 * the progress label provider should always give up-to-date values.
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
  // Store progressLabel in ref so event handlers always access current value
  // (getElapsedTime is now stable and always returns current values from ProgressLabelContext)
  const progressLabelRef = useRef(progressLabel);
  progressLabelRef.current = progressLabel;

  useEffect(() => {
    if (!dailyId) return;

    // Maintain simple list and current ID (legacy/display usage)
    // This is needed for video feed matching, so set it immediately
    if (player.get("dailyId") !== dailyId) {
      player.set("dailyId", dailyId); // for matching with videos later
      player.append("dailyIds", dailyId); // for displaying by position
    }
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
}
