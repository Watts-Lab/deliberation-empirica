import { useEffect } from "react";

/**
 * Sync Empirica player display name into the Daily call.
 *
 * Builds a display name from the player's name and/or title (depending on
 * which fields the stage element is configured to show) and pushes it into
 * Daily via `callObject.setUserName()`.
 *
 * @param {Object} callObject - Daily call object
 * @param {Object} player - Empirica player object
 * @param {boolean} showNickname - Include player.get("name")
 * @param {boolean} showTitle - Include player.get("title")
 */
export function useDisplayNameSync(callObject, player, showNickname, showTitle) {
  let displayName = "";
  if (showNickname && player.get("name")) {
    displayName += player.get("name");
  }
  if (showTitle && player.get("title")) {
    if (displayName) {
      displayName += " - ";
    }
    displayName += player.get("title");
  }
  if (!displayName) {
    displayName = `Participant ${player.get("position")}`;
  }

  useEffect(() => {
    if (!callObject || callObject.isDestroyed?.()) return;
    try {
      callObject.setUserName(displayName);
    } catch (err) {
      console.warn("Failed to set Daily username", err);
    }
  }, [callObject, displayName]);

  return displayName;
}
