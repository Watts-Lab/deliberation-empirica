import { useEffect, useRef } from "react";

/**
 * Track page visibility and focus events for debugging and analytics.
 *
 * Firefox may suspend media API calls when the tab loses focus. This hook
 * records blur/focus events to player state so they can be correlated with
 * connection issues in analysis (issue #1187).
 *
 * NOTE: Disabled in component tests (detected via `window.mockPlayers`)
 * because the blur/focus listeners interfere with Playwright click handling.
 *
 * @param {Object} player - Empirica player object
 * @param {Function} getElapsedTime - Stable function returning stage-relative elapsed time
 * @param {string} progressLabel - Current progress label
 */
export function useVisibilityTracking(player, getElapsedTime, progressLabel) {
  const progressLabelRef = useRef(progressLabel);
  progressLabelRef.current = progressLabel;

  useEffect(() => {
    // Skip visibility tracking in component tests
    if (typeof window !== "undefined" && window.mockPlayers) {
      return undefined;
    }

    const logVisibilityEvent = (eventType, detail = {}) => {
      const entry = {
        event: eventType,
        timestamp: new Date().toISOString(),
        stageElapsed: getElapsedTime(),
        progressLabel: progressLabelRef.current,
        ...detail,
      };
      // Store to player state for analytics (no console log to reduce noise)
      try {
        player.append("visibilityHistory", entry);
      } catch (err) {
        // Silently fail - visibility tracking is non-critical
      }
    };

    const handleVisibilityChange = () => {
      logVisibilityEvent(document.hidden ? "hidden" : "visible", {
        visibilityState: document.visibilityState,
      });
    };

    const handleFocus = () => {
      logVisibilityEvent("focus");
    };

    const handleBlur = () => {
      logVisibilityEvent("blur");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    // Log initial state
    logVisibilityEvent("mount", {
      visibilityState: document.visibilityState,
      hasFocus: document.hasFocus(),
    });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, [player, getElapsedTime]);
}
