## Treatments

Treatments are comprised of display elements such as text, images, sounds, videos, prompts, surveys, page separators, timers, etc. that are shown to experiment participants; and also a manifest file `myExperiment.treatments.yaml` that specifies which display elements should be shown to which participants a at what times, and under what conditions.

### Display elements

#### Audio

#### Display

Displays a value from a prompt, survey, or other referenceable item, as a quote formatted string. For this to make sense, you probably need to add some context in a `noResponse` prompt above the display.

#### `prompt`

The most commonly used display element is the "prompt" type. These are markdown files that are broken into three sections. The first section contains metadata describing the prompt itself. The second section contains prompt text to be displayed to the participant, and can use normal markdown formatting. The third section contains prompt response options.

An example prompt file is below:

```
---
name: projects/example/multipleChoiceWizards.md
type: multipleChoice
shuffleOptions: true
notes: supports testing
---

# Which of the following wizards appears in the most novels?

---

- Ponder Stibbons
- Albus Dumbledore
- Harry Dresden
- Eskarina Smith
- Ged/Sparrowhawk
- Gandalf
- Dr. Strange
- Merlin
- Thomas Edison
```

Prompts can take several different types:

- **`noResponse`** prompts display text but do not ask the user to provide any answer
- **`multipleChoice`** prompts provide a list of options that will be formatted as radio-buttons after the prompt text
- **`openResponse`** prompts ask users to enter text in a textbox below the prompt text. Default text can be provided in the prompt response section
- **`listSorter`** prompts provide a list of options that participants can drag and drop into a different order.

