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

- **`reactionEmojisAvailable`** (array of emoji strings, default: `[]`): List of emojis available for reactions. Examples: `["👍", "❤️", "😊"]`. When empty, null, undefined, or false, emoji reactions are completely disabled and reaction buttons are hidden. Can only be used when `chatType` is `"text"`.

- **`reactToSelf`** (boolean, default: `true`): Whether players can react to their own messages. When false, the emoji reaction button is hidden on the player's own messages. Can only be used when `chatType` is `"text"`.

- **`numReactionsPerMessage`** (non-negative integer, default: `1`): Maximum number of different emoji reactions each player can add to a single message. A user cannot add the same emoji multiple times, but can add up to this many different emojis. Can only be used when `chatType` is `"text"`.

- **`showToPositions`** (array of nonnegative integers): Restrict the discussion UI to only the listed player positions. Useful when only some players should see or participate in the discussion for a stage. If provided, only those players will render the discussion.

- **`hideFromPositions`** (array of nonnegative integers): Hide the discussion UI from the listed player positions. This is the inverse of `showToPositions`. If both are provided, `hideFromPositions` further filters out positions from the `showToPositions` set.

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
  layout:
    0: { grid: { rows: 1, cols: 1 }, feeds: [...] }
```

### Treatment manifests

Treatments are specified using a manifest file written using [yaml](https://www.cloudbees.com/blog/yaml-tutorial-everything-you-need-get-started) syntax.
