# Modern Chat Interface

This folder contains a modernized chat interface with emoji reaction support for the Deliberation Empirica platform.

## Overview

The modern chat interface provides a contemporary messaging experience similar to WhatsApp and iMessage, with:
- Modern bubble-style UI with self/other message distinction
- Emoji reaction support with full configurability
- Comprehensive interaction logging for research analysis
- Smooth scrolling and responsive design

## Components

### Chat.jsx
Main chat component that handles:
- State reconstruction from action logs
- Message and reaction management
- Action logging (send_message, add_reaction_emoji, remove_reaction_emoji)
- Auto-scrolling with smooth animation to show latest messages
- Message positioning from bottom of window (messages emerge upward)

### MessageBubble.jsx
Renders individual messages with:
- Modern bubble UI with speech bubble tails
  - Right-aligned blue bubbles for own messages
  - Left-aligned gray bubbles for others' messages
- Always-visible emoji reaction button (light gray, darkens on hover)
- Display of relative timestamps (e.g., "now", "5m ago")
- Optional nickname and title display above messages
- Reaction list positioned below messages
- Click-outside-to-close behavior for emoji picker
- Maximum 75% width with text wrapping

### TextBar.jsx
Message input component with:
- Auto-resizing textarea (up to 200px height)
- Emoji picker button positioned at right edge (when enabled)
- Send button with paper plane icon
- Keyboard shortcuts (Enter to send, Shift+Enter for newline)
- Emoji insertion at cursor position

### EmojiPicker.jsx
Popup emoji selector that:
- Displays available emojis in a grid
- Positions intelligently to stay within window bounds
- Supports keyboard navigation (Escape to close)
- Closes when clicking outside the picker

### ReactionList.jsx
Displays reactions under messages with:
- Grouped reactions by emoji with counts
- Hover tooltip showing who reacted (using nicknames)
- Click to remove your own reaction
- Visual indicator for your reactions (blue border)
- Proper alignment (right for self messages, left for others)

### Icons.jsx
Custom SVG icons for:
- Emoji picker button (smiley face)
- Send button (paper plane)
- Chat icon (used in empty state)

### chatUtils.js
Utility functions for:
- Relative time formatting (e.g., "now", "5m ago", "3h")
- Chat state reconstruction from action logs
- Action ID generation
- Reaction removal logic

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

The chat interface accepts the following parameters (set in treatment files under the `discussion` object):

### chatType
- **Type:** String
- **Required:** Yes
- **Value:** `"text"`
- **Description:** Specifies the type of chat interface to use. Must be "text" for the modern chat interface.

### reactionEmojisAvailable
- **Type:** Array of strings (emoji characters)
- **Default:** `[]` (reactions disabled)
- **Description:** List of emojis available for reactions. Empty array, null, undefined, or false disables reactions entirely (hides reaction buttons).
- **Example:** `["❤️", "👍", "😊", "🎉", "🤔"]`
- **Notes:**
  - Only applies to `chatType: "text"`
  - Validation error if specified for other chat types
  - When disabled, emoji picker buttons are completely hidden
  - Emoji picker in message input is only shown when reactions are enabled

### reactToSelf
- **Type:** Boolean
- **Default:** `true`
- **Description:** Whether players can react to their own messages.
- **Notes:**
  - Only applies when `reactionEmojisAvailable` is enabled
  - When false, emoji reaction button is hidden on own messages
  - Only applies to `chatType: "text"`

### numReactionsPerMessage
- **Type:** Non-negative integer
- **Default:** `1`
- **Description:** Maximum number of different emojis each player can add to a single message.
- **Notes:** 
  - A user cannot add the same emoji multiple times to one message
  - Users can add multiple different emojis up to this limit
  - Applies to message reactions only (not to emoji used in message text)
  - Only applies to `chatType: "text"`

### showNickname
- **Type:** Boolean
- **Default:** `true`
- **Description:** Display player nicknames above messages from other players.
- **Notes:**
  - Own messages never show nickname
  - Fallback to "Player N" if nickname not set (where N is player position 0, 1, 2...)

### showTitle
- **Type:** Boolean
- **Default:** `false`
- **Description:** Display player titles above messages from other players.
- **Notes:**
  - Own messages never show title
  - Only shown if title is set on player object

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
          showTitle: false
          reactionEmojisAvailable: ["❤️", "👍", "😊", "🎉", "🤔"]
          reactToSelf: true
          numReactionsPerMessage: 2
        elements:
          - type: prompt
            file: projects/example/discussion_prompt.md
          - type: submitButton
```

### Common Configurations

**No reactions (text only):**
```yaml
discussion:
  chatType: text
  showNickname: true
  showTitle: false
  # reactionEmojisAvailable not specified or empty array
```

**Limited reactions:**
```yaml
discussion:
  chatType: text
  showNickname: true
  reactionEmojisAvailable: ["👍", "👎"]
  reactToSelf: false
  numReactionsPerMessage: 1
```

**Full reactions:**
```yaml
discussion:
  chatType: text
  showNickname: true
  reactionEmojisAvailable: ["❤️", "👍", "😊", "🎉", "🤔", "😢", "😮", "🤯"]
  reactToSelf: true
  numReactionsPerMessage: 3