Metadata includes a key to select between these types, along with additional information needed to store data, and additional options for specific prompt types. It is formatted as YAML front-matter, mirroring the [Jekyll](https://jekyllrb.com/docs/front-matter/) syntax.

- **`name`** (path string) must match the local path to the prompt markdown file. This serves as a check that the file is complete, and is stored for reference with the exported data.
- **`type`** [`noResponse`, `multipleChoice`, `openResponse`, `listSorter`] indicates the type of prompt, using the values above
- **`shuffleOptions`** [true, false] can be used to randomize the order of responses for multipleChoice and listSorter prompts
- **`rows`** (int >0) how many text rows to include in the open response box

#### `qualtrics`

#### `separator`

#### `submitButton`

#### `survey`

#### `talkMeter`

#### `timer`

Displays a progress bar with a countdown timer
![kitchenTimer](image/kitchenTimer.jpg)

**Example:**

```yaml
- type: timer
  startTime: 30
  endTime: 60
  warnTimeRemaining: 5
```

**Options**

- `startTime`: the stage time representing when the timer should begin counting down, and the left end of the progress bar. If not specified, defaults to the `displayTime` of the element, if that is specified, otherwise to 0. Note that `startTime` can be different from `displayTime`, in which case the bar will display before actually counting down, or will start counting down before displaying.
- `endTime`: the stage time representing when the timer should stop, and the right end of the progress bar. If not specified, defaults to `hideTime` of the element, if that is specified, otherwise to the stage duration. As with `startTime`, this can differ from when the element stops being displayed.
- `warnTimeRemaining`: the bar changes color from blue to red this many seconds from the end of the timer - so if the timer ends at 60 seconds, and the `warnTimeRemaining` is 10 seconds, then the bar will turn red at 50 seconds.

#### `video`

Plays a video from youtube as large as the window allows. Submits the stage when the video is complete.

**Example:**

```yaml
- type: video
  url: https://youtu.be/QC8iQqtG0hg
```

**Options**

- **url**: the url of a publicly available youtube video (can be unlisted)

### Stage-level Configuration

#### `discussion`

The `discussion` configuration object controls the chat interface that appears during a stage. It must be specified at the stage level.

Deliberation Lab ships two discussion interfaces:

- **Text chat** – a persistent chat thread with optional emoji reactions. Designers can enable reaction emojis, change how many reactions each participant can add, and control which positions see the chat.
- **Video call** – a Daily-powered video conference with configurable layouts. Designers can rely on the built-in responsive grid or provide explicit layouts (including picture-in-picture or telephone chain flows), hide each participant’s self view, and restrict who can see whom via breakout rooms.

Select the appropriate interface via `chatType` (either `text` or `video`); certain options are only respected for one interface or the other as noted below.

**Example:**

```yaml
gameStages:
  - name: Discussion Stage
    duration: 600
    discussion:
      chatType: text
      showNickname: true
      showTitle: false
      reactionEmojisAvailable: ["❤️", "👍", "😊", "🎉"]
      reactToSelf: true
      numReactionsPerMessage: 2
    elements:
      - type: prompt
        file: projects/example/prompt.md
```

**Options**

- **`chatType`** ([`text`, `video`] required): What type of discussion to enable.

- **`showNickname`** (boolean, default: `true`): Display player nicknames to other players. Falls back to "Player N" if nickname not set.

- **`showTitle`** (boolean, default: `false`): Display player titles above messages from other players. Only shown if title is set on player object.

- **`showToPositions`** / **`hideFromPositions`** (arrays of nonnegative integers): These filters apply to both text and video chats. They restrict which positions render the discussion component at all, regardless of interface.

##### Text chat options (`chatType: "text"`)

- **`reactionEmojisAvailable`** (array of emoji strings, default: `[]`): List of emojis available for reactions. Examples: `["👍", "❤️", "😊"]`. When empty, null, undefined, or false, emoji reactions are completely disabled and reaction buttons are hidden.

- **`reactToSelf`** (boolean, default: `true`): Whether players can react to their own messages. When false, the emoji reaction button is hidden on the player's own messages.

- **`numReactionsPerMessage`** (non-negative integer, default: `1`): Maximum number of different emoji reactions each player can add to a single message. A user cannot add the same emoji multiple times, but can add up to this many different emojis.

##### Video chat options (`chatType: "video"`)

- **`showSelfView`** (boolean, default: `true`): Whether participants see their own camera tile while in the video call. Set to `false` to hide self view for all players in that stage.

- **`rooms`** (array): Define breakout rooms by specifying `includePositions` lists. Each room should list the zero-based positions that can see each other. Any players not assigned to a room fall back to the default responsive layout with a warning in the console.

- **`layout`** (object): Provide fine-grained layout instructions per participant. Keys can be player positions (strings) or `"default"` to specify a fallback. Each entry should include:

  - `grid`: `{ rows, cols }` describing the logical grid.
  - `feeds`: an array where each feed defines:
    - `source`: `{ type: "self" }` or `{ type: "participant", position: <number> }`.
    - `media`: `{ audio: boolean, video: boolean }`.
    - `displayRegion`: rows/cols either as numbers (single cell) or `{ first, last }` ranges.
    - Optional `zOrder`, `render`, `label`, or `options`.

  Custom layouts allow picture-in-picture, telephone chain, or asymmetric grids. If a player does not have a specific entry, the `"default"` layout (if present) or the responsive layout is used.

Notes:

- Positions are zero-based indices into the `groupComposition`/player order. For example, `0` refers to the first player in the group, `1` the second, etc.
- Indices are validated against `playerCount`; out-of-range indices will fail preflight validation.
- These visibility keys apply to the entire discussion component for the stage (not just individual elements).

**Common Configuration Patterns:**

Text chat with no reactions:

```yaml
discussion:
  chatType: text
  showNickname: true
```

Limited reactions (thumbs up/down only):

```yaml
discussion:
  chatType: text
  showNickname: true
  reactionEmojisAvailable: ["👍", "👎"]
  reactToSelf: false
  numReactionsPerMessage: 1
```

Full reactions with multiple emojis:

```yaml
discussion:
  chatType: text
  showNickname: true
  showTitle: false
  reactionEmojisAvailable: ["❤️", "👍", "😊", "🎉", "🤔", "😢", "😮", "🤯"]
  reactToSelf: true
  numReactionsPerMessage: 3
```

Show discussion to only players 0 and 2:

```yaml
discussion:
  chatType: text
  showNickname: true
  showToPositions: [0, 2]
```

Hide discussion from player 1 (everyone else sees it):

```yaml
discussion:
  chatType: video
  hideFromPositions: [1]
```

Simple video breakout rooms (players 0 & 1 together, player 2 alone):

```yaml
discussion:
  chatType: video
  rooms:
    - includePositions: [0, 1]
    - includePositions: [2]
  showSelfView: false
```

Custom picture-in-picture layout for position 0:

```yaml
discussion:
  chatType: video
  layout:
    0:
      grid:
        rows: 4
        cols: 4
      feeds:
        - source: { type: "participant", position: 1 }
          media: { audio: true, video: true }
          displayRegion:
            rows: { first: 0, last: 1 }
            cols: { first: 0, last: 3 }
        - source: { type: "self" }
          media: { audio: false, video: true }
          displayRegion: { rows: 3, cols: 3 }
          zOrder: 10
        - source: { type: "participant", position: 2 }
          media: { audio: true, video: false }
          displayRegion:
            rows: { first: 2, last: 3 }
            cols: { first: 0, last: 3 }
```

### Treatment manifests

Treatments are specified using a manifest file written using [yaml](https://www.cloudbees.com/blog/yaml-tutorial-everything-you-need-get-started) syntax.
