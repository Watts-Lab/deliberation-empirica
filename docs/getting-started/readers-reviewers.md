# Readers and Reviewers

This page is for **readers and reviewers evaluating research that uses Deliberation Lab**, with a focus on what the platform _does_, what it _guarantees_, and where its limitations lie. The aim is to give you enough understanding to judge the credibility of results, and to point you to places where you can dig deeper if needed.

Full documentation: https://deliberation-lab.readthedocs.io/en/latest/

## What Deliberation Lab does

Deliberation Lab is a platform for experiments involving **live small-group discussions** (video or text) with tightly specified flows and logging.

At a high level, it:

- Runs **live small-group sessions** with configurable stage flows, prompts, surveys, timers, and conditional displays.
- Provides built-in **consent**, ID capture, device/network checks, and basic quality controls (e.g., attention/QC surveys).
- Integrates optional external tools such as **Qualtrics** (surveys) and **Etherpad** (shared notes), when credentials are supplied.
- Captures **behavioral logs** (e.g., speaking events, chat messages, missing-partner reports, connection events) alongside survey and prompt responses.
- Exports **well-structured, versioned data** so that analyses and replications can be audited and reproduced.

## How studies are specified and what is guaranteed

### Experiments as code

Experiments on Deliberation Lab are fully specified in a human-readable **treatment manifest** (plus supporting files). The manifest encodes every stage and stimuli participants see:

- Conditional, timed, or position-specific stimuli
- Text, questions, videos, audio, or other interactive elements

Because the experiment is defined as code:

- **Every design decision is explicit.** Nothing is “hidden” in an undocumented manual procedure.
- **Participant experience is deterministic** given the manifest and platform version. Any participant, anywhere, run under the same manifest and version, will receive the same sequence of screens and rules.
- **The exact manifest and assets used** for a study are stored and versioned, allowing full reconstruction of what participants saw.

For many published studies, the **Deliberation Assets** repository contains the manifests and prompts used. This serves as both documentation of those studies and a library of worked examples, so readers can inspect exactly how an intervention or design was operationalized.

## Standardized measures and reusable assets

Deliberation Lab includes a **standard library of surveys** and assets (e.g., personality scales, polarization measures, discussion-quality measures):

- Standard instruments are presented in a **consistent format** across studies.
- Scoring logic is shared and reused, so the same scale is computed identically in different experiments.
- This helps ensure that results using the same instrument are **directly comparable** across Deliberation Lab studies.

All canned assets are **versioned**, so a paper can specify exactly which version of a survey or instrument was used.

## Recruitment, assignment, and “pre-registration” of samples

Participants reach the platform via **study links**, and all participants in a study complete a consisten set of intro measures. Then, a **randomization / assignment engine** places them into groups and treatments according to the study’s rules (e.g., matching on party ID, topic positions, or other attributes).

- At the point of assignment, Deliberation Lab **creates a unique sample ID** and records:
  - The participant’s assignment (treatment, role, group).
  - The configuration and manifest in effect at that time.
  - Relevant pre-treatment metadata (e.g., recruitment source, presurvey attributes, depending on the study).
- This acts as a **per-sample pre-registration**: the platform records all samples that enter the experiment, including those that later drop out.
- Assignment decisions and the set of eligible participants at each decision point are logged. This makes it possible to:
  - Reconstruct the assignment process.
  - Simulate alternative assignment seeds.
  - Compute **inverse probability weights** if assignment is not purely simple randomization.

For reviewers, this also means that **file-drawer size is observable** at the level of individual participants: you can see which samples were assigned and what conditions they were assigned to, even if some did not complete all stages.

## Data exports, provenance, and reproducibility

Deliberation Lab emphasizes **end-to-end data provenance** from collection to analysis.

### Science data export

- The main export is a **JSON Lines (“JSONL”) file with one row per participant**.
- Each row includes:
  - Identifiers (pseudonymous IDs suitable for analysis).
  - A **snapshot of the configuration and manifest** as seen by that participant.
  - Timings (e.g., when each stage began and ended).
  - Intro/setup logs (consent, device checks, QC).
  - All prompt and survey responses (including external survey IDs/responses where applicable).
  - Behavioral logs (chat messages, speaking events where tracked, reports/check-ins).
  - Recording metadata (e.g., video track IDs, where applicable).
- Every row contains **enough information to reconstruct** what that participant saw and when they saw it.

### Versioned storage and auditability

- Exports are typically pushed directly from the platform to a **version-controlled GitHub repository** (or equivalent).
- The same repository can include:
  - The manifest and assets used to run the experiment.
  - Analysis code and notebooks.
  - The evolving exported data (with a clear history of changes).
- This allows an auditor to:
  - Trace data from the moment it was collected.
  - Verify that no rows were silently added or removed.
  - Confirm that transformations from raw export to analysis dataset are transparent and documented.

### Platform versioning and environment

- The platform itself is packaged so that the **exact version of Deliberation Lab used** to collect data is recorded with the export.
- Versions are tied to specific Docker images / code versions, which allows researchers (and, in principle, auditors) to **re-run the platform with the same code** that was used during data collection.

## Platform guardrails and consistency

To reduce implementation errors and silent failures, Deliberation Lab includes several guardrails:

- **Configuration validation**: Batch configs, treatment manifests, and prompt files are schema-checked before launch. Invalid configurations fail fast rather than producing partial or inconsistent runs.
- **Standard intro/exit flows**: Consent, device checks, and QC screens use shared components, providing a consistent baseline across studies.
- **Timing and visibility enforcement**: Stage timers and conditional logic are enforced automatically, so participants only see content they are supposed to see, at the right time and in the right role.
- **Error logging**: Integration with an external error-tracking service (i.e., Sentry) captures client and server errors, making it possible to diagnose issues that might affect data quality.
- **End-to-end tests**: Automated tests exercise common and edge-case flows and act as executable specifications of expected behavior.

## Handling dropouts and attrition

As with any online study, some participants **attrit** (disconnect, leave early, or fail checks). Deliberation Lab:

- Logs **all data up to the point of attrition** for each participant.
- Records explicit **exit statuses** and timestamps.
- Includes these partial cases in the science export so that:
  - Researchers can examine attrition patterns by condition or pre-treatment covariates.
  - Reviewers can see whether attrition is differential across treatments.

The platform cannot prevent attrition, but it makes attrition **visible and analyzable**.

## Scope and limitations

Deliberation Lab has limits that readers and reviewers should keep in mind:

- **Self-selection**: Participants who participate in a study using a video call may be systematically different from participants on the same recruitment platform who are unwilling or unable to do so. While advance signups and measures of pre-treatment covariates may help to mitigate this problem, it cannot be completely eliminated.
- **Network and device quality**: Audio/video quality depends on participant hardware and connections. Prior to randomization, the platform screens out participants whose hardware is likely to cause them to attrit during the video call, and logs basic device/network info and recording metadata. However, it cannot “fix” poor connections.
- **Study content**: The platform enforces the structure and timing of the experiment, but **does not evaluate the fairness or bias** of prompts, stimuli, or interventions. Reviewers should inspect the treatment files and survey content where these are shared.
- **Researcher responsibility**: Deliberation Lab provides extensive validation and logging, and makes it much easier to document, verify, and reproduce each experiment. However, it is up to the researcher to make these materials public.

This overview is meant to orient your review. For technical details on assignment algorithms, video handling, survey/Qualtrics integration, exports, and more, follow the cross-references in the main documentation:  
https://deliberation-lab.readthedocs.io/en/latest/
