/* eslint-disable jsx-a11y/no-autofocus -- Might need autofocus since button floats on top? */
/* eslint-disable react/button-has-type -- We defined a default type in props, so it's fine */
import React, { useId } from "react";

const base =
  "inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-empirica-500";
const prim =
  "border-transparent shadow-sm text-white bg-empirica-600 hover:bg-empirica-700";
const sec =
  "border-gray-300 shadow-sm text-gray-700 bg-white hover:bg-gray-50";

const dsbl = "opacity-50 cursor-not-allowed";

export function Button({
  children,
  handleClick = null, // TODO: rename to onClick
  className = "",
  style = {},
  primary = true,
  type = "button",
  autoFocus = false,
  disabled = false,
  id = "",
  testId = "unnamedButton",
}) {
  // Use React's useId hook for stable, unique IDs across renders
  const generatedId = useId();
  const buttonId = id || `button${generatedId}`;

  return (
    <button
      type={type}
      onClick={handleClick}
      className={`${base} ${primary ? prim : sec} ${
        disabled ? dsbl : ""
      } ${className}`}
      autoFocus={autoFocus}
      style={style}
      id={buttonId}
      data-test={testId}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
