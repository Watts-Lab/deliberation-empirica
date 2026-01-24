/**
 * Utility functions for scroll detection.
 * These are pure functions for easy unit testing.
 */

/**
 * Determines if a scroll container is at or near the bottom.
 * @param {number} scrollHeight - Total scrollable height of the content
 * @param {number} scrollTop - Current scroll position from top
 * @param {number} clientHeight - Visible height of the container
 * @param {number} threshold - Pixel threshold for "near bottom" (default 80px)
 * @returns {boolean} True if scroll position is at or near bottom
 */
export function isAtBottom(scrollHeight, scrollTop, clientHeight, threshold = 80) {
    // Guard against invalid inputs
    if (scrollHeight <= 0 || clientHeight <= 0) {
        return true; // If container has no scrollable content, consider it "at bottom"
    }

    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom < threshold;
}
