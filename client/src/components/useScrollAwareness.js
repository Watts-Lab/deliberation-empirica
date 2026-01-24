import { useState, useEffect, useCallback, useRef } from "react";
import { isAtBottom } from "./scrollUtils";

/**
 * Custom hook for scroll awareness in content containers.
 * Detects when new content appears below the viewport (by monitoring scrollHeight)
 * and either:
 * - Auto-scrolls to "peek" the content if user is near bottom
 * - Shows an indicator if user is not near bottom
 *
 * @param {React.RefObject} containerRef - Ref to the scrollable container element
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - Pixels from bottom to consider "at bottom" (default: 80)
 * @returns {Object} { showIndicator: boolean, dismissIndicator: function }
 */
export function useScrollAwareness(containerRef, options = {}) {
    const { threshold = 80 } = options;
    const [showIndicator, setShowIndicator] = useState(false);
    const prevScrollHeightRef = useRef(0);
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
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;

        const handleScroll = () => {
            // Update wasAtBottom continuously
            wasAtBottomRef.current = checkAtBottom();

            // Dismiss indicator when user scrolls to bottom
            if (showIndicator && wasAtBottomRef.current) {
                setShowIndicator(false);
            }
        };

        container.addEventListener("scroll", handleScroll, { passive: true });
        // Initial check
        wasAtBottomRef.current = checkAtBottom();
        prevScrollHeightRef.current = container.scrollHeight;

        return () => container.removeEventListener("scroll", handleScroll);
    }, [containerRef, checkAtBottom, showIndicator]);

    // Use ResizeObserver to detect when content height changes
    // This works because conditional content appearing = scrollHeight increasing
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;

        const resizeObserver = new ResizeObserver(() => {
            const currentScrollHeight = container.scrollHeight;
            const prevScrollHeight = prevScrollHeightRef.current;

            // Only respond if scrollHeight increased (new content appeared)
            if (currentScrollHeight > prevScrollHeight && prevScrollHeight > 0) {
                const wasAtBottom = wasAtBottomRef.current;

                if (wasAtBottom) {
                    // User was at bottom - auto-scroll to peek the new content
                    // Use setTimeout to let the browser finish layout
                    setTimeout(() => {
                        container.scrollTo({
                            top: container.scrollHeight,
                            behavior: "smooth",
                        });
                    }, 10);
                } else {
                    // User was not at bottom - show indicator
                    setShowIndicator(true);
                }
            }

            prevScrollHeightRef.current = currentScrollHeight;
        });

        resizeObserver.observe(container);

        return () => resizeObserver.disconnect();
    }, [containerRef]);

    const dismissIndicator = useCallback(() => {
        setShowIndicator(false);
    }, []);

    return { showIndicator, dismissIndicator };
}
