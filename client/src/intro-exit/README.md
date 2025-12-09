# Intro & Exit Flows

This folder contains the screens shown before and after the main game stages. They collect participant info, run equipment checks, gather consent, and perform wrap-up surveys.

## Orchestration

- `Intro.jsx` — Wrapper around intro sequence defined in the treatment (`introSteps`) that checks for resource availability before rendering.
- `Exit.jsx` — Wrapper around the exit sequence (`exitSequence`) after the game ends that checks for resource availability before rendering.
- `GenericIntroExitStep.jsx` — Common wrapper for intro/exit pages; composes `elements` with conditional rendering, tracks progress labels, and records `duration_<step>`.

## Participant identification & checks

- `IdForm.jsx` — Collects participant identifiers from URL params or user input; sets `participantData` and `batch` binding.
- `PreIdChecks.jsx` — Early eligibility/guard checks before ID capture. (Mostly to remind people that it's a videocall study, so they can return the task if they aren't ready for that.)
- `EnterNickname.jsx` — Captures participant nickname/title (used in discussions).
- `AttentionCheck.jsx` — Sentence typing attention check (or effort check) during intro.
- `Countdown.jsx` — Wait-room countdown before dispatch/lobby.
- `Lobby.jsx` — Displays lobby status while waiting for group assembly.
- `NoGames.jsx` — Fallback when no games are available.

## Consent and setup

- `Consent.jsx` — Presents consent text (including addenda), records `consent`, captures `connectionInfo` and `browserInfo`, and logs consent items.
- `setup/` — Equipment checks (see `setup/README.md`):
  - `VideoEquipmentCheck`, `AudioEquipmentCheck`, `GetPermissions`, `CameraCheck`, `HeadphonesCheck`, `MicCheck`, `LoopbackCheck`, etc.

## Post-game surveys

- `QualityControl.jsx` — Standard QC survey; stores `QCSurvey`.
- `Debrief.jsx` — Final debrief screen.

## Data logging

- Intro/exit steps record:
  - `progressLabel` and `duration_<step>` for timing.
  - `consent`, `setupSteps`, `attention checks`, `urlParams` (in `Consent`), and other per-step outputs.
- Exit steps record QC survey and any exit prompts/surveys defined in `exitSequence`.

Use these components to build/extend onboarding and debrief flows. Elements within intro/exit steps are configured in the treatment file (`introSteps`/`exitSequence`), and `GenericIntroExitStep` renders them with the same conditional/timing logic used in main stages.
