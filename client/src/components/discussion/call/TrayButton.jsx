/**
 * TrayButton — toolbar control button for the in-call Tray.
 *
 * Intentionally NOT stagebook's `<Button>`: stagebook buttons are sized and
 * styled for page-content CTAs (Continue, Submit, Proceed), with inline
 * `padding: 0.5rem 1rem` and a content-driven natural height. Forcing one
 * into a fixed-height toolbar via `className="h-[3rem]"` fights the inline
 * padding + icon+label flex layout and lets the button grow taller than the
 * bar, which collapses the sibling tile grid to zero height.
 *
 * This component is purpose-built for the call tray's `h-16` bar:
 *   - fixed height (h-12), so the button never grows past the bar
 *   - compact padding scaled to an icon + short label
 *   - neutral "chrome" colors; `primary` variant available for single-use
 *     accents (Report Missing) without dragging in stagebook's inline styles
 *
 * Keep this local to the call module. If another toolbar-style surface
 * needs the same thing later, promote it to components/ first.
 */

import React from "react";

export function TrayButton({
  children,
  icon,
  onClick,
  primary = false,
  disabled = false,
  className = "",
  "data-testid": dataTestId,
}) {
  const base =
    "flex h-12 items-center gap-2 px-3 rounded-md border text-sm font-medium " +
    "transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const variant = primary
    ? "bg-empirica-500 text-white border-transparent hover:bg-empirica-600"
    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={dataTestId}
      className={`${base} ${variant} ${className}`.trim()}
    >
      {icon && (
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
          {icon}
        </span>
      )}
      <span className="whitespace-nowrap">{children}</span>
    </button>
  );
}
