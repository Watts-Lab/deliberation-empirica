import { useState, useEffect, useCallback, useRef } from "react";
import { isAtBottom } from "./scrollUtils";

/**
 * Custom hook for scroll awareness in content containers.
 * Detects when new content appears below the viewport and either:
 * - Auto-scrolls to "peek" the content if user is near bottom
 * - Shows an indicator if user is not near bottom
 *
 * @param {React.RefObject} containerRef - Ref to the scrollable container element
 * @param {number} childCount - Current number of child elements (triggers detection)
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - Pixels from bottom to consider "at bottom" (default: 80)
 * @returns {Object} { showIndicator: boolean, dismissIndicator: function }
 */
export function useScrollAwareness(containerRef, childCount, options = {}) {
    const { threshold = 80 } = options;
    const [showIndicator, setShowIndicator] = useState(false);
    const prevChildCountRef = useRef(childCount);
    const wasAtBottomRef = useRef(true);

    // Check if currently at bottom
    const checkAtBottom = useCallback(() => {
        const container = containerRef.current;
        if (!container) return true;

        return isAtBottom(
            container.scrollHeight,
            container.scrollTop,
            container.clientHeight,
            threshold
        );
    }, [containerRef, threshold]);

    // Handle scroll events - dismiss indicator when user scrolls down
    const handleScroll = useCallback(() => {
        if (showIndicator && checkAtBottom()) {
            setShowIndicator(false);
        }
    }, [showIndicator, checkAtBottom]);

    // Set up scroll listener
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;

        container.addEventListener("scroll", handleScroll, { passive: true });
        return () => container.removeEventListener("scroll", handleScroll);
    }, [containerRef, handleScroll]);

    // Detect content changes and respond appropriately
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Only respond if child count increased (new content added)
        if (childCount > prevChildCountRef.current) {
            // Use a small delay to let React finish rendering the new content
            const timeoutId = setTimeout(() => {
                const atBottom = wasAtBottomRef.current;

                if (atBottom) {
                    // User was at bottom - auto-scroll to peek the new content
                    container.scrollTo({
                        top: container.scrollHeight,
                        behavior: "smooth",
                    });
                } else {
                    // User was not at bottom - show indicator
                    setShowIndicator(true);
                }
            }, 50);

            return () => clearTimeout(timeoutId);
        }

        // Update refs for next comparison
        prevChildCountRef.current = childCount;
        wasAtBottomRef.current = checkAtBottom();

        return undefined;
    }, [childCount, containerRef, checkAtBottom]);

    // Track scroll position continuously to know if user is at bottom
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;

        const updateAtBottom = () => {
            wasAtBottomRef.current = checkAtBottom();
        };

        container.addEventListener("scroll", updateAtBottom, { passive: true });
        updateAtBottom(); // Initial check

        return () => container.removeEventListener("scroll", updateAtBottom);
    }, [containerRef, checkAtBottom]);

    const dismissIndicator = useCallback(() => {
        setShowIndicator(false);
    }, []);

    return { showIndicator, dismissIndicator };
}
