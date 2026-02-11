# Video Call Module (Daily + Empirica)

This directory contains the client code that renders and manages the participant video call. It wraps Daily.co primitives, synchronizes with Empirica game/stage state, and provides layout helpers.

## Entry points

- `VideoCall.jsx` — Main container used by stages with `discussion.chatType: "video"`. Responsibilities:
  - Joins/leaves the Daily room from `game.get("dailyUrl")`.
  - Mirrors Empirica player name/title into Daily display names.
  - Tracks and stores Daily session IDs on the player for later matching (`dailyId`, `dailyIds`).
  - Emits `callStarted` to the stage to trigger server-side recording.
  - Aligns devices (camera, mic, speaker) with user preferences from setup.
  - Handles device errors, stage advancement hooks, and renders `Call` + `Tray` UI.
  - Enables centralized event logging via `useDailyEventLogger`.
- `Call.jsx` — Presents the video grid and participant tiles using layout helpers. Consumes Daily state and layout definitions to place feeds.
- `Tray.jsx` — Bottom control bar for toggling mic/camera/screen share, call leave, etc.

## UI building blocks

- `Tile.jsx` — Single participant video tile wrapper (video element, name/title badges, state indicators).
- `Icons.jsx` — SVG/icon components shared across call UI.
- `UserMediaError.jsx` — Inline error display for device/permission failures.
- `FixAV.jsx` — A/V issue reporting modal with diagnostic data collection.

## Hooks

- `hooks/eventLogger.js` — Centralized logging of Daily events into Empirica stage data:
  - `useDailyEventLogger` logs audio/video mute/unmute, join/leave, network metrics.
  - `useStageEventLogger` logs stage-level events with stage-relative timestamps.
  - Both prefer stage timer timecodes to keep analytics aligned with stage duration.
- `useAutoDiagnostics.js` — Auto-responds to A/V diagnostic requests from roommates.
- `useAudioContextMonitor.js` — Monitors AudioContext state for autoplay debugging.

## Layouts

- `layouts/computePixelsForLayout.js` (+ test) — Given a grid definition and feed list, computes pixel positions/sizes for tiles.
- `layouts/defaultResponsiveLayout.js` (+ test) — Default layout generator that adapts grid and feed arrangement to viewport size and participant count.

## How components fit together

1. `VideoCall` mounts, joins the Daily room, and signals `callStarted`.
2. Daily event logging is enabled via `useDailyEventLogger`.
3. Device alignment runs to match preferred devices from setup stage.
4. `Call` renders the grid using layout helpers and `Tile` for each participant feed.
5. `Tray` provides local controls; interactions are reflected in Daily state and logged.
6. Device or join errors surface through `UserMediaError`.

Use `VideoCall` at the stage level; other components are internal wiring for the video experience. Tests for layout math live alongside the helpers in `layouts/`.

---

## Device Management

### The Safari Device ID Rotation Problem

Safari rotates device IDs for privacy (to prevent fingerprinting). When a user:
1. Selects a device during setup (ID stored in player data)
2. Refreshes the page or browser restarts
3. The stored device ID no longer matches any available device

This can leave users with **no active device** if not handled properly.

### Device Alignment Strategy

When joining a call, `VideoCall.jsx` aligns devices using a **3-tier fallback strategy** implemented in the `utils/deviceAlignment.js` utility:

```
1. ID Match    → Try to find device with exact deviceId match (Chrome/Firefox)
2. Label Match → Try to find device with matching human-readable label (Safari workaround)
3. Fallback    → Use first available device of that type (device missing/unplugged)
```

This is implemented for all three device types:
- **Camera** (video input)
- **Microphone** (audio input)
- **Speaker** (audio output)

**Label matching limitations:** Label matching uses exact string comparison and works best within the same browser session. Different browsers or OS versions may format device labels differently (e.g., `"FaceTime HD Camera (Built-in)"` vs `"FaceTime HD Camera (3A71:F4B5)"`), which would prevent a match. This is acceptable since the primary use case is Safari ID rotation within a session, where label format remains stable.

