# Modern Chat Interface

This folder contains a modernized chat interface with emoji reaction support for the Deliberation Empirica platform.

## Components

### Chat.jsx
Main chat component that handles:
- State reconstruction from action logs
- Message and reaction management
- Action logging (send_message, add_reaction_emoji, remove_reaction_emoji)
- Auto-scrolling to show latest messages

### MessageBubble.jsx
Renders individual messages with:
- Modern bubble UI (right-aligned blue for self, left-aligned gray for others)
- Hover-triggered emoji reaction button
- Display of message timestamp (relative time)
- Optional nickname and title display
- Reaction list below each message

### TextBar.jsx
Message input component with:
- Auto-resizing textarea
- Emoji picker button (when reactions are enabled)
- Send button
- Keyboard shortcuts (Enter to send, Shift+Enter for newline)

### EmojiPicker.jsx
Popup emoji selector that:
- Displays available emojis
- Can be positioned above or below trigger
- Supports keyboard navigation (Escape to close)

### ReactionList.jsx
Displays reactions under messages with:
- Grouped reactions by emoji with counts
- Hover to see who reacted
- Click to remove your own reaction
- Visual indicator for your reactions (blue border)

### Icons.jsx
Custom SVG icons for:
- Emoji picker button (smiley face)
- Send button (paper plane)

### chatUtils.js
Utility functions for:
- Relative time formatting (e.g., "5m ago", "now")
- Chat state reconstruction from action logs
- Action ID generation

## Data Model

The chat system uses an action-based logging approach where every interaction is stored as an action object:

### Message Action
```javascript
{
  id: 24,
  type: "send_message",
  content: "Hello world!",
  targetId: undefined,
  playerPosition: 0,
  sender: {
    id: "player_abc",
    name: "Alice",
    title: "Team Lead",
    avatar: "https://..."
  },
  stage: "round_3",
  time: 70 // elapsed seconds
}
```

### Add Reaction Action
```javascript
{
  id: 28,
  type: "add_reaction_emoji",
  content: "❤️",
  targetId: 24, // ID of message to react to
  playerPosition: 1,
  stage: "round_3",
  time: 87
}
```

### Remove Reaction Action
```javascript
{
  id: 31,
  type: "remove_reaction_emoji",
  content: undefined,
  targetId: 28, // ID of reaction to remove
  playerPosition: 1,
  stage: "round_3",
  time: 98
}
```

## Configuration

The chat interface accepts the following parameters (set in treatment files):

### reactionEmojisAvailable
- **Type:** Array of strings (emoji characters)
- **Default:** `[]` (reactions disabled)
- **Description:** List of emojis available for reactions. Empty array or falsy value disables reactions entirely.
- **Example:** `["❤️", "👍", "😊", "🎉"]`

### reactToSelf
- **Type:** Boolean
- **Default:** `true`
- **Description:** Whether players can react to their own messages.

### numReactionsPerMessage
- **Type:** Non-negative integer
- **Default:** `1`
- **Description:** Maximum number of different emojis each player can add to a single message.
- **Notes:** 
  - A user cannot add the same emoji multiple times to one message
  - Users can use multiple different emojis up to this limit

### showNickname
- **Type:** Boolean
- **Default:** `true`
- **Description:** Display player nicknames above messages (except for self messages).

### showTitle
- **Type:** Boolean
- **Default:** `false`
- **Description:** Display player titles above messages (except for self messages).

## Treatment File Example

```yaml
treatments:
  - name: example_treatment
    playerCount: 3
    gameStages:
      - name: Discussion Stage
        duration: 600
        discussion:
          chatType: text
          showNickname: true
          showTitle: true
          reactionEmojisAvailable: ["❤️", "👍", "😊", "🎉", "🤔"]
          reactToSelf: true
          numReactionsPerMessage: 2
        elements:
          - type: prompt
            file: projects/example/discussion_prompt.md
          - type: submitButton
```

## Features

### Layout
- ✅ Right-aligned blue bubbles for own messages
- ✅ Left-aligned gray bubbles for others' messages
- ✅ Responsive design that adapts to window width
- ✅ Messages take up max 75% of parent width
- ✅ Smooth auto-scroll to show latest messages
- ✅ Relative timestamps (e.g., "now", "5m ago")

### Reactions
- ✅ Hover over message to show emoji reaction button
- ✅ Click button to open emoji picker
- ✅ Click emoji to add reaction
- ✅ Multiple users can use same emoji (shows count)
- ✅ Multiple different emojis can be added
- ✅ Hover over reaction to see who reacted
- ✅ Click own reaction to remove it
- ✅ Configurable limits on reactions per message
- ✅ Option to allow/disallow reacting to own messages

### Message Composition
- ✅ Emoji picker button in message input
- ✅ Click emoji to insert into message
- ✅ Inserts at cursor position
- ✅ Auto-resizing text area

## Data Export

The new chat system exports data under two keys:
- `textChats`: Legacy format (kept for backward compatibility with old stages)
- `chatActions`: New action-based format with full interaction history

Both formats are exported simultaneously to support mixed old/new chat stages in the same experiment.

## Migration from Old TextChat

The old `TextChat` component is still available at `client/src/components/TextChat.jsx` for backward compatibility. New experiments should use the `Chat` component from `client/src/chat/Chat.jsx`.

Key differences:
- **Old:** Saves messages directly to `textChat` attribute
- **New:** Saves actions to `chat` attribute and reconstructs state
- **Old:** No emoji reactions
- **New:** Full emoji reaction support
- **Old:** Simple left-aligned layout
- **New:** Modern bubble layout with self/other distinction

## Styling

Uses Tailwind CSS with Empirica color palette:
- `empirica-500` (#237fe1) for focus states
- `blue-500` for self messages
- `gray-200` for other messages
- Custom animations defined in `client/windi.config.cjs`
