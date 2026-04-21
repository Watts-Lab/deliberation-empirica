/**
 * Audio level utilities for the video call tray
 */

/**
 * Transform raw audio volume to a display-friendly level.
 * Uses square root transformation to emphasize speech detection
 * (makes quiet sounds more visible, prevents loud sounds from dominating).
 *
 * @param {number} rawVolume - Raw volume from 0 to 1
 * @returns {number} Transformed level from 0 to 1
 */
export function transformAudioLevel(rawVolume) {
    // Clamp input to valid range, then apply square root for perceptual scaling
    const clamped = Math.max(0, Math.min(1, rawVolume));
    return Math.sqrt(clamped);
}
