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

- `ConditionalRender.jsx` — Platform-only conditional wrappers:
  - `DevConditionalRender` (hide content behind a test-controls toggle)
  - `BrowserConditionalRender` (block mobile devices / outdated browsers)

  Stage-level conditional rendering (time, position, condition array,
  and submission) is handled by stagebook's own wrappers — see the
  `StagebookProviderAdapter` wiring in `StagebookProviderAdapter.jsx`.

## Collaboration and discussion helpers

- `SharedNotepad.jsx` — Shared Etherpad-backed text area for collaborative prompts.
- `ReportMissing.jsx` — UI for reporting/checking in missing participants (handles check-in actions).
- `ConfirmLeave.jsx` — Dialog to confirm leaving a discussion/call.

## System/behavior utilities

- `IdleProvider.jsx` — Context to manage idle detection (allow/block idle while certain components are active).
- `hooks.js` — Shared hooks:
  - `useFileURL`, `useText`, `usePermalink` (load assets via CDN + lookup).
  - `useConnectionInfo` (IP geolocation/VPN heuristics).
  - `useGetBrowser`, `useGetOS`, `useDebounce`.
- `stagebookAdapterHelpers.js` — Pure helpers (tested) backing
  `StagebookProviderAdapter`: scope-based get/save against Empirica
  state, CDN URL resolution relative to the treatment file.
- `EmpiricaMenu.jsx` — Tools for aiding experiment development (create dummy players, etc.)

## How they’re used

- Prompt rendering, element conditional visibility, and condition
  evaluation all live inside stagebook — this project wires platform
  state to stagebook via `StagebookProviderAdapter`.
- Discussion/call flows use `ReportMissing`, `ConfirmLeave`,
  `EmpiricaMenu`, and `IdleProvider` for platform-specific behavior.
- `DevConditionalRender` and `BrowserConditionalRender` guard
  development-only UI and browser-compatibility screens.

Use these components to keep UI consistent and to leverage existing wiring for timing, browser compatibility, and shared state. Most components are React-only; behaviors that touch Empirica/Daily state are noted above.
