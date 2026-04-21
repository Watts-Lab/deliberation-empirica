# Stage Elements

Stagebook renders most element types (`prompt`, `submitButton`, `display`,
`timer`, `audio`, `image`, `mediaPlayer`, `separator`, `trackedLink`, …)
through its own `<Stage>` / `<Element>` components. This folder holds the
few elements that stagebook delegates back to the platform via render
slots — things that integrate with external services or
platform-specific infrastructure.

## Components in this folder

- `Discussion.jsx` — Renders the discussion UI (video via
  `call/VideoCall` or text chat via `chat/Chat`) based on the
  stage-level `discussion` config. Wired into stagebook's
  `renderDiscussion` slot.
- `Survey.jsx` — Wraps `@watts-lab/surveys` instruments; stores results
  under `survey_<name>`. Wired into stagebook's `renderSurvey` slot.

## Related (elsewhere)

- `components/SharedNotepad.jsx` — Etherpad-backed notepad, wired into
  stagebook's `renderSharedNotepad` slot.

## Render-slot wiring

Connection between these components and stagebook happens in
`components/StagebookProviderAdapter.jsx`:

```jsx
renderDiscussion:    (config) => <Discussion discussion={config} />
renderSharedNotepad: ({padName, defaultText, rows}) => <SharedNotepad ...>
renderSurvey:        ({surveyName, onComplete}) => <Survey ...>
```

Stagebook handles the element-type dispatch (reading `type` from the
treatment YAML and choosing which slot to invoke). Adding new
platform-specific element types means (a) extending stagebook's schema
upstream and (b) adding a render slot here. Platform-agnostic elements
should live in stagebook.
