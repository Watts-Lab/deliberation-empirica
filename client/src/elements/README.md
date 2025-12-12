# Stage Elements

This folder contains the React components used as stage “elements” in treatments. Each corresponds to an element `type` in the treatment schema and is composed/rendered by `Element.jsx`.

## Composition entry point

- `Element.jsx` — top-level container that picks the correct component based on `element.type`, passes shared props (e.g., `onSubmit`), and handles timing/visibility via parent `ConditionalRender`.

## Element components (mapped from `type`)

- `Prompt.jsx` (`type: "prompt"`) — Renders Markdown prompt content and captures responses (multiple choice, open response, list sorter, slider). Handles shared vs. per-player prompts, debounced saves, and stage-relative timing.
- `Survey.jsx` (`type: "survey"`) — Wraps `@watts-lab/surveys` instruments; stores results under `survey_<name>`.
- `Qualtrics.jsx` (`type: "qualtrics"`) — Embeds a Qualtrics survey iframe, appends `deliberationId`/`sampleId`, and flags submission to advance the stage.
- `Discussion.jsx` (stage-level) — Renders the discussion UI (video via `call/VideoCall` or text chat) based on `discussion` config.
- `AudioElement.jsx` (`type: "audio"`) — Plays audio assets.
- `TrainingVideo.jsx` / `VideoElement` (`type: "video"`) — Plays video assets with training affordances.
- `Display.jsx` (`type: "display"`) — Shows a referenced value (prompt/survey/etc.) possibly for a specific position.
- `SubmitButton.jsx` (`type: "submitButton"`) — Submit control; logs click time and advances stage.
- `Separator.jsx` (`type: "separator"`) — Visual divider (thin/thick).
- `TalkMeter.jsx` (`type: "talkMeter"`) — Shows speaking time/proportion for the current participant.
- `KitchenTimer.jsx` (`type: "timer"`) — Stage timer display with warnings/alerts.
- `TrackedLink.jsx` (`type: "trackedLink"`) — Link component that can log clicks.

## How stages use elements

- `Stage.jsx` and `GenericIntroExitStep.jsx` compose `Element` instances inside conditional render wrappers (time/position/conditions).
- Element components read/write Empirica player/stage/game attributes according to the treatment schema (e.g., `prompt_*`, `survey_*`, `submitButton_*`).
- Timing-sensitive elements use stage timers or local timestamps to record elapsed time.

Use these components when adding new element types or adjusting behavior for existing `type` values in treatment manifests. If introducing a new `type`, extend `Element.jsx` to route to the new component and update validation/schema accordingly.
