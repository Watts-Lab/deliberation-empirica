# Intro Setup Components

This folder holds the onboarding checks that run during intro steps to ensure participants have working audio/video before entering a discussion.

## Orchestrators

- `VideoEquipmentCheck.jsx` — top-level video setup stage; renders camera/network checks and logs completion/failure.
- `AudioEquipmentCheck.jsx` — top-level audio setup stage; renders headphone/mic/loopback checks and logs completion/failure.

## Permission and device checks

- `GetPermissions.jsx` — prompts for camera/mic permissions; records initial status in `setupSteps`.
- `CameraCheck.jsx` — verifies webcam selection and preview; coordinates with `CameraAttestations`.
- `CameraAttestations.jsx` — collects participant confirmations about camera visibility/position.
- `HeadphonesCheck.jsx` — guides participants to use headphones; records confirmation.
- `MicCheck.jsx` — microphone level test; appends results to `setupSteps`.
- `LoopbackCheck.jsx` — plays audio and listens for mic loopback to detect feedback/echo.
- `ConnectionsChecks.jsx` — runs network-related diagnostics and logs them.

## Error handling

- `FailureCode.jsx` — surfaces failure codes/messages when checks cannot proceed.

## Logging/recording behavior

- Each component appends structured entries to `player.setupSteps` with timestamps, event types, and debug info.
- The high-level `*EquipmentCheck` components mark pass/fail to gate progress through intro steps.

If you add a new diagnostic, decide whether it belongs in the video or audio flow, import it into the corresponding `*EquipmentCheck`, and ensure it appends to `setupSteps` for observability.
