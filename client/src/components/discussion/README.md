# Discussion Module

Renders the in-stage deliberation UI (video call, text chat, or both) when a
treatment stage declares a `discussion` config. Wired into stagebook via
`renderDiscussion` in `../stagebookAdapter/Provider.jsx`.

## Entry point

- `Discussion.jsx` — Reads the stage-level `discussion` config and dispatches
  to `VideoCall` (for `chatType: "video"`), `Chat` (for `chatType: "text"`),
  or both. Manages the overall layout and idle-provider exemptions for the
  discussion pane.

## Submodules

- `call/` — Daily.co-backed video call: tile grid, tray controls, device
  alignment, permission recovery, A/V diagnostics. See
  [call/README.md](./call/README.md).
- `chat/` — Text-chat action log: message composer, message bubbles, reactions,
  emoji picker. See [chat/README.md](./chat/README.md).

## Why this lives under `components/`

These components integrate with external services (Daily.co, Etherpad, etc.)
and Empirica hooks, so they cannot live in the platform-agnostic stagebook
package. They are rendered through stagebook's render slots so stagebook stays
decoupled from the specific realtime infrastructure this platform uses.
