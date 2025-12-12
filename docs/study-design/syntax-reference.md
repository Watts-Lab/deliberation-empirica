# Deliberation Lab Syntax Reference

This page is intended as a concise, precise description of the syntax used in designing Deliberation Lab studies. It can be given to an AI coding agent to support implementation of treatment designs that are compatible with DL requirements. It also forms a short cheat-sheet for humans, with the bulk of the description in other parts of the documentation.

## 1) Top-Level Treatment File Shape

- Root object fields:
  - `templates` (optional): array of template definitions (see §3).
  - `introSequences` (required): array of intro sequence objects (see §8).
  - `treatments` (required): array of treatment objects (see §9).

Everything is validated after templates are expanded; unfilled `${field}` placeholders or `template` blocks are errors.

## 2) Common Primitives and Placeholders

- **Names**: 1–64 chars; letters, numbers, spaces, `_`, `-`; may include `${field}` placeholders. Regex: `^(?:[a-zA-Z0-9 _-]|\$\{[a-zA-Z0-9_]+\})+$`.
- **Descriptions**: freeform strings.
- **Files/URLs**: `file` is a string path (no existence check in schema). `url` must be a valid URL.
- **Durations/Times**: `duration` positive int seconds; `displayTime` nonnegative int seconds; `hideTime` positive int seconds.
- **Positions**: zero-based nonnegative integers unless otherwise noted.
- **Visibility**: `showToPositions` / `hideFromPositions` are nonempty int arrays; used to gate rendering per position.
- **Field placeholders**: Strings like `${key}` may appear anywhere; replaced during template expansion with provided `fields`/`broadcast` values.

## 3) Templates and Template Contexts

- **Template definition** (`templates[]`):
  - `templateName`: required name.
  - `contentType`: optional but recommended enum; one of `introSequence`, `introSequences`, `elements`, `element`, `stage`, `stages`, `treatment`, `treatments`, `reference`, `condition`, `player`, `introExitStep`, `exitSteps`, `other` (validated except `other` which always errors for safety).
  - `templateDesc`: optional string.
  - `templateContent`: payload matching the `contentType` schema (see sections below).
- **Template context** (can appear anywhere a value is allowed):
  ```yaml
  template: <templateName>
  fields: { key: value, ... } # optional; substitutes ${key}
  broadcast: { d0: [...], d1: [...] } # optional cartesian broadcast
  ```
  - `fields`: key/value map; values can themselves contain templates/placeholders.
  - `broadcast`: axes named `d0`, `d1`, … each is either an array of field maps, another template context, or a single placeholder key. Expansion flattens the cartesian product, injecting `d#` indices as strings.
  - Expansion rules (see `fillTemplates`):
    1. Recursively expand nested templates in `fields`/`broadcast`.
    2. Substitute `${key}` (string and object contexts).
    3. Apply broadcast cartesian product; each combination produces a copy of `templateContent`.
    4. Repeat until no `template` blocks remain; error if any `${...}` remain.

## 4) References (used by displays/conditions)

Reference string forms (split on `.`):

- `survey.<name>.<path...>` (path required)
- `submitButton.<name>.<path...>` (path required)
- `qualtrics.<name>.<path...>` (path required)
- `discussion.<name>` (name required)
- `participantInfo.<name>` (name required)
- `prompt.<name>` (name required)
- `urlParams.<path...>` (path required)
- `connectionInfo.<path...>` (path required)
- `browserInfo.<path...>` (path required)

Invalid types or missing name/path emit validation errors.

## 5) Conditions

- Shape: `{ reference, comparator, value?, position? }`
- `position` (optional): `shared`, `player`, `all`, `any`, `percentAgreement`, or nonnegative int. (Use only where stage logic supports position-aware checks.)
- Comparators and value types:
  - `exists` / `doesNotExist`: no value.
  - `equals` / `doesNotEqual`: string | number | boolean | `${field}`.
  - `isAbove` / `isBelow` / `isAtLeast` / `isAtMost`: number | `${field}`.
  - `hasLengthAtLeast` / `hasLengthAtMost`: nonnegative int | `${field}`.
  - `includes` / `doesNotInclude`: string | `${field}`.
  - `matches` / `doesNotMatch`: string (treated as regex) | `${field}`. Regex validity not enforced beyond string type.
  - `isOneOf` / `isNotOneOf`: nonempty array of string/number | `${field}`.
- Conditions arrays must be nonempty when provided.

## 6) Players (group composition entries)

- Fields: `desc?`, `position` (int), `title?` (max 25 chars), `conditions?` (array).
- In treatments, positions must be unique, contiguous 0..playerCount-1.

## 7) Elements (the building blocks of stages)

**Base fields (all element types)**:

- `type`: discriminator (see below).
- `name?`, `desc?`, `file?`, `displayTime?`, `hideTime?`, `showToPositions?`, `hideFromPositions?`, `conditions?` (array), `tags?` (string array).

**Element types** (all strict objects):

