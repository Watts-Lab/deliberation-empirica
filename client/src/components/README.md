# Shared UI Components

Platform-specific React components, providers, and adapters. Form primitives (Button, Markdown, RadioGroup, CheckboxGroup, TextArea, Slider, ListSorter, Loading, Separator) and rendering of DSL elements are supplied by the [stagebook](https://www.npmjs.com/package/stagebook) package — this folder holds the things stagebook doesn't ship: platform-specific UI (modals, toasts, alerts), dev/admin tooling, the stagebook ↔ Empirica adapter, and shared hooks.

## Stagebook integration

- `stagebookAdapter/Provider.jsx` — Translates Empirica's hook-based state into the `StagebookContext` expected by stagebook (`get(key, scope)`, `save(key, value, scope)`, `getAssetURL`, `getTextContent`, render slots). Every stagebook-rendered element in the app reads through this.
- `stagebookAdapter/helpers.js` — Pure helpers backing the Provider (scope translation, treatment-relative asset URL resolution, `participantInfo` synthesis, `contentVersion` gating). Colocated tests in `stagebookAdapter/helpers.test.js`.
- `progressLabel/` — Provides `StageProgressLabelProvider` / `IntroExitProgressLabelProvider` + hooks (`useProgressLabel`, `useGetElapsedTime`). Derives the `progressLabel` string and elapsed time that stagebook stamps onto every saved value.
- `Markdown.jsx` — Thin wrapper around stagebook's `<Markdown>` that injects a CDN-aware `resolveURL` using Empirica globals.
- `SharedNotepad.jsx` — Etherpad-backed notepad; wired into stagebook's `renderSharedNotepad` slot by the adapter.
- `Survey.jsx` — Wraps `@watts-lab/surveys` instruments; stores results under `survey_<name>`. Wired into stagebook's `renderSurvey` slot.
- `discussion/` — Video + text-chat UI rendered through stagebook's `renderDiscussion` slot. See [discussion/README.md](./discussion/README.md).

## Platform UI primitives

- `Alert.jsx` — Inline status/error banner (used by browser-compat block, UserMediaError).
- `Modal.jsx` — Dialog wrapper (used by ReportMissing).
- `Toast.jsx` — Lightweight toast (used by ReportMissing).
- `Select.jsx` — Styled `<select>` for device pickers. (May move to stagebook upstream — see [stagebook#181](https://github.com/deliberation-lab/stagebook/issues/181).)

## Conditional rendering (platform-only)

- `ConditionalRender.jsx`:
  - `DevConditionalRender` — hide content behind a test-controls toggle.
  - `BrowserConditionalRender` — block mobile devices / outdated browsers.

  All stage-level conditional rendering (time, position, condition array, submission) is handled by stagebook's own wrappers.

## Platform state / context

- `IdleProvider.jsx` — Idle detection + chime. Components use `useIdleContext()` to opt out during screens where inactivity is expected (lobby, video discussion, reading debrief).
- `ConfirmLeave.jsx` — `beforeunload` dialog to discourage navigating away from a live stage.
- `PermissionRecovery.jsx` — Recovery UI for Daily.co microphone/camera permission changes.
- `EmpiricaMenu.jsx` — Dev/test controls: create dummy players, jump stages, advance timers. Gated on `TEST_CONTROLS=enabled`.
- `ProfileTimer.jsx` — Header clock (shown in `Profile.jsx`) that reads `useStageTimer` and renders HH:MM:SS remaining. Distinct from stagebook's `KitchenTimer` element.

## Shared hooks

- `hooks.js` — `useFileURL`, `useText` (load assets via the CDN + Empirica globals); `useConnectionInfo` (IP geolocation / VPN heuristic used during consent).
- `userAgentHooks.js` — `useGetBrowser`, `useGetOS` (client-side browser/OS detection via the User-Agent Client Hints API with UA-string fallback).

Use these components to keep UI consistent and to leverage existing wiring for idle detection, browser compatibility, and shared state. When adding a new component here, favor stagebook for anything that's platform-agnostic; this folder is for things that need Empirica hooks, Daily.co, Etherpad, or @watts-lab/surveys.
