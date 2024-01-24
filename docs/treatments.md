## Treatments

Treatments are comprised of display elements such as text, images, sounds, videos, prompts, surveys, page separators, timers, etc. that are shown to experiment participants; and also a manifest file `myExperiment.treatments.yaml` that specifies which display elements should be shown to which participants a at what times, and under what conditions.

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
