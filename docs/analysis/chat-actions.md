# Analyzing Chat Action Logs

The text chat records **every interaction as an action**, allowing you to
reconstruct the conversation at any moment in time, or run higher-level analyses (reaction
patterns, response times, participation balance, etc.). We currently emit three
action types:

- `send_message` – users submit chat text.
- `add_reaction_emoji` – they attach an emoji to a message.
- `remove_reaction_emoji` – they remove a previously-added reaction.

## Where the data lives

In the science data export you’ll find a `chatActions` array for each stage that
uses `discussion.chatType: text`:

```json
{
  "chatActions": [
    {
      "id": 1,
      "type": "send_message",
      "content": "Hello everyone!",
      "targetId": null,
      "playerPosition": 0,
      "sender": {
        "id": "player_abc",
        "name": "Player 0",
        "title": null
      },
      "stage": "discussion_round_1",
      "time": 15
    },
    {
      "id": 2,
      "type": "add_reaction_emoji",
      "content": "👍",
      "targetId": 1,
      "playerPosition": 1,
      "stage": "discussion_round_1",
      "time": 23
    },
    {
      "id": 3,
      "type": "remove_reaction_emoji",
      "content": null,
      "targetId": 2,
      "playerPosition": 1,
      "stage": "discussion_round_1",
      "time": 45
    }
  ]
}
```

Each entry captures:

- `id`: monotonically increasing action id (per stage) generated client-side.
- `type`: `send_message`, `add_reaction_emoji`, or `remove_reaction_emoji`.
- `content`: text of the message or emoji character.
- `targetId`: for reactions, the `id` of the message or reaction they reference.
- `playerPosition`: numeric seating position of the actor .
- `sender`: snapshot of the player metadata (id, nickname, title) at the
  moment the action was logged.
- `stage`: the Empirica stage id (helpful for multi-stage chats).
- `time`: elapsed seconds within the stage when the action occurred.

## Reconstructing the conversation

Because every message and reaction is an action, you can replay the log in order
and rebuild the exact UI state at any timestamp:

1. Filter by stage if needed (e.g., `stage === "discussion_round_1"`).
2. Sort by `time` (already chronological, but sorting protects against any
   out-of-order log writes).
3. Maintain an in-memory map of messages keyed by `id`.
4. When you encounter `send_message`, append a new entry to the transcript.
5. `add_reaction_emoji` mutates the referenced message’s reaction list; the
   `targetId` points to the message id.
6. `remove_reaction_emoji` references the action id of the original reaction,
   allowing you to adjust counts or drop the reaction entirely.

By replaying through a specific `time` cutoff you can obtain the exact conversation
state at that moment (useful for interim sentiment/participation metrics or to
synchronize with other telemetry).

## Common analyses

- **Participation balance**: group actions by `playerPosition` and count `send_message`
  events.
- **Response latency**: subtract the `time` between consecutive `send_message`
  actions to estimate reaction speed.
- **Reaction usage**: count `add_reaction_emoji` per message, per emoji, or per player.
- **Engagement over time**: bucket actions into time windows (e.g., 1-minute bins)
  to see activity spikes.
- **Thread reconstruction**: combine `send_message` (content) with the reactions
  to see which messages drew attention.

## Configuration references

The following treatment options influence what appears in the logs:

- `reactionEmojisAvailable`: controls whether reaction actions exist at all.
- `reactToSelf`: toggles whether a participant can react to their own messages.
- `numReactionsPerMessage`: limits how many distinct emojis a player can attach
  to a single message.
- `showNickname` / `showTitle`: these values influence the UI, but the raw log
  always stores the player metadata so analysts can identify actors without
  requiring those fields to be visible to participants.

See `client/src/chat/README.md` for implementation details and the latest UI
behaviour. This analysis page focuses on the exported data format and how to use
it downstream.
