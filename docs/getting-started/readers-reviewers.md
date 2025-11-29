# Readers and Reviewers

This page is for readers and reviewers evaluating research run on Deliberation Lab.

## What Deliberation Lab does

- Runs live small-group discussions (video or text) with configurable stage flows, prompts, surveys, and timers.
- Provides built-in consent, ID capture, device checks, and quality controls (connection monitoring, attention/QC surveys).
- Supports external surveys (Qualtrics) and shared collaboration tools (Etherpad) when configured.
- Captures rich behavioral logs (chat actions, speaking events, check-ins/reports) alongside survey/prompt responses.

## Platform guardrails and consistency

- **Validated configuration**: Batch configs and treatment manifests are validated before launch (schema checks for treatments, prompts, batch settings, external repos/keys). Misconfigurations fail fast.
- **Asset fetch and template resolution**: Treatment files, prompts, and templates are resolved from a CDN with substitution and shape checks to avoid missing/partial content at runtime.
- **Standard intro/exit flows**: Consent, device checks, and QC surveys follow consistent screens and logging. Timings for intro/exit steps are recorded.
- **Discussion controls**: Video calls use Daily.co rooms with managed recording start/stop; text chat logs every action. Optional subroom layouts and reaction controls are defined in treatments and enforced client-side.
- **Timing and visibility**: Stage timers and conditional renderers gate when/what participants see (by time, position, or conditions), ensuring aligned experiences within groups.
- **Error handling**: Disconnects and dropouts are tracked; incomplete participants are closed out with explicit exit statuses when batches end.

## Data exports and reproducibility

- **Science data export**: Every participant produces one JSONL row with identifiers, config snapshot, timings, consent/setup logs, prompts/surveys/Qualtrics responses, chat/speaker events, reports/check-ins, and recording metadata. Exports occur on completion and batch close.
- **Config snapshot**: The exact validated batch config and treatment/intro content used for the run are embedded per participant, enabling reconstruction of what was shown.
- **Repo pushes**: Exports can be automatically pushed to configured GitHub repos (private/public) for versioned storage; missing pushes surface as errors.
- **Postflight reporting**: Batch-level summary (counts, timings, QC responses, connection stats) is generated at close.
- **Tajriba log**: The backend transaction log (`tajriba.json`) records every state change, and logs are preserved, enabling deep auditing when needed.

## Limitations and scope

- Video/audio quality depends on participant devices and connectivity; the platform records connection info and check results but cannot guarantee hardware quality.

## Trust signals for reviewers

- Deterministic validation of treatments/prompts/batch configs before launch.
- Versioned assets loaded from CDN with permalinks; prompt files include metadata and are validated for structure.
- Comprehensive exports with explicit `missing` placeholders when data is absent (e.g., absent Qualtrics API access).
- End-to-end tests (Cypress) exercise typical and edge-case flows; these serve as executable specifications of expected behavior.

For detailed researcher documentation, see the full docs site: https://deliberation-lab.readthedocs.io/en/latest/.
