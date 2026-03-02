import React from "react";

const variantClasses = {
  warning: "bg-yellow-600",
  error: "bg-red-600",
  info: "bg-blue-600",
};

export function CallBanner({ visible, variant = "warning", children }) {
  if (!visible) return null;

  const classes = variantClasses[variant] || variantClasses.warning;

  return (
    <div
      className={`absolute top-0 left-0 right-0 z-10 ${classes} px-4 py-2 text-center text-sm font-medium text-white`}
    >
      {children}
    </div>
  );
}
