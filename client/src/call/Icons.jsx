import React from "react";

// ------------------- SVG icon snippets shared across call UI ---------------------

export function CameraOn() {
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5 7.5C3.89543 7.5 3 8.39543 3 9.5V14.5C3 15.6046 3.89543 16.5 5 16.5H13C14.1046 16.5 15 15.6046 15 14.5V9.5C15 8.39543 14.1046 7.5 13 7.5H5ZM16.5 10.9491C16.5 10.6634 16.6221 10.3914 16.8356 10.2017L19.3356 7.97943C19.9805 7.40618 21 7.86399 21 8.72684V15.2732C21 16.136 19.9805 16.5938 19.3356 16.0206L16.8356 13.7983C16.6221 13.6086 16.5 13.3366 16.5 13.0509V10.9491Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CameraOff() {
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20.5303 4.53033C20.8232 4.23744 20.8232 3.76256 20.5303 3.46967C20.2374 3.17678 19.7626 3.17678 19.4697 3.46967L14.6168 8.32252L14.6162 8.32164L6.43781 16.5H6.43934L3.46967 19.4697C3.17678 19.7626 3.17678 20.2374 3.46967 20.5303C3.76256 20.8232 4.23744 20.8232 4.53033 20.5303L8.56066 16.5H13C14.1046 16.5 15 15.6046 15 14.5V10.0607L20.5303 4.53033Z"
        fill="#f63135"
      />
      <path
        d="M13.2949 7.52159C13.1987 7.50737 13.1002 7.5 13 7.5H5C3.89543 7.5 3 8.39543 3 9.5V14.5C3 15.3978 3.59155 16.1574 4.40614 16.4104L13.2949 7.52159Z"
        fill="#f63135"
      />
      <path
        d="M16.5 10.9491C16.5 10.6634 16.6221 10.3914 16.8356 10.2017L19.3356 7.97943C19.9805 7.40618 21 7.86399 21 8.72684V15.2732C21 16.136 19.9805 16.5938 19.3356 16.0206L16.8356 13.7983C16.6221 13.6086 16.5 13.3366 16.5 13.0509V10.9491Z"
        fill="#f63135"
      />
    </svg>
  );
}

export function MicrophoneOn() {
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 3C10.3431 3 9 4.34315 9 6V12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12V6C15 4.34315 13.6569 3 12 3ZM7.5 12C7.5 11.5858 7.16421 11.25 6.75 11.25C6.33579 11.25 6 11.5858 6 12C6 13.9175 6.62158 15.4436 7.73826 16.4858C8.67527 17.3603 9.90114 17.8386 11.25 17.9654V20.25C11.25 20.6642 11.5858 21 12 21C12.4142 21 12.75 20.6642 12.75 20.25V17.9654C14.0989 17.8386 15.3247 17.3603 16.2617 16.4858C17.3784 15.4436 18 13.9175 18 12C18 11.5858 17.6642 11.25 17.25 11.25C16.8358 11.25 16.5 11.5858 16.5 12C16.5 13.5825 15.9966 14.6814 15.2383 15.3892C14.4713 16.105 13.3583 16.5 12 16.5C10.6417 16.5 9.52867 16.105 8.76174 15.3892C8.00342 14.6814 7.5 13.5825 7.5 12Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Microphone icon with real-time audio level indicator.
 * Shows a green fill inside the mic body that rises/falls based on speech volume.
 *
 * @param {Object} props
 * @param {number} props.level - Audio level from 0 to 1 (after transformation)
 */
export function MicrophoneWithLevel({ level = 0 }) {
  // Calculate fill height as percentage (inverted for SVG coordinate system)
  // The mic body spans roughly from y=3 to y=15, so we animate within that range
  const fillHeight = Math.max(0, Math.min(1, level)) * 100;

  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-test="micLevelIndicator"
    >
      <defs>
        {/* Clip path to constrain the level indicator within the mic body */}
        <clipPath id="micBodyClip">
          <ellipse cx="12" cy="9" rx="3" ry="6" />
        </clipPath>
      </defs>

      {/* Microphone outline (same as MicrophoneOn) */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 3C10.3431 3 9 4.34315 9 6V12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12V6C15 4.34315 13.6569 3 12 3ZM7.5 12C7.5 11.5858 7.16421 11.25 6.75 11.25C6.33579 11.25 6 11.5858 6 12C6 13.9175 6.62158 15.4436 7.73826 16.4858C8.67527 17.3603 9.90114 17.8386 11.25 17.9654V20.25C11.25 20.6642 11.5858 21 12 21C12.4142 21 12.75 20.6642 12.75 20.25V17.9654C14.0989 17.8386 15.3247 17.3603 16.2617 16.4858C17.3784 15.4436 18 13.9175 18 12C18 11.5858 17.6642 11.25 17.25 11.25C16.8358 11.25 16.5 11.5858 16.5 12C16.5 13.5825 15.9966 14.6814 15.2383 15.3892C14.4713 16.105 13.3583 16.5 12 16.5C10.6417 16.5 9.52867 16.105 8.76174 15.3892C8.00342 14.6814 7.5 13.5825 7.5 12Z"
        fill="currentColor"
      />

      {/* Audio level indicator - green fill that rises from bottom */}
      <g clipPath="url(#micBodyClip)">
        <rect
          x="9"
          y={15 - (12 * fillHeight) / 100}
          width="6"
          height={(12 * fillHeight) / 100}
          fill="#22c55e"
          className="transition-all duration-100 ease-out"
        />
      </g>
    </svg>
  );
}

export function MicrophoneOff() {
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 3C13.5979 3 14.904 4.24928 14.9949 5.8244L9 11.8193V6C9 4.34315 10.3431 3 12 3Z"
        fill="#f63135"
      />
      <path
        d="M15 10.0607L20.5303 4.53033C20.8232 4.23744 20.8232 3.76256 20.5303 3.46967C20.2374 3.17678 19.7626 3.17678 19.4697 3.46967L3.46967 19.4697C3.17678 19.7626 3.17678 20.2374 3.46967 20.5303C3.76256 20.8232 4.23744 20.8232 4.53033 20.5303L8.19557 16.8651C9.05938 17.5005 10.1108 17.8583 11.25 17.9654V20.25C11.25 20.6642 11.5858 21 12 21C12.4142 21 12.75 20.6642 12.75 20.25V17.9654C14.0989 17.8386 15.3247 17.3603 16.2617 16.4858C17.3784 15.4436 18 13.9175 18 12C18 11.5858 17.6642 11.25 17.25 11.25C16.8358 11.25 16.5 11.5858 16.5 12C16.5 13.5825 15.9966 14.6814 15.2383 15.3892C14.4713 16.105 13.3583 16.5 12 16.5C10.919 16.5 9.9933 16.2498 9.27382 15.7868L10.476 14.5846C10.9227 14.8486 11.4436 15 12 15C13.6569 15 15 13.6569 15 12V10.0607Z"
        fill="#f63135"
      />
      <path
        d="M7.6111 13.2082C7.53881 12.8415 7.5 12.4394 7.5 12C7.5 11.5858 7.16421 11.25 6.75 11.25C6.33579 11.25 6 11.5858 6 12C6 12.8969 6.13599 13.7082 6.39503 14.4243L7.6111 13.2082Z"
        fill="#f63135"
      />
    </svg>
  );
}

