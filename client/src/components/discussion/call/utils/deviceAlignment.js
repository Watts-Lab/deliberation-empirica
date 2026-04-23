/**
 * Device alignment utilities for matching preferred devices to available devices.
 *
 * Safari rotates device IDs for privacy, so we use a 3-tier fallback strategy:
 * 1. ID Match - exact deviceId match
 * 2. Label Match - human-readable label match (survives Safari ID rotation)
 * 3. Fallback - first available device
 */

/**
 * Finds the best matching device from a list based on preferred ID and label.
 *
 * @param {Array} devices - Array of device objects with { device: { deviceId, label } }
 * @param {string|null} preferredId - The preferred device ID (may be stale after Safari rotation)
 * @param {string|null} preferredLabel - The preferred device label (stable across sessions)
 * @returns {{ device: Object, matchType: 'id'|'label'|'fallback' }|null}
 */
export function findMatchingDevice(devices, preferredId, preferredLabel) {
  if (!devices || devices.length === 0) {
    return null;
  }

  // Strategy 1: Try exact ID match
  const idMatch = devices.find((d) => d.device.deviceId === preferredId);
  if (idMatch) {
    return { device: idMatch, matchType: "id" };
  }

  // Strategy 2: Try label match (Safari workaround)
  if (preferredLabel) {
    const labelMatch = devices.find((d) => d.device.label === preferredLabel);
    if (labelMatch) {
      return { device: labelMatch, matchType: "label" };
    }
  }

  // Strategy 3: Fall back to first available device
  return { device: devices[0], matchType: "fallback" };
}

/**
 * Checks if device alignment is needed (current device doesn't match target).
 *
 * @param {Object|null} currentDevice - Current device with { device: { deviceId } }
 * @param {string} targetId - Target device ID
 * @returns {boolean}
 */
export function needsAlignment(currentDevice, targetId) {
  const currentId = currentDevice?.device?.deviceId;
  return currentId !== targetId;
}

/**
 * Creates a summary of device alignment status for diagnostics.
 *
 * @param {string|null} preferredId - Preferred device ID
 * @param {string|null} preferredLabel - Preferred device label
 * @param {string|null} currentId - Current device ID
 * @param {string|null} currentLabel - Current device label
 * @returns {Object} Alignment status object
 */
export function getAlignmentStatus(
  preferredId,
  preferredLabel,
  currentId,
  currentLabel
) {
  return {
    preferredId: preferredId || null,
    preferredLabel: preferredLabel || null,
    currentId: currentId || null,
    currentLabel: currentLabel || null,
    matchedById:
      preferredId && currentId ? preferredId === currentId : null,
    matchedByLabel:
      preferredLabel && currentLabel ? preferredLabel === currentLabel : null,
  };
}
