# Deliberation Lab Science Data Export

When a study is running, Deliberation Lab automatically exports data to one or more researcher-specified GitHub repositories. All data is written to a file named using the batch name and timestamp followed by `.scienceData.jsonl`.

Data is pushed at two specific moments. **First**, when a participant completes all required stages of the experiment and reaches the final debrief screen, Deliberation Lab packages all scientific data associated with that participant and writes it as a single JSONL row to the designated science data export file. This push occurs within roughly 60 seconds of the participant finishing. **Second**, when the batch is closed by the researcher, Deliberation Lab exports data for all remaining participants who did not complete the study—whether because they never started, dropped out prior to randomization, or dropped out after randomization but before reaching the final exit stage.

# Format

Each line of a Deliberation Lab JSONL export contains a complete record of a participant’s run through the platform. Because all configuration, stimuli, responses, metadata, and diagnostics are included in each line, the export provides a self-contained, reproducible snapshot of exactly what the participant saw and did. This document describes every major component of the export.

---

# 1. Identifiers and Session Metadata

These fields uniquely identify the participant, the session, the group they were assigned to, and how their session ended.

## `containerTag`

Indicates the version or deployment of Deliberation Lab that generated the data. This helps diagnose version-specific issues and ensures reproducibility.

## `deliberationId`

A stable identifier for the participant across all sessions and studies on Deliberation Lab. It effectively functions as a persistent participant ID. If the same person participates in multiple experiments, they will retain the same `deliberationId`, allowing cross-study matching.

## `sampleId`

A unique identifier for this specific participant-session. A new `sampleId` is assigned each time a participant is randomized into a condition. Each line in the export corresponds to exactly one `sampleId`. These IDs also appear in preregistration files, enabling alignment between assigned samples and completed data, to ensure traceability and data completeness.

## `gameId`

Identifies the shared game instance for all participants who interacted together. All members of the same group share the same `gameId`. This enables grouping participants to reconstruct dyads or larger group sessions.

## `position`

A zero-based index indicating the participant’s position or role within the group defined by the treatment. Different positions may receive different content or roles (e.g., Republican in position 0, Democrat in position 1). Used to align group members and reconstruct role-specific stimuli.

## `exitStatus`

Indicates how the participant’s run ended (e.g., `complete`, `lobbyTimeout`, `failedEquipmentCheck`, or an error code). This is useful for filtering valid completions, diagnosing dropouts, and interpreting whether participants ever reached the intended stages of the study.

---

# 2. Device, Browser, and Connection Information

These fields support debugging and quality assurance, helping researchers understand the participant’s technical environment.

## `browserInfo`

Contains information about the participant’s device and browser, including screen size, window size, user agent, language, and timezone. Useful for identifying device-related issues, detecting unusual client behavior, or including device type as a covariate in analysis.

## `connectionInfo`

Records network characteristics such as detected country, VPN status, effective connection type (`4g`, `3g`, etc.), bandwidth, and latency. This is often used to check that participants come from expected locations, diagnose technical failures, or interpret patterns of dropout associated with poor connectivity.

## `connectionHistory`

A timestamped log of connection and disconnection events. Used for diagnosing unstable connections, identifying technical disruptions, and potentially excluding participants with significant connectivity issues.

---

# 3. Batch Configuration (`config`)

The `config` object contains the full configuration snapshot used to run this participant’s session. It includes:

- batch metadata (`batchName`, `launchDate`)
- YAML source references (`treatmentFile`, `introSequence`)
- consent file paths
- audio/video check settings
- dispatch logic parameters
- preregistration and data export repository locations
- video storage location (S3 bucket and region)

This block ensures that a data consumer has all the information they need to understand how the sample was generated. It describes exactly how the platform was configured during this participant’s run, and their sequence through the study.

---

# 4. Timing Information

These fields describe when key events occurred and how long the participant spent in different parts of the study.

## `times`

Timestamps marking major events such as arrival, intro completion, game start, game end, and overall completion. Useful for reconstructing participant flow and diagnosing bottlenecks or delays.

## `stageDurations`

Tracks how long the participant spent on intro/exit steps before clicking through. It currently reflects only the participant’s own elapsed time on those pages (not group wait time, and not main game stages). Useful for spotting extremely fast or slow completions of required intro/exit content.

## `stageSubmissions`

Records when the participant personally pressed the stage’s submit button (when present). This often differs from `stageDurations` because the participant may finish earlier and wait for others. Useful for detecting fast-clicking, engagement patterns, or identifying who was slowest within a group.

---

# 5. Consent

## `consent`

A list of the specific consent items the participant agreed to. These may include data release, video recording, storage permissions, and addenda. Custom consent forms will produce custom entries. Useful for verifying participant eligibility and auditing compliance requirements.

---

# 6. Setup Steps (`setupSteps`)

A chronological record of diagnostic steps during the session startup, including:

- camera and microphone permission checks
- audio and video equipment tests
- OS and browser detection
- any errors encountered

This section is especially helpful when diagnosing failures and pre-assignment dropouts.

---

# 7. Recording Information

These fields identify the correct audio and video recordings for this participant.

## `recordingsFolder`

The S3 folder containing all recordings for this group. All participants with the same `gameId` share this folder.

## `recordingRoomName`

The Daily.co room used for the recording.

## `recordingIds` / `recordingsPath`

Identifiers for the audio/video files belonging to this participant. If a participant disconnects and reconnects, multiple recordings may be associated with them. These fields allow matching between participants and their tracks.

---

# 8. Surveys (`surveys`)

Survey entries represent standardized survey instruments administered throughout the study (intro, mid-game, exit).

Each survey object includes:

- survey metadata (source package, version, commit hashes)
- raw responses (`responses`)
- computed scores (`result`) reflecting normalized or aggregated metrics
- timing information (`secondsElapsed`)
- the specific step in the game where the survey occurred

Because scoring is handled centrally and version-controlled, these computed results are consistent across studies.

Surveys provide key psychological and attitudinal measures such as Big Five personality traits, political attitudes, or team viability.

---

# 9. Prompt Responses (`prompts`)

Prompts are custom, study-specific questions or tasks defined in the experiment’s YAML. For each prompt, the export includes:

- the exact text shown to the participant
- the response options or input fields
- the participant’s response (`value`)
- timing information (`stageTimeElapsed`)
- prompt metadata (author, modification date, notes)

This ensures complete visibility into the exact stimuli each participant saw and enables reconstruction of customized tasks, open-ended prompts, sliders, multiple-choice items, and other non-survey interactions.

---

# 10. Qualtrics Responses (`qualtrics`)

Contains data pulled from Qualtrics when a study step uses a Qualtrics survey and the Deliberation Lab server is configured with valid Qualtrics API keys. Each entry includes the step metadata and the fetched Qualtrics payload. If API credentials are not supplied, this field is `"missing"`, and researchers must download and align Qualtrics data manually (e.g., by session or participant IDs included in the study design).

---

# 11. Quality Control Survey (`QCSurvey`)

A standard survey administered across all Deliberation Lab studies. It includes participant feedback on:

- willingness to participate again
- adequacy of compensation and time
- clarity of instructions
- video and technical quality
- reported technical issues

This survey supports continuous monitoring of platform health, identifying regressions, and ensuring consistent participant experience across versions.

---

# 12. Conversational and Behavioral Logs

These logs capture events occurring during live interactions, including speaking events, text chat actions, and status checks.

## `speakerEvents`

Logs detected speech activity during the conversation, such as when participants start and stop speaking. Useful for analyzing speaking time, turn-taking, and conversational dynamics.

## `chatActions`

Logs text chat events when text chat is enabled, including messages and system events. See [Analyzing Chat Action Logs](./chat-actions.md).

## `reports`

Represents participant-initiated reports about missing or inactive group members. A report triggers a check-in process.

## `checkIns`

Logs the check-in events that occur after a report is filed. Non-reporting participants must confirm they are still present within 60 seconds. These logs indicate whether a conversation meaningfully occurred. A conversation in which someone fails to check in can be identified and handled appropriately in analysis.

---

# 13. Treatment Assignment and Game Structure (`treatment`)

This block describes the experimental condition assigned to the participant and the full structure of the game they experienced.

## `treatment.name`

Identifies the specific treatment condition assigned to the participant. This field is typically used to group data by condition in analysis.

## Treatment metadata

Includes a plain-language description of the treatment, the number of players in the group, and any position-specific roles defined in the study.

## `gameStages`

A fully expanded list of all stages in the game, with all template variables resolved. This includes prompts, surveys, videos, timers, conditional displays, shared elements, and any dynamic presentation logic. This list shows exactly what the participant saw in their position.

## `exitSequence`

A fully resolved list of post-game surveys or tasks shown during the exit phase.

This section guarantees full transparency and reconstructability of the experimental condition delivered to each participant.

---

# 14. Additional Fields and Diagnostics

## `batchId`

The server-side identifier for the batch in which this participant ran. Useful for grouping participants who shared the same launch configuration.

## `introSequence`

The intro sequence assigned to this participant (if any). Included to confirm which onboarding path was delivered.

## `cumulativeSpeakingTime`

Seconds the participant was detected as the primary speaker during discussions, as tracked by the talk meter. May be `"missing"` if talk-meter tracking is disabled.

## `exportErrors`

An array of validation or consistency errors detected during export (for example, mismatched batch/game IDs). Typically empty; investigate non-empty entries.

## `missing` placeholders

Many fields may take the string `"missing"` when data is unavailable (e.g., Qualtrics not configured, no recordings, or a participant dropped before certain steps). Handle these cases explicitly in analysis.

---