```

## Features

### Layout
- ✅ Right-aligned blue bubbles for own messages (with white text)
- ✅ Left-aligned gray bubbles for others' messages
- ✅ Speech bubble tails (bottom-right for self, bottom-left for others)
- ✅ Responsive design that adapts to window width
- ✅ Messages take up max 75% of parent width, then wrap
- ✅ Smooth auto-scroll to show latest messages with animation
- ✅ Messages appear from bottom of window and push upward
- ✅ Scrollback capability for message history
- ✅ Relative timestamps (e.g., "now", "5m ago", "2h")
- ✅ Rounded border around entire chat interface
- ✅ Proper vertical text centering in bubbles

### Reactions
- ✅ Always-visible emoji reaction button (subtle when not hovered)
- ✅ Button darkens on message hover for discoverability
- ✅ Click button to open emoji picker
- ✅ Emoji picker positioned to stay within window bounds
  - For self messages: picker appears to left of button
  - For other messages: picker appears to right of button
  - In message input: picker appears above and aligned right
- ✅ Click emoji to add reaction
- ✅ Multiple users can use same emoji (shows count)
- ✅ Multiple different emojis can be added (up to configured limit)
- ✅ Hover over reaction to see who reacted (using nicknames)
- ✅ Click own reaction to remove it
- ✅ Visual indication of own reactions (blue border)
- ✅ Reactions positioned directly under bubbles with slight overlap
  - Right-aligned for self messages
  - Left-aligned for other messages
- ✅ Configurable limits on reactions per message
- ✅ Option to allow/disallow reacting to own messages
- ✅ Click outside picker to close

### Message Composition
- ✅ Emoji picker button in message input (right edge)
- ✅ Click emoji to insert into message text
- ✅ Inserts at cursor position (or end if no cursor)
- ✅ Auto-resizing text area (up to 200px height)
- ✅ Send button with icon
- ✅ Keyboard shortcuts (Enter to send, Shift+Enter for newline)

## Data Export

The chat system exports data under the `chatActions` key in the science data export:

```javascript
chatActions: [
  {
    id: 1,
    type: "send_message",
    content: "Hello everyone!",
    targetId: undefined,
    playerPosition: 0,
    sender: {
      id: "player_abc",
      name: "Player 0",
      title: undefined,
      avatar: undefined
    },
    stage: "discussion_round_1",
    time: 15
  },
  {
    id: 2,
    type: "add_reaction_emoji",
    content: "👍",
    targetId: 1,
    playerPosition: 1,
    stage: "discussion_round_1",
    time: 23
  },
  {
    id: 3,
    type: "remove_reaction_emoji",
    content: undefined,
    targetId: 2,
    playerPosition: 1,
    stage: "discussion_round_1",
    time: 45
  }
]
```

This action-based format enables:
- Complete reconstruction of conversation state at any point in time
- Analysis of reaction patterns and timing
- Full interaction history for research purposes
- Support for future features (message editing, deletion, threads, etc.)

**Note:** The old `textChats` export format has been removed. Only `chatActions` is exported.

## Migration from Old TextChat

The old `TextChat` component has been **removed** from the codebase. All chat stages should now use the modern `Chat` component from `client/src/chat/Chat.jsx`.

Key differences from old implementation:
- **Data structure:** Actions stored in `chat` attribute (not `textChat`)
- **Layout:** Modern bubbles with self/other distinction (not simple left-aligned)
- **Features:** Full emoji reaction support (not just text)
- **Logging:** Comprehensive action-based logging (not just message storage)
- **Export:** `chatActions` format (old `textChats` format removed)

### Updating Old Treatment Files

If you have treatment files using the old chat system, update them as follows:

**Old format (no longer supported):**
```yaml
discussion:
  chatType: text
  # Basic text chat only
```

**New format:**
```yaml
discussion:
  chatType: text
  showNickname: true
  showTitle: false
  # Add emoji parameters as needed:
  reactionEmojisAvailable: ["👍", "❤️"]  # or omit/empty array for no reactions
  reactToSelf: true
  numReactionsPerMessage: 1
```

The new chat interface will work with minimal configuration - just specify `chatType: text` and optionally add emoji reaction parameters as needed.

## Styling

Uses Tailwind CSS with Empirica color palette:
- `blue-500` (#3b82f6) for self message bubbles
- `gray-200` (#e5e7eb) for other message bubbles
- `white` for text in self messages
- `gray-800` for text in other messages
- `slate-800/60` for borders (60% opacity)
- Custom fade-in animation defined in `client/windi.config.cjs`
- Rounded corners (`rounded-xl`, `rounded-2xl`, `rounded-3xl`)
- Shadow effects (`shadow-lg`) for depth

### Visual Design Elements

**Message Bubbles:**
- Speech bubble tails using CSS border tricks
- Tail points to sender (bottom-right for self, bottom-left for others)
- Maximum 75% width with proper text wrapping
- Vertical padding for text centering

**Emoji Picker:**
- White background with border
- Grid layout for emoji display
- Hover states for emoji buttons
- Positioned to always stay within viewport

**Reactions:**
- Subtle gray background
- Blue highlight for own reactions
- Hover tooltips showing reactor names
- Click feedback for removal

**Overall Container:**
- Rounded border around entire chat interface
- White background
- Subtle shadow for depth
- Responsive to parent container size