export function Wrench() {
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M459.957,203.4c42.547-38.609,49.656-82.484,40.141-119.469c-0.281-2.938-0.984-5.406-3.547-7.266 l-8.563-7.016c-1.484-1.375-3.484-2.063-5.484-1.859c-2.016,0.188-3.844,1.234-5.031,2.859l-49.25,64.031 c-1.375,1.891-3.594,2.969-5.922,2.891l-17.875,1.313c-1.531-0.047-3.016-0.594-4.219-1.563l-34.531-29.266 c-1.406-1.141-2.328-2.766-2.563-4.563l-2.141-16.188c-0.25-1.781,0.203-3.594,1.266-5.047l46.109-62.641 c2.094-2.891,1.688-6.875-0.906-9.297l-11.188-8.734c-2.188-2.047-4.672-1.75-8.063-1.109 c-31.844,6.297-86.219,37.125-100.016,79.75c-12.156,37.516-7.922,63.969-7.922,63.969c0,21.141-6.953,41.516-15.5,50.078 L24.504,424.916c-0.469,0.438-0.922,0.859-1.375,1.313c-19.844,19.844-19.813,52.063-0.641,71.219 c19.172,19.172,51.859,19.688,71.703-0.172c0.922-0.922,1.813-1.875,2.641-2.859l231.672-250.438 C357.004,218.619,413.426,245.65,459.957,203.4z"
        fill="currentColor"
      />
    </svg>
  );
}

export function MissingParticipant() {
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox="0 0 32 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8" cy="8" r="4" fill="currentColor" />
      <path
        d="M2.5 19.5C2.5 16.1863 5.18629 13.5 8.5 13.5C11.8137 13.5 14.5 16.1863 14.5 19.5V20.75C14.5 21.1642 14.1642 21.5 13.75 21.5H3.25C2.83579 21.5 2.5 21.1642 2.5 20.75V19.5Z"
        fill="currentColor"
      />
      <circle
        cx="24"
        cy="8"
        r="4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <path
        d="M18.5 20C18.5 16.9624 20.9624 14.5 24 14.5C27.0376 14.5 29.5 16.9624 29.5 20V20.75C29.5 21.1642 29.1642 21.5 28.75 21.5H19.25C18.8358 21.5 18.5 21.1642 18.5 20.75V20Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        fill="none"
      />
    </svg>
  );
}

export function Leave() {
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 4.5H14C15.3807 4.5 16.5 5.61929 16.5 7V10H15V7C15 6.44772 14.5523 6 14 6H7C6.44772 6 6 6.44772 6 7V17C6 17.5523 6.44772 18 7 18H14C14.5523 18 15 17.5523 15 17V14H16.5V17C16.5 18.3807 15.3807 19.5 14 19.5H7C5.61929 19.5 4.5 18.3807 4.5 17V7C4.5 5.61929 5.61929 4.5 7 4.5Z"
        fill="#f63135"
      />
      <path
        d="M19.0303 8.46967C18.7374 8.17678 18.2626 8.17678 17.9697 8.46967C17.6768 8.76256 17.6768 9.23744 17.9697 9.53033L19.6893 11.25H12.75C12.3358 11.25 12 11.5858 12 12C12 12.4142 12.3358 12.75 12.75 12.75H19.6893L17.9697 14.4697C17.6768 14.7626 17.6768 15.2374 17.9697 15.5303C18.2626 15.8232 18.7374 15.8232 19.0303 15.5303L22.0303 12.5303C22.3232 12.2374 22.3232 11.7626 22.0303 11.4697L19.0303 8.46967Z"
        fill="#f63135"
      />
    </svg>
  );
}

export function ParticipantLeft() {
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox="0 0 36 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 16H22"
        stroke="#f63135"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M18 12L24 16L18 20"
        stroke="#f63135"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M26 8H32"
        stroke="#94a3b8"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M32 8V24"
        stroke="#94a3b8"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M32 24H26"
        stroke="#94a3b8"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