**Monitoring:** Device alignment events are logged to Sentry. Successful ID/label matches add breadcrumbs for context. Fallback cases (device not found) capture warning messages with full diagnostic data. See "Monitoring and Analytics" section below for details.

### Player Data for Devices

During setup, we store both ID and label for each device:

| Player Key | Description |
|------------|-------------|
| `cameraId` | Preferred camera device ID |
| `cameraLabel` | Preferred camera label (e.g., "FaceTime HD Camera") |
| `micId` | Preferred microphone device ID |
| `micLabel` | Preferred microphone label (e.g., "MacBook Pro Microphone") |
| `speakerId` | Preferred speaker device ID |
| `speakerLabel` | Preferred speaker label (e.g., "MacBook Pro Speakers") |

### Error Handling

If `setInputDevicesAsync` fails when trying to set a device:
1. Log the error
2. If we weren't already using fallback, retry with first available device
3. If fallback also fails, log error (user may have no devices)

---

## Edge Cases and Known Limitations

### ✅ Handled Cases

| Case | How We Handle It |
|------|------------------|
| Safari rotates device IDs | Label matching as fallback |
| Preferred device unavailable | Fall back to first available |
| `setInputDevicesAsync` throws | Retry with fallback device |
| User revokes permission mid-call | Permission monitoring logs to breadcrumbs |
| AudioContext suspended (autoplay) | `useAudioContextMonitor` detects and prompts user |
| Device error on join | `UserMediaError` component displays helpful message |

### ⚠️ Partially Handled / Edge Cases

| Case | Current Behavior | Notes |
|------|------------------|-------|
| All devices unplugged after setup | No devices to fall back to | Rare; user must reconnect hardware |
| Setup not completed (`preferredId === "waiting"`) | Alignment doesn't run | Relies on Daily's defaults |
| Device errors during fallback | Logged but no recovery | User may need to refresh |
| Multiple devices with same label | First match wins | Could pick wrong device |
| Label format varies across browsers | Exact match may fail | Label matching works best within same browser; different browsers may format labels differently (e.g., "Camera (Built-in)" vs "Camera (USB-ID)") |

### ❌ Not Currently Handled

| Case | Why | Potential Solution |
|------|-----|-------------------|
| Bluetooth device disconnects mid-call | No real-time device monitoring | Could add device change listener |
| User plugs in new preferred device mid-call | Would need to re-run alignment | Could watch for device list changes |

---

## A/V Diagnostics

### Diagnostic Data Collection (`FixAV.jsx`)

When a user reports an A/V issue, we collect:

| Category | Data Collected |
|----------|---------------|
| **Participants** | All participants with audio/video state, subscription status |
| **Device Alignment** | Preferred vs current device IDs and labels, match status |
| **Audio Devices** | Current mic, camera, speaker count and labels |
| **Network Stats** | RTT, packet loss, jitter, bitrates |
| **AudioContext** | State (running/suspended/closed) |
| **Browser Permissions** | Camera and microphone permission states |
| **Local Media** | Track enabled/muted/readyState |
| **Meeting State** | Daily meeting state |

### Cross-Participant Diagnostics

When user A reports an issue:
1. A's diagnostic data is sent to Sentry with unique `avIssueId`
2. Request is sent to roommates via player data
3. Roommates auto-respond with their diagnostic data (same `avIssueId`)
4. All reports can be correlated in Sentry by `avIssueId` tag

This helps diagnose issues like "others can't hear me" by seeing what the roommate's perspective is.

---

## Refactoring Notes

When refactoring this code, ensure these behaviors are preserved:

1. **Device alignment must run after devices list is populated** — Check `camerasLoaded`, `microphonesLoaded`, `speakersLoaded` before calling align functions.

2. **Alignment should be idempotent** — Skip if already using the target device to prevent infinite loops.

3. **Labels are the key Safari workaround** — Don't remove label storage/matching; it's the primary defense against Safari's ID rotation. Both `deviceId` and `deviceLabel` must be stored during setup and passed to `findMatchingDevice()`.