- `audio`: `type: audio`, `file` required.
- `image`: `type: image`, `file` required.
- `display`: `type: display`, `reference` required (see §4), `position` selector (`shared` | `player` | `all` | `any` | int; default `player`).
- `prompt`: `type: prompt`, `file` required, `shared?` (true for shared prompt data; disallowed in intro/exit).
- `qualtrics`: `type: qualtrics`, `url` required (survey link), `params?` array of key/value maps. Runtime: env vars `QUALTRICS_API_TOKEN` and `QUALTRICS_DATACENTER` are required at validation time; Deliberation Lab appends `deliberationId` and `sampleId` to the URL automatically.
- `separator`: `type: separator`, `style?` enum `thin | thick | regular`.
- `sharedNotepad`: `type: sharedNotepad`.
- `submitButton`: `type: submitButton`, `buttonText?` (<=50 chars).
- `survey`: `type: survey`, `surveyName` required (must exist in `@watts-lab/surveys` at runtime).
- `talkMeter`: `type: talkMeter`.
- `timer`: `type: timer`, `startTime?`, `endTime?`, `warnTimeRemaining?` (all > 0). (Runtime expectation: start < end; warn < end-start.)
- `video`: `type: video`, `url` required.

**Prompt shorthand**: a bare string in an `elements` array is coerced to `{ type: "prompt", file: "<string>" }`.

**Position limits**: When used inside a treatment, any numeric position in `showToPositions`/`hideFromPositions` must be `< playerCount`.

## 8) Discussions and Video Layout

- `discussion` object (stage-level optional):
  - `chatType`: `text` | `audio` | `video`.
  - `showNickname` (bool), `showTitle` (bool), `showSelfView?` (bool, default true).
  - `reactionEmojisAvailable?` (string array), `reactToSelf?` (bool), `numReactionsPerMessage?` (nonnegative int) — **only allowed when `chatType` = `text`**.
  - `layout?`: video layout map keyed by seat index (stringified nonnegative int) → layout definition. **Only allowed when `chatType` = `video`.**
    - Layout definition: `grid` `{ rows: int>0, cols: int>0, options? { gap?, background? } }`; `feeds` nonempty array; `defaults?` feed defaults.
    - Feed: `source` (`participant` with `position`, `self`, or custom `{ type: <string not participant/self>, position? }`), `media? { audio?, video?, screen? }`, `displayRegion { rows: int or {first,last}, cols: int or {first,last} }` within grid bounds, `zOrder?`, `render?` (`auto|tile|audioOnlyBadge|hidden|<string>`), `label?`, `options?` (record).
  - `rooms?` (video only): nonempty array of `{ includePositions: nonempty int[] }`. After applying discussion-level `showToPositions`/`hideFromPositions`, every visible position must appear in exactly one `includePositions`.
  - `showToPositions?` / `hideFromPositions?`: optional discussion-level visibility filters (respect `playerCount`).

## 9) Stages

- Stage object:
  - `name` (required), `desc?`
  - `discussion?` (see §8)
  - `duration` (positive int or `${field}`)
  - `elements` (nonempty array of elements)
- Validation:
  - Must have `elements`.
  - Per-treatment checks enforce position bounds for element visibility and discussion visibility/rooms.

## 10) Intro/Exit Steps and Intro Sequences

- **Intro/Exit step object**: `name`, `desc?`, `elements` (nonempty).
- **Constraints in intro/exit**:
  - `prompt.shared` not allowed.
  - `position`, `showToPositions`, `hideFromPositions` not allowed on elements.
- **Intro sequence**: `{ name, desc?, introSteps: [intro/exit steps] }`.
- `introSequences`: nonempty array of intro sequence objects.
- `exitSequence` (on treatment): array of exit steps (same shape as intro; `shared` still disallowed).

## 11) Treatments

- Fields:
  - `name` (required), `desc?`
  - `playerCount` (number; must cover all positions starting at 0)
  - `groupComposition?`: array of players (§6). If present, positions must be unique and exactly `0..playerCount-1`.
  - `gameStages`: nonempty array of stages (§9).
  - `exitSequence?`: array of exit steps (§10).
- Additional per-treatment checks:
  - Any numeric positions in elements’ `showToPositions`/`hideFromPositions` and discussions’ visibility lists must be `< playerCount`.
  - In `discussion.rooms`, after applying discussion-level visibility filters, every visible position must appear in one `includePositions`; no out-of-range indices.

## 12) Treatments Array

- `treatments`: nonempty array of treatment objects. Can include templates; all template contexts are expanded before validation.

## 13) Template Content Matching (for template authors)

- `templateContent` can be any of: introSequence, introSequences, elements, element, stage, stages, treatment, treatments, reference, condition, player, introExitStep, exitSteps. Best-match heuristic picks the schema with fewest unmatched keys if `contentType` omitted; errors reference the closest match.

## 14) Runtime Semantics and Interop Notes

