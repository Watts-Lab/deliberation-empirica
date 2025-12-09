# Shared UI Components

This folder contains reusable UI components and helpers shared across the client. They’re used by intro/exit steps, game elements, and discussion layouts.

## Core inputs and UI elements

- `Button.jsx` — Standard button styles.
- `CheckboxGroup.jsx` / `RadioGroup.jsx` / `Select.jsx` — Form inputs for multi/single choice and selects.
- `TextArea.jsx` — Multiline text input with character count support.
- `Slider.jsx` — Numeric slider with labels/ticks; used by prompt elements.
- `ListSorter.jsx` — Drag-and-drop list reordering control.
- `Image.jsx` — Media rendering wrapper with consistent styling.
- `Alert.jsx` — Inline alert/banner component with basic severity styling.
- `Markdown.jsx` — Renders Markdown content (used in prompts and static displays).
- `Timer.jsx` — Countdown/elapsed timer display.

## Layout and conditional rendering

- `ConditionalRender.jsx` — Conditional wrappers:
  - `TimeConditionalRender` (display/hide by stage elapsed time)
  - `PositionConditionalRender` (show/hide by participant position)
  - `ConditionsConditionalRender` (show/hide based on condition array evaluation)

## Collaboration and discussion helpers

- `SharedNotepad.jsx` — Shared Etherpad-backed text area for collaborative prompts.
- `ReportMissing.jsx` — UI for reporting/checking in missing participants (handles check-in actions).
- `ConfirmLeave.jsx` — Dialog to confirm leaving a discussion/call.

## System/behavior utilities

- `IdleProvider.jsx` — Context to manage idle detection (allow/block idle while certain components are active).
- `referenceResolver.js` — Resolves reference strings (`survey.*`, `prompt.*`, `urlParams.*`, etc.) into values for conditions and displays.
- `hooks.js` — Shared hooks:
  - `useFileURL`, `useText`, `usePermalink` (load assets via CDN + lookup).
  - `useConnectionInfo` (IP geolocation/VPN heuristics).
  - `usePlayers`/`usePlayer` convenience wrappers and other utilities.
- `EmpiricaMenu.jsx` — Tools for aiding experiment development (create dummy players, etc.)

## How they’re used

- Prompt elements (in `elements/`) compose `Markdown`, `CheckboxGroup`, `RadioGroup`, `TextArea`, `Slider`, `ListSorter`, and `SharedNotepad`.
- Display/visibility logic uses `ConditionalRender` wrappers for time/position/condition-based gating.
- Discussion/call flows use `ReportMissing`,
- `ConfirmLeave`, `EmpiricaMenu`, and `IdleProvider` cover specific off-normal behavior cases.
- Reference-dependent displays rely on `referenceResolver` to fetch values safely.

Use these components to keep UI consistent and to leverage existing wiring for conditions, timing, and shared state. Most components are React-only; behaviors that touch Empirica/Daily state are noted above.
