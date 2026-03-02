import React from "react";

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function Modal({ isOpen, onClose, maxWidth = "md", children }) {
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
        className={`mx-4 w-full ${widthClass} rounded-lg bg-white p-6 shadow-xl`}
      >
        {children}
      </div>
    </div>
  );
}
