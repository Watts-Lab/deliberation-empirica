# Treatments

Treatments are comprised of display elements such as text, images, sounds, videos, prompts, surveys, page separators, timers, etc. that are shown to experiment participants; and also a manifest file `myExperiment.treatments.yaml` that specifies which display elements should be shown to which participants a at what times, and under what conditions.

## Creating `introSequences`

## Creating `treatments`

## Layout

As with any software, there is a tradeoff to be made between flexibility and ease of use. In designing the Deliberation Lab interface, we have made several design choices that constrain how elements can be presented visually, but that make it much simpler to construct and interpret treatment designs.

The strongest constraint has been to enforce a 1-column layout for display elements. Display elements (prompts, timers, etc) are all displayed in single column in the order in which they appear in the treatment file. For example,

```yaml
gameStages:
  - name: Demo one-column layout
    duration: 60
    elements:
      - type: prompt
        file: projects/example/markdownTable.md

      - type: submitButton
```

## Conditional Rendering

### Showing at particular times

```yaml
elements:
  - type: prompt
    file: myPrompt.md
    displayTime: 10
```

```yaml
elements:
  - type: prompt
    file: myPrompt.md
    hideTime: 30
```

### Showing to specific players

```yaml
showToPositions:
  - 0
  - 1
```

hideFromPositions: - 0

### Comparators

#### Exists

#### notExists

#### equal

### Treatment manifests

Treatments are specified using a manifest file written using [yaml](https://www.cloudbees.com/blog/yaml-tutorial-everything-you-need-get-started) syntax.