4. **Use the device alignment utility** — Always use `findMatchingDevice()` from `utils/deviceAlignment.js` rather than reimplementing the matching logic inline. The utility is tested and handles all edge cases.

5. **Preserve Sentry logging** — Device alignment events must be logged to Sentry:
   - Add breadcrumb for all alignments (context for future reports)
   - Capture warning message when `matchType === 'fallback'` (indicates preferred device not found)
   - Include full diagnostic data: preferred device, actual device, all available devices

6. **Error handling must include fallback retry** — A failed `setInputDevicesAsync` should try the fallback device, not leave user with nothing.

7. **Diagnostic data is used for debugging** — Keep comprehensive data collection in `collectAVDiagnostics()` to aid Sentry analysis.

8. **Cross-participant diagnostics require `avIssueId`** — This tag correlates reports from different participants for the same incident.

9. **Permission monitoring is for breadcrumbs** — Even if we can't recover from revoked permissions, logging the change helps diagnose issues in Sentry.

10. **AGC is currently disabled** — See `setInputDevicesAsync` after join; this is a test to diagnose quiet audio issues.

---

## Testing

### Existing Tests

Run tests with `npm test` from the client directory.

| Test File | What It Tests |
|-----------|---------------|
| `utils/deviceAlignment.test.js` | Device matching logic (ID → label → fallback) |
| `utils/audioLevelUtils.test.js` | Audio level transformation for visualization |
| `layouts/computePixelsForLayout.test.js` | Grid layout pixel calculations |
| `layouts/defaultResponsiveLayout.test.js` | Responsive grid generation |

### Device Alignment Tests

The `deviceAlignment.test.js` file covers:

- **ID matching**: Exact deviceId match (primary strategy)
- **Label matching**: Safari ID rotation workaround
- **Fallback behavior**: First available device when nothing matches
- **Edge cases**: Empty arrays, null values, duplicate labels, missing fields

### Device Alignment Implementation

The device alignment logic uses the `findMatchingDevice()` utility from `utils/deviceAlignment.js`:

```javascript
import { findMatchingDevice } from './utils/deviceAlignment';

// In VideoCall.jsx align functions:
const result = findMatchingDevice(
  devices?.microphones,
  preferredMicId,
  preferredMicLabel
);
if (!result) return;

const { device: targetMic, matchType } = result;
// matchType is one of: 'id' | 'label' | 'fallback'
```

**Benefits of this approach:**
1. Single source of truth for device matching logic (no duplication)
2. Comprehensive test coverage (21 tests)
3. Clear separation of concerns (React lifecycle vs device matching)
4. Easy to maintain and extend

---

## Monitoring and Analytics

### Sentry Integration

Device alignment events are logged to Sentry to track Safari ID rotation issues and device availability problems:

#### For Successful Matches (ID or Label)
- **Breadcrumb added** with `info` level
- Provides context when users later report issues
- Includes: device type, match type, preferred/actual device IDs and labels

#### For Fallback (Device Not Found)
- **Warning message captured** to Sentry
- Indicates user's preferred device was not available
- Includes full diagnostic data:
  - Preferred device (ID + label)
  - Fallback device used (ID + label)
  - All available devices for comparison

**Example Sentry output when fallback occurs:**
```
⚠️ Preferred microphone not found, using fallback

Tags:
  deviceType: microphone
  matchType: fallback

Extra:
  preferred: { id: "abc123", label: "Blue Yeti USB Microphone" }
  fallback: { id: "xyz789", label: "MacBook Pro Microphone" }
  availableDevices: [
    { id: "xyz789", label: "MacBook Pro Microphone" },
    { id: "def456", label: "AirPods Pro" }
  ]
```

**Use cases for this data:**
- Track how often Safari users hit label fallback (indicates ID rotation)
- Identify which device types have more matching issues
- Diagnose why users end up with wrong devices
- Correlate device issues with browser/OS versions

**Why we log this way:**
- ID/label matches are **successes** (working as designed) → breadcrumbs only
- Fallback means user **lost their preferred device** → alert to Sentry
- Full device list helps understand what alternatives were available
