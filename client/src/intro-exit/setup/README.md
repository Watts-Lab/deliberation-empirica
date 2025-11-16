# Intro Setup Components

This folder contains the building blocks for the onboarding flow. The steps are
organized into two high-level intro stages that run sequentially in
`App.jsx`:

1. `VideoEquipmentCheck` – handles browser permissions and camera readiness.
2. `AudioEquipmentCheck` – walks participants through headphones, microphone,
   and loopback/feedback tests.

Each stage is a thin orchestrator that renders child components for its
specialized checks:

- `GetPermissions` → prompts for camera/mic permissions.
- `CameraCheck` + supporting modules (`CameraAttestations`, `ConnectionsChecks`)
  → verifies the selected webcam, network connectivity, and Daily call quality.
- `HeadphonesCheck`, `MicCheck`, `LoopbackCheck` → cover the audio-side
  experience (headphones selection, microphone level test, speaker-to-mic
  feedback detection).

We log success/failure at the high-level stage (video/audio) so upstream logic
can see when the participant completed that section. Each child component also
records detailed events (e.g., device choices, threshold passes) for debugging.

If you add a new check, decide whether it belongs in the video or audio stage,
import it into the appropriate `*EquipmentCheck` component, and update the list
in this README.
