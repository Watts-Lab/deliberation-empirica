# Reference Syntax

Many Deliberation Lab features allow you to reference previously collected data—prompt responses, survey answers, player attributes, or shared records. This page documents the common reference strings and where they can be used (e.g., `display` elements, `conditions`, or custom components).

## Prompt Responses

- `prompt.<name>` — The value saved by a prompt element. `<name>` should be set for the prompt in the treatment YAML.

Prompt definition:

```yaml
- type: prompt
  name: topicA_prompt
  file: demo/topicA.md
```

Conditional usage:

```yaml
conditions:
  - reference: prompt.topicA_prompt
    comparator: equals
    value: "Yes"
```

## Surveys

- `survey.<name>` — Full survey record saved by the `survey` element (includes metadata).
- `survey.<name>.responses.<questionId>` — Specific question response, if the survey component exposes structured data.
- `survey.<name>.result.<scoreKey>` — Computed scores exported by the survey library (see the survey’s documentation for keys).

Survey definition:

```yaml
- type: survey
  surveyName: TIPI
  name: preTIPI
```

Conditional usage:

```yaml
conditions:
  - reference: survey.preTIPI.result.normAgreeableness
    comparator: isAtLeast
    value: 0.75
```

Raw answers generally live under `survey.<name>.responses.*`; computed scores live under `survey.<name>.result.*`.

## Qualtrics

Embedded qualtrics surveys store metadata under `qualtricsDataReady`:

- `qualtrics.sessionId` — Session identifier returned by Qualtrics.
- `qualtrics.surveyId` — Qualtrics survey ID.

Use these primarily for debugging; detailed responses live in Qualtrics exports.

## Submit Buttons

Submit buttons record the elapsed time (in seconds) when the participant clicked the button. Reference them via `submitButton.<name>.stageTime`.

Button definition:

```yaml
- type: submitButton
  name: introSubmit
  buttonText: Continue
```

Conditional usage:

```yaml
conditions:
  - reference: submitButton.introSubmit.stageTime
    comparator: isAtLeast
    value: 20
```

## URL Parameters

Query parameters from the participant’s landing URL are captured under `urlParams.<paramName>`. Use these to assign roles, confederates, or display role-specific content.

```yaml
- type: prompt
  file: demo/confederateInstructions.md
  conditions:
    - reference: urlParams.role
      comparator: equals
      value: confederate
```

## Connection Info

The consent step stores network metadata under `connectionInfo.*`. Fields currently recorded:

- `country` – ISO country code from the IP lookup.
- `timezone` / `timezoneOffset` – IP-based timezone information.
- `isKnownVpn` – `true` if the IP was found in the VPN list.
- `isLikelyVpn` – heuristic comparing VPN flag and mismatched timezone.
- `effectiveType`, `saveData`, `downlink`, `rtt` – values from the browser’s Network Information API (when available).

```yaml
conditions:
  - reference: connectionInfo.isKnownVpn
    comparator: equals
    value: false
  - reference: connectionInfo.country
    comparator: equals
    value: US
```

## Browser Info

Client-side browser information gathered during onboarding is saved under `browserInfo.*`. Fields currently recorded:

- `screenWidth`, `screenHeight` – available screen resolution.
- `width`, `height` – viewport size.
- `userAgent` – raw browser user-agent string.
- `language` – browser language (e.g., `en-US`).
- `timezone` – browser-reported timezone.
- `referrer` – document referrer.

```yaml
- type: prompt
  file: demo/browserWarning.md
  conditions:
    - reference: browserInfo.language
      comparator: doesNotEqual
      value: en-US
```

## Participant Info

Participant attributes stored directly on the player object—such as the nickname collected during onboarding or identifiers loaded from returning participants—can be referenced via `participantInfo.<field>`. Common keys include:

- `name` – the nickname the participant entered.
- `title` – optional display title (if your study sets one).
- `sampleId`, `platformId` – identifiers passed in from recruiting platforms.
- `participantData.<key>` – any object saved under `participantData`, such as `participantInfo.participantData.deliberationId`.

Prompt definition:

```yaml
- type: display
  reference: participantInfo.name
  position: 1 # show player 1's name
  showToPositions: [0]
```

In the example above, position 0 sees the nickname of position 1. Create a second `display` element with `position: 0` to mirror the behavior for the other participant.

## Discussion Metrics

When a stage contains a discussion component, Empirica tracks a few shared values:

- `discussion.discussionFailed` — `true` if a discussion was ended early because reported participants never rejoined.
- `discussion.cumulativeSpeakingTime` — Seconds the current participant has been the primary speaker (as tracked by the talk meter).

```yaml
conditions:
  - reference: discussion.discussionFailed
    comparator: equals
    value: true
  - reference: discussion.cumulativeSpeakingTime
    comparator: greaterThan
    value: 60
```

## Position-based References

Both display elements and conditional blocks can pull data from other participants by setting `position`. Valid values include:

- **Zero-based index (`0`, `1`, …)** — reference a specific player in the group.
- **`player`** — the current participant (default when omitted).
- **`shared`** — shared records (e.g., prompts with `shared: true`).
- **`all`** — require every participant to satisfy the condition.
- **`any`** — condition passes if at least one participant satisfies it.
- **`percentAgreement`** (`0–100`) — compare the largest consensus percentage against `value` using the specified comparator (e.g., check if ≥ 80% of players gave the same response).

Example:

```yaml
- type: submitButton
  buttonText: Continue
  conditions:
    - position: percentAgreement
      reference: prompt.topic_vote
      comparator: isAtLeast
      value: 80
```

---
