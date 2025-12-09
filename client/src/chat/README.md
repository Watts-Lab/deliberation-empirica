# Text Chat Module

This folder implements the text chat UI and action logging for stages with `discussion.chatType: "text"`. It reconstructs chat state from action logs, renders messages/reactions, and writes new actions to the stage.

## Main components

- `Chat.jsx` — Entry point rendered inside a stage’s `Discussion` pane.
  - Reconstructs messages from stage-scoped action logs (`chat` attribute).
  - Appends actions for `send_message`, `add_reaction_emoji`, `remove_reaction_emoji`.
  - Auto-scrolls to latest messages; exits early if no stage timer (chat disabled).
  - Respects per-stage `reactionEmojisAvailable`, `reactToSelf`, and `numReactionsPerMessage`.
- `TextBar.jsx` — Message composer with optional emoji picker, send button, and keyboard shortcuts (Enter to send, Shift+Enter for newline).
- `MessageBubble.jsx` — Renders a message with sender info, timestamp, and reactions; exposes reaction controls when enabled.
- `ReactionList.jsx` — Groups and displays reactions for a message; supports removing your own reaction.
- `EmojiPicker.jsx` — Popup picker for choosing a reaction emoji from the allowed set.
- `Icons.jsx` — Shared SVG icons (emoji, send, chat glyphs).
- `chatUtils.js` — Utility functions:
  - `reconstructChatState(actions)` builds the message list from action history.
  - `getNextActionId(actions)` generates monotonic action IDs.
  - Helpers for relative time formatting and reaction removal.

## How it works

1. `Chat` reads the stage attribute named `chat` (or the provided `attribute` prop). Actions live in `scope.getAttribute(attribute).items`.
2. On render, `reconstructChatState` produces an ordered list of messages with inline reactions.
3. Sending a message appends a `send_message` action with `content`, `playerPosition`, `sender` (id/name/title), `stage` (progress label), and `time` (stage elapsed seconds).
4. Adding/removing a reaction appends `add_reaction_emoji` or `remove_reaction_emoji` actions targeting message or reaction IDs. Limits are enforced client-side:
   - Reactions only when `reactionEmojisAvailable` has entries.
   - `numReactionsPerMessage` caps unique emojis per user per message.
   - `reactToSelf` controls whether you can react to your own messages.
5. Empty-state UI appears when no messages are present.

## Configuration (from treatment `discussion`)

- `chatType` must be `"text"`; otherwise this UI is not rendered.
- `reactionEmojisAvailable` (array of emoji strings) enables reactions; empty/omitted disables.
- `reactToSelf` (bool, default true) controls reactions on own messages.
- `numReactionsPerMessage` (int >= 0, default 1) limits unique reactions per user per message.
- `showNickname` / `showTitle` (bools) toggle sender display above others’ messages.

## Data model

Actions are simple JSON objects stored on the stage:
- `send_message`: `{ id, type: "send_message", content, targetId: null, playerPosition, sender { id, name, title, avatar? }, stage, time }`
- `add_reaction_emoji`: `{ id, type: "add_reaction_emoji", content: "<emoji>", targetId: <messageId>, playerPosition, stage, time }`
- `remove_reaction_emoji`: `{ id, type: "remove_reaction_emoji", content: null, targetId: <reactionId>, playerPosition, stage, time }`

These actions are exported verbatim in science data under `chatActions` for each stage.

## Usage

Use `Chat` inside the stage discussion when `chatType: "text"`. Pass `scope` (stage), `attribute` name if different from `"chat"`, and presentation flags (`showNickname`, `showTitle`, reaction config). The rest of the components are internal wiring to render and manage chat state.
