import React from "react";

// Keyframe styles for animations - kept inline with component
const keyframeStyles = `
  @keyframes scrollIndicatorFadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes scrollIndicatorPulse {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.05);
      opacity: 0.85;
    }
  }
`;

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
    <>
      <style>{keyframeStyles}</style>
      <div
        className="sticky bottom-0 left-0 right-0 flex justify-center p-3 pointer-events-none z-50"
        style={{ animation: "scrollIndicatorFadeIn 0.3s ease-out" }}
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
          className="bg-gray-200/80 text-gray-600 rounded-full p-2 w-10 h-10 shadow-md backdrop-blur-sm"
          style={{ animation: "scrollIndicatorPulse 2s ease-in-out infinite" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </>
  );
}
