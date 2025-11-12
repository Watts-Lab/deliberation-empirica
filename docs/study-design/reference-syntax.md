# Reference Syntax

Many Deliberation Lab features allow you to reference previously collected data—prompt responses, survey answers, player attributes, or shared records. This page documents the common reference strings and where they can be used (e.g., `display` elements, `conditions`, or custom components).

---

## Prompt Responses

- `prompt.<name>` — The value saved by a prompt element. `<name>` defaults to the prompt’s front‑matter `name`, unless overridden via the `name` prop in the treatment YAML.
- `prompt.<name>.value` — Equivalent shorthand for `prompt.<name>`.

### Examples

```yaml
- type: display
  reference: prompt.topicA_prompt

conditions:
  - key: prompt.topicA_prompt
    comparator: equals
    value: "Yes"
```

---

## Surveys

- `survey.<name>` — Full survey record saved by the `survey` element (includes metadata).
- `survey.<name>.responses.<questionId>` — Specific question response, if the survey component exposes structured data.

### Example

```yaml
conditions:
  - key: survey.ExampleSurvey.responses.q1
    comparator: greaterThan
    value: 5
```

---

## Qualtrics

Qualtrics embeds store metadata under `qualtricsDataReady`:

- `qualtrics.sessionId` — Session identifier returned by Qualtrics.
- `qualtrics.surveyId` — Qualtrics survey ID.

Use these primarily for debugging; detailed responses live in Qualtrics exports.

---

## Player & Game Attributes

Any property saved via `player.set` or `game.set` is available for reference:

- `player.<key>` — Current player’s attribute (e.g., `player.nickname`).
- `game.<key>` — Shared game-level attribute (e.g., `game.treatmentCondition`).

When referencing from conditions, remember that values belong to the `player` evaluating the condition unless you explicitly set them as shared values.

---

## Position-based References

Some hooks allow you to specify a `position` to pull data from another participant:

- `display` element `position` prop — set to a zero-based index, `"shared"`, or `"player"` (default).  
- Conditional `position` (coming soon) — currently you must store shared copies of data if you need cross-player comparisons.

---

## Tips

1. **Name everything intentionally.** Unique prompt/survey names make referencing and data exports far easier.
2. **Inspect saved data locally.** During dev runs, check `data/tajriba.json` or the browser devtools (`player.get(...)`) to confirm the exact key/value structure.
3. **Use shared records when multiple players need the same value.** For prompts set `shared: true`; for custom data use `game.set`.
4. **Keep references consistent with exports.** Whatever you reference in treatments should match the keys analysts expect downstream.

Have a new data type you want to reference? Update this guide so future studies stay consistent.
