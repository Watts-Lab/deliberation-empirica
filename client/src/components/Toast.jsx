import React from "react";

const variantClasses = {
  info: "bg-blue-100 text-blue-800",
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  error: "bg-red-100 text-red-800",
};

export function Toast({ visible, variant = "info", children }) {
  if (!visible) return null;

  const classes = variantClasses[variant] || variantClasses.info;

  const isAssertive = variant === "error" || variant === "warning";

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-lg ${classes} px-4 py-3 shadow-lg`}
      role={isAssertive ? "alert" : "status"}
      aria-live={isAssertive ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {children}
    </div>
  );
}
