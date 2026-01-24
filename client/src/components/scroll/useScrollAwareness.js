import { useState, useEffect, useCallback, useRef } from "react";
import { isAtBottom } from "./scrollUtils";

/**
 * Custom hook for scroll awareness in content containers.
 * Detects when new content appears below the viewport (by monitoring DOM changes)
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
    const { threshold = 120 } = options;
    const [showIndicator, setShowIndicator] = useState(false);
    const prevScrollHeightRef = useRef(0);
    const wasAtBottomRef = useRef(true);
    const isInitializedRef = useRef(false); // Skip initial page load

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

    // Use MutationObserver to detect when DOM children change
    // This fires when React renders new content (conditional elements becoming visible)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;

        const checkForNewContent = () => {
            const currentScrollHeight = container.scrollHeight;
            const scrollTop = container.scrollTop;
            const prevScrollHeight = prevScrollHeightRef.current;


            // Only respond if scrollHeight increased (new content appeared)
            if (currentScrollHeight > prevScrollHeight && prevScrollHeight > 0) {
                // Skip first detection (initial page load)
                if (!isInitializedRef.current) {
                    isInitializedRef.current = true;
                    prevScrollHeightRef.current = currentScrollHeight;
                    return;
                }

                // Check if user WAS at bottom BEFORE content was added
                // We use prevScrollHeight because that's the height when user last scrolled
                const wasAtBottom = isAtBottom(
                    prevScrollHeight,
                    scrollTop,
                    container.clientHeight,
                    threshold
                );
                const heightDelta = currentScrollHeight - prevScrollHeight;


                if (wasAtBottom) {
                    // User was at bottom - "peek" scroll to show just the top of new content
                    const peekAmount = Math.min(heightDelta, 150); // Cap at 150px for gentle peek
                    const startScrollTop = scrollTop;

                    // Custom smooth scroll with longer duration for gentler feel
                    const duration = 900; // 900ms for very smooth, relaxed animation
                    const startTime = performance.now();

                    const animateScroll = (currentTime) => {
                        const elapsed = currentTime - startTime;
                        const progress = Math.min(elapsed / duration, 1);

                        // Ease-in-out cubic for smooth acceleration and deceleration
                        const easeInOut =
                            progress < 0.5
                                ? 4 * progress * progress * progress
                                : 1 - Math.pow(-2 * progress + 2, 3) / 2;
                        const currentScrollTop = startScrollTop + peekAmount * easeInOut;

                        container.scrollTop = currentScrollTop;

                        if (progress < 1) {
                            requestAnimationFrame(animateScroll);
                        }
                    };

                    // Small delay before starting to let content settle
                    setTimeout(() => requestAnimationFrame(animateScroll), 50);
                } else {
                    // User was not at bottom - show indicator
                    setShowIndicator(true);
                }
            }

            prevScrollHeightRef.current = currentScrollHeight;
        };

        const mutationObserver = new MutationObserver(() => {
            // Use requestAnimationFrame to wait for layout to complete
            requestAnimationFrame(() => {
                checkForNewContent();
            });
        });

        mutationObserver.observe(container, {
            childList: true, // Watch for children being added/removed
            subtree: true, // Watch all descendants
            characterData: true, // Watch for text content changes
        });

        // Initial check
        prevScrollHeightRef.current = container.scrollHeight;

        return () => mutationObserver.disconnect();
    }, [containerRef, threshold]);

    const dismissIndicator = useCallback(() => {
        setShowIndicator(false);
    }, []);

    return { showIndicator, dismissIndicator };
}
