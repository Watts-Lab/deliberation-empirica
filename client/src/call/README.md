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

## Session ID Tracking (dailyIdHistory)

### The Problem: Duplicate Entries at Stage Transitions

When video stages transitioned, `player.get("dailyIdHistory")` was logging duplicate entries:
- One entry with NEW `progressLabel` + OLD `dailyId` (stale) at `stageElapsed: 0`
- One entry with NEW `progressLabel` + NEW `dailyId` (correct) ~0.5 seconds later

**Expected behavior:** Each stage should have exactly ONE entry with the correct dailyId-progressLabel pairing.

**Why this matters:** The dailyIdHistory is used for science data analytics to associate video recordings with specific stages and track participant session continuity. Spurious entries with stale dailyIds corrupt this association.

### Root Cause: Persistent callObject + Async Join

The issue stemmed from a race condition during stage transitions:

1. **Architecture detail:** `callObject` is created at app level and persists across component mounts
2. **VideoCall lifecycle:** Component unmounts/remounts between video stages (especially when non-video stages are in between)
3. **The race:**
   - VideoCall remounts → `progressLabel` updates immediately (synchronous)
   - `useLocalSessionId()` returns **stale session ID** from persistent callObject
   - Effect fires with NEW progressLabel + OLD dailyId → **spurious entry created**
   - ~0.5s later, `callObject.join()` completes → Daily assigns new session ID
   - Effect fires again with NEW progressLabel + NEW dailyId → **correct entry created**

**Initial fix attempts that didn't work:**
- ❌ Checking `meetingState === "joined-meeting"` in dependencies → didn't re-run when state changed
- ❌ Moving check after `player.set("dailyId")` → still fired on progressLabel changes
- ❌ Including `getElapsedTime` in dependencies → caused excessive re-renders (stageTimer updates frequently)

### Solution: Event-Driven Logging

**Implementation:** Two separate useEffects with different responsibilities:

**Effect 1 - Immediate dailyId tracking** (lines 94-107):
```javascript
useEffect(() => {
  if (!dailyId) return;
  if (player.get("dailyId") !== dailyId) {
    player.set("dailyId", dailyId);      // for video feed matching
    player.append("dailyIds", dailyId);   // for UI display by position
  }
}, [dailyId, player]);
```
- Runs immediately when dailyId changes
- Needed for video feed matching (can't wait for join event)
- No history logging (avoids race condition)

**Effect 2 - Event-driven history logging** (lines 110-161):
```javascript
useEffect(() => {
  if (!callObject || callObject.isDestroyed?.()) return undefined;

  const logDailyIdHistory = () => {
    const currentDailyId = dailyId;
    const currentProgressLabel = progressLabel;
    if (!currentDailyId) return;

    // Deduplication check
    const history = player.get("dailyIdHistory") || [];
    const lastEntry = history[history.length - 1];
    if (lastEntry?.dailyId === currentDailyId &&
        lastEntry?.progressLabel === currentProgressLabel) {
      return; // Already logged
    }

    player.append("dailyIdHistory", {
      dailyId: currentDailyId,
      progressLabel: currentProgressLabel,
      stageElapsed: getElapsedTime(),
      timestamp: new Date().toISOString(),
    });
  };

  // Listen for future joins
  callObject.on("joined-meeting", logDailyIdHistory);

  // Handle race condition: already joined when listener set up
  const currentState = callObject.meetingState?.();
  if (currentState === "joined-meeting") {
    logDailyIdHistory();
  }

  return () => { callObject.off("joined-meeting", logDailyIdHistory); };
}, [callObject, dailyId, player]);
// Note: progressLabel and getElapsedTime intentionally NOT in dependencies
```

**Key design decisions:**

1. **Dependencies:** Only `[callObject, dailyId, player]`
   - `progressLabel` excluded → prevents logging on progressLabel changes within same session. Current value accessed via `progressLabelRef` when event fires.
   - `getElapsedTime` excluded → stable function from ProgressLabelContext (never recreated) that always returns current elapsed time via internal refs

2. **Race condition handling:** Immediate state check when setting up listener
   - If already joined when effect runs, log immediately
   - Otherwise, wait for "joined-meeting" event

3. **Deduplication:** Check last entry to prevent duplicate logs
   - Handles reconnections within same stage (different dailyId = not duplicate)
   - Handles effect re-runs from dependency changes (same dailyId+progressLabel = duplicate)

### Why This Approach

**Alternatives considered:**

1. ❌ **Single effect with meetingState dependency** → Creates circular re-renders
2. ❌ **Delay-based approach** → Fragile timing assumptions, doesn't guarantee correctness
3. ✅ **Event-driven with race condition handling** → Guarantees logging happens exactly when joining

**Benefits:**
- One entry per session (no spurious entries with stale IDs)
- Captures reconnections within same stage (multiple dailyIds if needed)
- No performance issues (effect only re-runs when callObject or dailyId change)
- Resilient to timing variations (event-driven, not delay-based)

### Architecture Notes

**Same room URL, different sessions:**
- All video stages in a game use the **same `dailyUrl`** (same Daily room)
- This associates all recordings together for the game
- VideoCall leaves and rejoins between stages (component unmount/remount)
- Each rejoin creates a **new session ID** (new `dailyId`)
- Each stage has a unique `progressLabel`

**Data structure:**
```javascript
player.get("dailyIdHistory") = [
  {
    dailyId: "4cc12974",
    progressLabel: "game_1_practice_round",
    stageElapsed: 0.000,
    timestamp: "2026-02-11T20:36:33.249Z"
  },
  {
    dailyId: "00818688",
    progressLabel: "game_4_storytelling_1",
    stageElapsed: 0.515,
    timestamp: "2026-02-11T20:40:18.948Z"
  }
]
```

### Refactoring Considerations

When refactoring this code, preserve these behaviors:

1. **Separation of concerns** - Keep immediate dailyId setting separate from history logging
2. **Event-driven logging** - Use "joined-meeting" event, not dependency-based triggers
3. **Race condition handling** - Always check current state when setting up listener
4. **Minimal dependencies** - Don't include progressLabel or getElapsedTime in effect dependencies
5. **Deduplication** - Check last entry to prevent duplicate logs
6. **Error handling** - Wrap `player.append()` in try-catch

**Performance fix (Feb 2026):** The initial implementation included `getElapsedTime` in dependencies, causing the effect to re-run constantly (every time stageTimer updated). Removing it from dependencies while still capturing it from closure when called eliminated log spam and excessive re-renders.

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

## A/V Recovery System

### The Problem with Immediate Page Reload

Previously, the "Fix A/V" button immediately reloaded the page after collecting diagnostics. This approach has several problems:

1. **Safari device ID rotation** - Page reload causes Safari to rotate device IDs, potentially losing the user's preferred device and falling back to a different (possibly wrong) device.

2. **Disruptive UX** - Full page reload interrupts the user's experience and reconnects the entire call, even when the issue might be fixable with a simple operation.

3. **No soft fix attempt** - We don't try any in-place recovery before resorting to reload.

4. **May not fix the issue** - The reload might not address the actual root cause.

### Solution: Intelligent Diagnosis and Targeted Fixes

The `utils/avRecovery.js` module implements a diagnosis → targeted fix → escalation approach:

```
1. User reports issue(s)
2. Collect diagnostic data
3. Diagnose likely root cause(s) based on reported issues
4. Attempt targeted soft fixes (e.g., resume AudioContext, re-acquire device)
5. Wait briefly, re-collect diagnostics to validate
6. Show result:
   - ✅ "Issue resolved" → Auto-close modal
   - ⚠️ "Couldn't fix automatically" → Offer escalation options
   - ℹ️ "Issue is on other participant's side" → Inform user
7. Escalation path: Rejoin Call → Reload Page (last resort)
```

### Issue → Root Cause → Fix Mapping

#### "I can't hear others" (`cant-hear`)

| Root Cause | How to Detect | Soft Fix |
|------------|---------------|----------|
| AudioContext suspended | `audioContextState === 'suspended'` | `audioContext.resume()` |
| Speaker not set | `deviceAlignment.speaker.currentId === null` | Re-align speaker device |
| Remote participant muted | All remote `participants[].audio.off.byUser` | No fix - inform user |
| Network issues | High packet loss or RTT | No fix - show warning |

#### "Others can't hear me" (`others-cant-hear-me`)

| Root Cause | How to Detect | Soft Fix |
|------------|---------------|----------|
| Mic track ended | `localMediaState.audioTrack.readyState === 'ended'` | Re-acquire mic via `setInputDevicesAsync` |
| Mic muted | `localMediaState.audioTrack.enabled === false` | `callObject.setLocalAudio(true)` |
| No microphone active | `deviceAlignment.microphone.currentId === null` | Re-align mic device |
| Permission revoked | `browserPermissions.microphone === 'denied'` | No fix - inform user |

#### "I can't see others" (`cant-see`)

| Root Cause | How to Detect | Soft Fix |
|------------|---------------|----------|
| Remote participant camera off | All remote `participants[].video.off.byUser` | No fix - inform user |

#### "Others can't see me" (`others-cant-see-me`)

| Root Cause | How to Detect | Soft Fix |
|------------|---------------|----------|
| Camera track ended | `localMediaState.videoTrack.readyState === 'ended'` | Re-acquire camera |
| Camera muted | `localMediaState.videoTrack.enabled === false` | `callObject.setLocalVideo(true)` |
| No camera active | `deviceAlignment.camera.currentId === null` | Re-align camera device |
| Permission revoked | `browserPermissions.camera === 'denied'` | No fix - inform user |

### Escalation Options

When soft fixes don't work, users are offered escalation options:

1. **Rejoin Call** - Leaves and rejoins the Daily room without a full page reload. This preserves device IDs (avoiding Safari rotation) while reconnecting WebRTC.

2. **Reload Page** - Full page reload as a last resort. Logged to Sentry for analytics.

### Files Involved

| File | Purpose |
|------|---------|
| `utils/avRecovery.js` | Root cause definitions, diagnosis, soft fix logic |
| `utils/avRecovery.test.js` | Comprehensive tests for recovery system (37 tests) |
| `FixAV.jsx` | Multi-state modal UI, orchestrates recovery flow |
| `Tray.jsx` | Passes `resumeAudioContext` to FixAV hook |
| `VideoCall.jsx` | Provides `resumeAudioContext` from `useAudioContextMonitor` |

### Modal State Machine

The FixAV modal uses a state machine to manage the recovery flow:

```
                    ┌─────────────┐
                    │   select    │ (user picks issues)
                    └──────┬──────┘
                           │ user clicks "Diagnose & Fix"
                           ▼
                    ┌─────────────┐
                    │ diagnosing  │ (collecting data, attempting fixes)
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┬─────────────┐
           ▼               ▼               ▼             ▼
    ┌─────────────┐ ┌─────────────┐ ┌───────────┐ ┌───────────┐
    │   success   │ │   partial   │ │  failed   │ │ unfixable │
    │ (auto-close)│ │ (escalate)  │ │(escalate) │ │  (inform) │
    └─────────────┘ └─────────────┘ └───────────┘ └───────────┘
```

**State Definitions:**
- `select` - User is selecting which issues they're experiencing
- `diagnosing` - Collecting diagnostics, running diagnosis, attempting soft fixes
- `success` - All identified issues were fixed; modal auto-closes after 2 seconds
- `partial` - Some fixes worked, others didn't; offers escalation options
- `failed` - Soft fixes failed; offers Rejoin Call and Reload Page options
- `unfixable` - Issue is on other participant's side or requires manual browser action
- `unknown` - No specific cause could be identified; offers escalation options

### Critical Test Coverage

The `utils/avRecovery.test.js` file includes tests for:

| Category | What's Tested |
|----------|--------------|
| **ROOT_CAUSES** | All causes defined with required properties |
| **diagnoseIssues** | Priority sorting, issue filtering, detection logic |
| **attemptSoftFixes** | Each fix type, error handling, unfixable categorization |
| **validateFixes** | Resolved vs still-present detection |
| **generateRecoverySummary** | All status types (success/partial/failed/unfixable/unknown) |
| **Multi-issue scenarios** | Multiple causes, 'other' issue type, remote participant detection |
| **Device re-acquisition** | Mic, camera, speaker re-alignment via Daily APIs |
| **Network issues** | Packet loss and RTT threshold detection |
| **Permission denial** | Unfixable permission scenarios |

**Run tests with:** `npm test -- avRecovery` (from client directory)

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

11. **A/V recovery should attempt soft fixes before reload** — The `utils/avRecovery.js` module implements intelligent diagnosis and targeted fixes. Always try soft fixes (AudioContext resume, device re-acquisition) before offering page reload as an option.

12. **Rejoin Call preserves device IDs** — When escalating, prefer "Rejoin Call" (leave + join) over page reload to avoid Safari's device ID rotation. Only use reload as a last resort.

13. **Recovery results are logged to Sentry and player data** — Track which fixes were attempted and whether they succeeded for analytics and debugging. The `avReports` player data includes `diagnosedCauses`, `recoveryStatus`, `fixesAttempted`, and `fixesSucceeded`.

14. **Modal state machine must be preserved** — The FixAV modal uses these states: `select`, `diagnosing`, `success`, `partial`, `failed`, `unfixable`, `unknown`. Each state has specific UI and behavior. Success auto-closes after 2 seconds; others show escalation options.

15. **ROOT_CAUSES priority ordering matters** — Lower priority numbers are tried first. AudioContext resume (priority 1) should be attempted before device re-alignment (priority 2).

16. **Unfixable causes must be separated** — Causes like `remoteParticipantMuted` and `*PermissionDenied` cannot be fixed automatically. They must be categorized as unfixable and shown with appropriate messaging.

17. **Device re-acquisition uses findMatchingDevice** — When re-acquiring devices, always use the `findMatchingDevice` utility to respect Safari's device ID rotation by falling back to label matching.

18. **Validation requires before/after diagnostics** — After attempting fixes, re-collect diagnostics and compare to detect if the fix actually worked. Don't assume success based on API call completion.

19. **Escalation options order matters** — "Rejoin Call" should be offered first (preserves device IDs), "Reload Page" second (last resort). Both should be logged to Sentry.

20. **resumeAudioContext must be passed through component tree** — The function comes from `useAudioContextMonitor` in VideoCall.jsx, passes through Tray.jsx props, to the `useFixAV` hook parameter.

---

## Unified Setup Completion (User Gesture Requirements)

### The Problem: Browser Security Policies

Safari and some browsers require user gestures for certain audio/video operations to prevent unauthorized device access and fingerprinting. This creates a fragmented UX if we prompt separately for each operation.

**Operations requiring user gesture:**
- **Safari: Speaker device selection** (`setSinkId`) - Safari blocks programmatic audio output selection without a user gesture
- **All browsers: AudioContext resume** - Autoplay policies may suspend AudioContext until user interaction

### Solution: Unified Setup Completion Prompt

Instead of showing separate prompts for each gesture-requiring operation, we batch all pending operations into a single user-friendly prompt.

**Architecture:**

```javascript
// Track which operations failed due to missing gesture
const [pendingGestureOperations, setPendingGestureOperations] = useState({
  speaker: false,
  audioContext: false,
});

// Store operation details for retry
const [pendingOperationDetails, setPendingOperationDetails] = useState({
  speaker: null,  // { speakerId, speakerLabel }
  audioContext: null,
});
```

**Detection:** When any setup operation throws `NotAllowedError`:
1. Operation is marked as pending in state
2. Details are stored for retry
3. Event is logged to Sentry for analytics

**Unified Prompt UI:** Shows when any operations are pending:
```
┌────────────────────────────┐
│  Complete Audio Setup      │
│                            │
│  Click below to enable:    │
│   • Your selected          │
│     headphones (AirPods)   │
│   • Audio playback         │
│                            │
│  [ Complete Setup ]        │
└────────────────────────────┘
```

**Batch Retry:** Single button click executes all pending operations in parallel using the same user gesture.

### When User Gesture is Required

**Safari-specific:**
- Initial speaker device selection (first call join)

**When gesture is NOT required again:**
- ✅ Network reconnections - Daily maintains device selection
- ✅ WebRTC reconnections - Device settings persist
- ✅ Brief interruptions - Browser maintains state

**When gesture IS required again (rare):**
- ⚠️ User changes device mid-call - New `setOutputDevice()` needed
- ⚠️ Browser revokes permission - Security event

### Integration with Existing AudioContext Handling

The unified prompt **subsumes** the existing AudioContext banner when multiple operations need gestures:

- If AudioContext suspends ALONE → show existing simple banner
- If AudioContext + speaker both fail → show unified prompt
- Unified prompt takes precedence for better UX

### Monitoring

Sentry tracks:
- Which operations commonly require gestures
- Browser/OS distribution of gesture requirements
- Success rate after user clicks "Complete Setup"
- Time to completion

**Example Sentry event:**
```javascript
{
  message: "Setup operation requires user gesture",
  level: "info",
  tags: {
    operation: "speaker",
    browser: "Safari 17.2",
  },
  extra: {
    error: "NotAllowedError: A user gesture is required",
    details: { speakerId: "abc123", speakerLabel: "AirPods Pro" }
  }
}
```

### Files Involved

| File | Purpose |
|------|---------|
| `VideoCall.jsx` | State tracking, `handleSetupFailure`, `handleCompleteSetup`, unified prompt UI |
| `useAudioContextMonitor.js` | AudioContext state monitoring (existing) |

### Success Criteria

- ✅ Unified prompt appears when ANY setup operation requires gesture
- ✅ User clicks one button to enable all pending operations
- ✅ All devices correctly set after user gesture
- ✅ Prompt disappears after successful setup
- ✅ No console errors for setSinkId or other operations
- ✅ Sentry tracking shows operation frequency and success rates
- ✅ Works across Safari versions (desktop and mobile)
- ✅ Gracefully handles single vs multiple pending operations

---

## Testing

### Existing Tests

Run tests with `npm test` from the client directory.

| Test File | What It Tests |
|-----------|---------------|
| `utils/avRecovery.test.js` | A/V recovery diagnosis, soft fixes, validation (37 tests) |
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
