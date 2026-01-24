import React from "react";

/**
 * Visual indicator that appears when new content is available below the viewport.
 * Non-clickable, purely visual hint with fade-in animation.
 *
 * @param {Object} props
 * @param {boolean} props.visible - Whether the indicator should be shown
 */
export function ScrollIndicator({ visible }) {
    if (!visible) return null;

    return (
        <div
            className="scroll-indicator"
            aria-hidden="true"
            data-testid="scroll-indicator"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <polyline points="6 9 12 15 18 9" />
            </svg>
        </div>
    );
}
