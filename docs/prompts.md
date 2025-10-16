# Prompts

Prompts are specified as markdown files using [Commonmark](https://commonmark.org/help/) with a [Github-Flavored Markdown](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax) plugin. They have three sections, separated by lines containing exactly three dashes: (1) metadata, (2) display text, (3) response options.

Example file below:

```
---
name: projects/example/multipleChoiceNumbers.md
type: multipleChoice
notes: supports testing
---

# What is the biggest number less than 7?

---

- 0
- 0.5
- 3
- 5.5
- six
- 7
- 8
```

### Metadata

Metadata is specified as YAML front matter. Required fields include:

- **name** (must match the path of the file relative to the repository root)
- **type** specifies what type of response is expected, values include:
  - noResponse: Only the display elements
  - multipleChoice: options will be formatted as radio buttons for single select
  - openResponse: a text entry box is provided
  - listSorter: options will be formatted for drag-and-drop reordering
  - slider: a slider control is provided with customizable tick marks and labels

### Display text

This is text (and lists, tables, and images) that are displayed to the user. The only thing you can't use from normal markdown syntax is three hyphens (`---`) to specify a horizontal line.

Display text can include images, but they must be refered to by the path to the root of the assets folder, e.g. `![questionImage](shared/question.png)`

### Response options

- Multiple choice and listsorter options use a markdown list syntax using dashes `-`
- Open response options should be prepended with a markdown quote format, using a `>` character

## Special options

The markdown metadata can take several options that depend on the prompt type:

### multipleChoice

- `shuffleOptions: true` will randomize the order of the response options before displaying them to participants, storing the displayed order with the data

### openResponse

- `rows: 5` will make the response box 5 (or other specified number) lines tall.
- `minLength: 50` will display a character counter showing progress toward the minimum required characters (e.g., "(25 / 50+ characters required)")
- `maxLength: 200` will display a character counter showing remaining characters allowed (e.g., "(125 / 200 chars max)")
- When both `minLength` and `maxLength` are specified, displays as "(current / min-max chars)" format
- Character counters appear in the lower right corner of the text area and update in real-time

### slider

- `min: 0` (required) - minimum value of the slider
- `max: 100` (required) - maximum value of the slider
- `interval: 1` (required) - step size for the slider (must satisfy: min + interval <= max)
- `labelPts: [0, 20, 50, 80, 100]` (optional) - array of values where tick marks and labels should appear
- When `labelPts` is specified, the number of entries must match the number of labels in the response section
- The slider initially appears without a thumb to avoid anchoring effects. When the user clicks on the slider bar, a value is set and the thumb appears
- Labels are centered under their corresponding tick marks with intelligent text wrapping

Example:

```
---
name: projects/example/sliderExample.md
type: slider
min: 0
max: 100
interval: 1
labelPts: [0, 20, 50, 80, 100]
---

# How warm is your love for avocados?

---
- Very cold
- Chilly
- Tolerable
- Warm
- Super Hot
```
