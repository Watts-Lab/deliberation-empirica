## Treatments

Treatments are comprised of display elements such as text, images, sounds, videos, prompts, surveys, page separators, timers, etc. that are shown to experiment participants; and also a manifest file `myExperiment.treatments.yaml` that specifies which display elements should be shown to which participants a at what times, and under what conditions.

### Display elements

#### `audio`

Plays an audio file from the assets folder. The audio starts playing automatically when displayed to participants.

**Example:**

```yaml
- type: audio
  file: shared/airplane_chime.mp3
  displayTime: 5
```

**Options**

- **`file`** (required): path to the audio file relative to the assets folder

**Notes:**
- Audio files should be placed in the assets folder of your project
- Common audio formats like MP3, WAV, and OGG are supported
- The audio will play automatically when the element is displayed

#### `display`

Displays a value from a prompt, survey, or other referenceable item, as a quote formatted string. For this to make sense, you probably need to add some context in a `noResponse` prompt above the display.

**Example:**

```yaml
- type: display
  reference: prompt.participantResponse
  position: player
```

**Options**

- **`reference`** (required): the reference to the data to display (e.g., `prompt.promptName`, `survey.surveyName`)
- **`position`** (required): which player's data to display:
  - `"player"` - display data from the current player
  - `"shared"` - display shared data (for shared prompts)
  - `0`, `1`, `2`, etc. - display data from a specific player position

**Notes:**
- The displayed content appears as a blockquote with gray styling
- Common usage is to show a participant's previous response to provide context
- Can be combined with conditions to show different responses based on criteria

#### `image`

Displays an image file from the assets folder. Images are centered and responsive to screen size.

**Example:**

```yaml
- type: image
  file: shared/question.png
  width: 80
```

**Options**

- **`file`** (required): path to the image file relative to the assets folder
- **`width`** (optional): width of the image as a percentage of the container (default: 100%)

**Notes:**
- Image files should be placed in the assets folder of your project
- Common image formats like PNG, JPEG, GIF, and SVG are supported
- Images are automatically centered and scale responsively

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

Embeds a Qualtrics survey in an iframe. The survey automatically receives participant identification parameters and submits the stage when completed.

**Example:**

```yaml
- type: qualtrics
  url: https://upenn.co1.qualtrics.com/jfe/form/SV_cumihDjKknDL702
  params:
    - key: condition
      value: "treatment_a"
    - key: sessionInfo
      value: "demo_session"
```

**Options**

- **`url`** (required): the full URL to the Qualtrics survey
- **`params`** (optional): array of additional parameters to pass to the survey
  - Each parameter has a `key` and `value` field

**Notes:**
- The system automatically passes `deliberationId` and `sampleId` parameters
- The iframe spans the full window width and height
- Stage automatically submits when the survey is completed
- Survey responses are linked to participants through the automatic ID parameters

#### `separator`

Displays a horizontal line to visually separate content sections. Different styles are available for different visual weights.

**Example:**

```yaml
- type: separator
  style: thick
  displayTime: 10
  hideTime: 15
```

**Options**

- **`style`** (optional): thickness of the separator line
  - `"thin"` - creates a 1px gray line
  - `"regular"` or not specified - creates a 3px gray line (default)
  - `"thick"` - creates a 5px darker gray line

**Notes:**
- Separators include vertical margins for proper spacing
- Useful for creating visual breaks between different sections of content
- Can be timed to appear and disappear at specific moments using `displayTime` and `hideTime`

#### `sharedNotepad`

Creates a collaborative text editor that all participants in the same game can edit simultaneously. Uses Etherpad for real-time collaboration.

**Example:**

```yaml
- type: sharedNotepad
  name: brainstorming_session
```

**Options**

- **`name`** (optional): identifier for the notepad. If not provided, uses the stage name. Multiple elements with the same name share the same notepad.

**Notes:**
- All participants see the same notepad and can edit simultaneously
- The notepad content is automatically saved and exported with the game data  
- Requires an Etherpad server to be configured (handled automatically in the platform)
- The notepad ID is automatically generated from the game ID and notepad name

#### `submitButton`

Creates a button that participants can click to advance to the next stage. Automatically records the time elapsed before submission.

**Example:**

```yaml
- type: submitButton
  buttonText: Continue to Next Section
  name: section1Submit
  displayTime: 10
```

**Options**

- **`buttonText`** (optional): text displayed on the button (default: "Next")
- **`name`** (optional): identifier for the button used in data export and conditions (default: uses stage progress label)

**Notes:**
- The button automatically records timing data when clicked
- Useful for allowing participants to control their pacing through stages
- Can be combined with `displayTime` to prevent rushing through content
- Button data is saved with the format `submitButton_{name}` containing elapsed time

#### `survey`

Displays a survey from the survey library. Surveys are predefined instruments that automatically handle data collection and validation.

**Example:**

```yaml
- type: survey
  surveyName: ExampleSurvey
  name: preTaskSurvey
```

**Options**

- **`surveyName`** (required): name of the survey from the survey library (must match exactly)
- **`name`** (optional): identifier for this survey instance (default: combines surveyName and stage label)

**Notes:**
- Surveys come from the `@watts-lab/surveys` package
- Each survey handles its own validation and submission logic
- Survey responses are automatically saved with participant and timing data
- The stage automatically advances when the survey is completed
- Multiple instances of the same survey can be used with different `name` values

#### `talkMeter`

Displays a real-time indicator of how much time the current participant has spent speaking during the current stage. Requires audio detection to be enabled.

**Example:**

```yaml
- type: talkMeter
```

**Options**

- No additional options are available for this element

**Notes:**
- Automatically tracks when a participant starts and stops speaking
- Shows both current speaking duration and cumulative speaking time  
- Displays the proportion of stage time spent speaking
- Requires microphone access and audio level detection
- Useful for encouraging balanced participation in discussions
- Only shows data for the current participant (not other players)

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

### Treatment manifests

Treatments are specified using a manifest file written using [yaml](https://www.cloudbees.com/blog/yaml-tutorial-everything-you-need-get-started) syntax.
