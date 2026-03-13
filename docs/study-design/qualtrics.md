# Qualtrics Integration

Deliberation Lab can embed a Qualtrics survey as a stage element, advance automatically when participants submit, and (when credentials are configured) pull the completed response into the science data export.

## Prerequisites

- In order to capture data from Qualtrics directly into the Deliberation Lab scienceData export, environment variables must be set on the server before loading a treatment containing a Qualtrics element:
  - `QUALTRICS_API_TOKEN`
  - `QUALTRICS_DATACENTER` (e.g., `iad1`, `eu1`)
- The Qualtrics survey must be published and reachable at the URL you provide. The URL should include the survey ID as its final path segment (used for API fetches).

## Add a Qualtrics element to a stage

In a treatment file:

```yaml
- name: Example Stage
  duration: 600
  elements:
    - type: qualtrics
      url: https://yourdc.qualtrics.com/jfe/form/SV_ABC123
      urlParams:
        - key: condition
          value: treatment
```

Rules and behavior:

- `url` is required; `urlParams` is optional.
- At runtime, Deliberation Lab **automatically appends** `deliberationId` and `sampleId` as query parameters so you can join Qualtrics data to the science export even if API fetches are disabled.
- If `QUALTRICS_API_TOKEN` or `QUALTRICS_DATACENTER` is missing, batch initialization fails when validating treatments.

## Passing URL parameters

Each entry in `urlParams` accepts:

- `key`: required — the query parameter name.
- `value`: optional literal string, number, or boolean.
- `reference`: optional [Reference Syntax](reference-syntax.md) pointer resolved from player/game state at render time. Cannot be combined with `value`.
- `position`: optional position selector (`player`, `shared`, `all`, etc.) for the reference lookup — defaults to `player`.

**Static value** (same for all participants):

```yaml
urlParams:
  - key: condition
    value: treatment-A
```

**Dynamic reference** (resolved per-participant at render time):

```yaml
urlParams:
  - key: prolificId
    reference: urlParams.PROLIFIC_PID
  - key: participantName
    reference: participantInfo.name
```

**Mixed** (static and dynamic together):

```yaml
urlParams:
  - key: condition
    value: treatment-A
  - key: prolificId
    reference: urlParams.PROLIFIC_PID
  - key: surveyAnswer
    reference: prompt.topicChoice
```

Any reference namespace supported by the platform works here — `urlParams`, `participantInfo`, `connectionInfo`, `browserInfo`, `prompt`, `survey`, etc. See [Reference Syntax](reference-syntax.md) for the full list.

## What participants see

- The survey is embedded in an iframe sized for the stage.
- Idle detection is relaxed while the iframe is active (to avoid false “idle” when the cursor is inside the Qualtrics frame).

## Submission and stage advancement

- When the participant reaches the Qualtrics end-of-survey screen, Qualtrics posts a `QualtricsEOS|<surveyId>|<sessionId>` message.
- The client:
  - Marks the survey as submitted.
  - Sets `qualtricsDataReady` on the player with `{ step, surveyURL, surveyId, sessionId }`.
  - Calls the stage `onSubmit`, advancing to the next element/stage.

## Data capture

- The science data export includes all such entries in the `qualtrics` block:
  - `step`, `surveyId`, `sessionId`, `surveyURL`, and the fetched `data` payload.
- If the API fetch fails or credentials are absent, the `qualtrics` entry is `"missing"`, and you must download responses from Qualtrics and join using the appended `deliberationId`/`sampleId`.

## Identity linking

- Two IDs are always appended to the Qualtrics URL:
  - `deliberationId`: stable participant ID across studies.
  - `sampleId`: unique per assignment/run within a study.
- Use either (or both) to join Qualtrics exports to Deliberation Lab data when manual reconciliation is needed.

## Troubleshooting

- **Stage doesn’t advance**: ensure the Qualtrics survey ends on the standard thank-you page so the `QualtricsEOS` postMessage fires.
- **Validation fails on batch creation**: check `QUALTRICS_API_TOKEN` and `QUALTRICS_DATACENTER` env vars.
- **No data in `qualtrics` export**: verify API credentials and that the survey URL’s trailing segment is the survey ID. If still empty, download from Qualtrics and join on `deliberationId`/`sampleId`.
- **Cross-account surveys**: you can embed a survey owned by another Qualtrics account, but the API token’s account must have access to that survey to fetch responses. Without access, the survey will still display, but you’ll need to download responses from Qualtrics and join manually using the appended IDs.