- **Template expansion** happens before validation is applied to the final structures used at runtime (`getTreatments` + `fillTemplates`). Unresolved `${...}` cause errors.
- **Qualtrics elements** require `QUALTRICS_API_TOKEN` and `QUALTRICS_DATACENTER` env vars; validation will throw if missing. At runtime, Deliberation Lab appends `deliberationId` and `sampleId` as URL params; submitted Qualtrics responses are fetched (if API keys) and stored under `qualtrics_<step>` in science data.
- **Survey elements** rely on `@watts-lab/surveys`; ensure `surveyName` is valid there.
- **Discussion/video** layouts control Daily call composition; `rooms` split participants across subrooms; `layout` defines on-screen tiling for video stages.
- **Visibility/conditions** are evaluated in the client to gate rendering of prompts, displays, etc.; make sure referenced data exists in earlier steps or URL/browser/connection info.
- **Durations** drive timers and stage limits; `displayTime`/`hideTime` gate element visibility relative to stage elapsed.
- **Position semantics**: integers refer to treatment positions (0-based). `shared`/`all`/`any`/`player`/`percentAgreement` are special selectors understood by client logic for displays/conditions.

This reference mirrors the enforced schema; deviations will fail validation during batch initialization. Use it as a definitive contract for generating treatment manifests from natural-language specs.

## 15) Batch Config Validation (preFlight/validateBatchConfig.ts)

Separate from the treatment file, the batch config (admin UI / YAML) must satisfy:

- `batchName`: string.
- `cdn`: enum `test | prod | local`.
- `treatmentFile`: string ending in `.yaml`.
- `introSequence`: string or literal `"none"` (use `"none"` to skip intro).
- `treatments`: nonempty array of treatment names (strings).
- `payoffs`: nonempty array of positive numbers **matching `treatments` length**, or literal `"equal"`.
- `knockdowns`: one of
  - single number in (0,1];
  - nonempty array of numbers in (0,1] with length == `treatments.length`;
  - nonempty matrix of numbers in (0,1]; rows = `treatments.length`, each row length = `treatments.length`;
  - literal `"none"`.
- `exitCodes`: object `{ complete, error, lobbyTimeout, failedEquipmentCheck }` (strings) or literal `"none"`.
- `launchDate`: ISO-ish string that parses to a future Date, or literal `"immediate"`.
- `customIdInstructions`: either a `.md` string, `"none"`, or a nonempty map of URL-safe keys (alphanumeric/underscore/hyphen) to `.md` strings.
- `platformConsent`: enum `US | EU | UK | custom`.
- `consentAddendum`: `.md` string or `"none"`.
- `dispatchWait`: positive number (seconds).
- `videoStorage`: `{ bucket: string, region: <AWS region enum> }` or `"none"`.
- `preregRepos`: array of `{ owner, repo, branch, directory }` (can be empty to skip).
- `dataRepos`: array of `{ owner, repo, branch, directory }` (required; nonempty).
- `centralPrereg`: boolean.
- `checkAudio`: boolean.
- `checkVideo`: boolean (cannot be true while `checkAudio` is false).

Super-refine rules:

- If `payoffs !== "equal"`, payoffs length must equal `treatments` length.
- If `checkVideo` is true, `checkAudio` must also be true.
- `knockdowns` shapes must match `treatments` length (vector or matrix as described above).

If validation fails, an aggregated error message is thrown and batch creation fails.

## 16) Prompt/Markdown Validation (preFlight/validatePromptFile.ts + getTreatments.js)

Prompt files (referenced by `prompt` elements) are validated server-side when treatments are loaded:

- File structure: three sections separated by `---` lines: metadata YAML, prompt body, responses block.
- Metadata schema:
  - `name`: string; **must match the file path (from repo root)**.
  - `type`: enum `openResponse | multipleChoice | noResponse | listSorter | slider`.
  - `notes?`: string.
  - `rows?`: int >= 1 (only for `openResponse`; error otherwise).
  - `shuffleOptions?`: boolean (disallowed for `noResponse`).
  - `select?`: enum `single | multiple | undefined` (only for `multipleChoice`).
  - `minLength?` / `maxLength?`: ints (openResponse-only; minLength <= maxLength).
  - Slider-only: `min` (required), `max` (required), `interval` (required), `labelPts?` (array of numbers). Must satisfy `min < max` and `min + interval <= max`. `labelPts`, if present, must have the same length as the number of response items (checked separately in `validateSliderLabels`).
  - Non-slider elements must not specify `min`, `max`, `interval`, or `labelPts`.
- Prompt body: must be nonempty.
- Responses block:
  - Omitted only when `type === "noResponse"`.
  - Every response line must start with `- ` (multiple choice) or `> ` (open response) to be parsed.
- Empty file or invalid type/name/prompt/responses throws an error; batch load fails.

Additional runtime checks during treatment load (`getTreatments.js`):

- Prompt files are fetched from the configured CDN; fetch/parse failures are fatal.
- Qualtrics elements: require `QUALTRICS_API_TOKEN` and `QUALTRICS_DATACENTER` env vars; metadata fetch is attempted and failure is fatal.
- Time guards: `displayTime`, `hideTime`, `startTime`, and `endTime` must not exceed the parent stage `duration`; violations throw errors.
- Stage checks: every stage must have `name` and `duration`; treatments must have `gameStages`; a warning is logged (not fatal) if neither `exitSurveys` nor `exitSequence` is present.

Use these rules in addition to the treatment schema to ensure prompt assets and batch configs are valid before running studies.
