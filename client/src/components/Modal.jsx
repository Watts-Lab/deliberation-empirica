import React from "react";

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function Modal({
  isOpen,
  onClose,
  maxWidth = "md",
  showCloseButton = true,
  children,
}) {
  if (!isOpen) return null;

  const widthClass = maxWidthClasses[maxWidth] || maxWidthClasses.md;

  const handleBackdropClick = onClose
    ? (e) => {
        if (e.target === e.currentTarget) onClose();
      }
    : undefined;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
    >
      <div
        className={`relative mx-4 w-full ${widthClass} rounded-lg bg-white p-6 shadow-xl`}
      >
        {showCloseButton && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
