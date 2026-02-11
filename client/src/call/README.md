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

### The Problem: Safari Speaker Selection Requires User Gesture

**Root cause:** Safari's security policy prevents programmatic audio output device selection (`setSinkId`) without a user gesture. This manifests as:

1. **User selects headphones during setup** - Preference is stored in `player.get("speakerId")` and `player.get("speakerLabel")`
2. **VideoCall joins the Daily room** - Component attempts to align devices with stored preferences
3. **`alignSpeaker()` calls `devices.setSpeaker(targetId)`** - This internally calls `setSinkId()` on the HTMLAudioElement
4. **Safari throws `NotAllowedError`** - "A user gesture is required"
5. **Audio plays through built-in speakers** - User's headphones preference is ignored
6. **Silent failure** - No visible error to the user, but they're not using their selected device

**Why this matters:**
- **Echo/feedback risk** - Built-in speakers can cause audio issues in group calls
- **User expectation violation** - They explicitly selected headphones but aren't using them
- **Silent failure** - Users may not realize their setup didn't work

**Broader issue:** Multiple setup operations may require user gestures (AudioContext resume, potentially future operations). Showing separate prompts for each creates a fragmented, confusing UX.

### Solution: Unified Setup Completion Prompt

**Core idea:** Detect when operations fail due to missing user gesture, batch them, and present a single "Enable Audio" prompt that retries all operations in one click.

Instead of:
```
[Prompt 1: "Resume AudioContext"]  → user clicks
[Prompt 2: "Enable speakers"]     → user clicks again
```

We show:
```
[Single prompt: "Enable Audio"]   → user clicks once, both operations complete
```

### Implementation Architecture

**State Management:**

Two pieces of state track pending operations:

```javascript
// Flags indicating which operations need user gesture
const [pendingGestureOperations, setPendingGestureOperations] = useState({
  speaker: false,      // Speaker device selection failed
  audioContext: false, // AudioContext resume failed
});

// Details needed to retry each operation
const [pendingOperationDetails, setPendingOperationDetails] = useState({
  speaker: null,      // { speakerId, speakerLabel }
  audioContext: null, // (no details needed, just call resume)
});
```

**Why separate state objects?** Flags and details have different lifecycles:
- **Flags** control UI visibility and flow logic
- **Details** store operation-specific retry parameters
- Separating them makes the code clearer and prevents bugs from partial state updates

**Error Detection:**

The `handleSetupFailure` callback detects when operations fail due to missing gesture:

```javascript
const handleSetupFailure = useCallback((operation, error, details) => {
  if (error?.name === "NotAllowedError" || error?.message?.includes("user gesture")) {
    // Mark operation as pending
    setPendingGestureOperations(prev => ({ ...prev, [operation]: true }));
    setPendingOperationDetails(prev => ({ ...prev, [operation]: details }));

    // Log to Sentry for analytics
    Sentry.captureMessage("Setup operation requires user gesture", {
      level: "info",
      tags: { operation, browser: navigator.userAgent },
      extra: { error: error?.message, details }
    });
  }
}, []);
```

**Where it's called:**

1. **Speaker alignment** (`alignSpeaker` in device alignment useEffect):
   ```javascript
   try {
     await devices.setSpeaker(targetId);
     // Success - clear any pending state
     setPendingGestureOperations(prev => ({ ...prev, speaker: false }));
     setPendingOperationDetails(prev => ({ ...prev, speaker: null }));
   } catch (err) {
     if (err?.name === "NotAllowedError" || err?.message?.includes("user gesture")) {
       handleSetupFailure("speaker", err, {
         speakerId: targetId,
         speakerLabel: targetSpeaker.device.label,
       });
     }
     // ... fallback handling
   }
   ```

2. **Future operations** - Easily extensible by calling `handleSetupFailure` from any setup operation

**Batch Retry Handler:**

The `handleCompleteSetup` callback retries all pending operations in one user gesture:

```javascript
const handleCompleteSetup = useCallback(async () => {
  const operations = [];
  const operationNames = [];

  // Batch all pending operations
  if (pendingGestureOperations.speaker && pendingOperationDetails.speaker) {
    operationNames.push("speaker");
    operations.push(
      devices.setSpeaker(pendingOperationDetails.speaker.speakerId)
        .then(() => {
          // Clear pending state on success
          setPendingGestureOperations(prev => ({ ...prev, speaker: false }));
          setPendingOperationDetails(prev => ({ ...prev, speaker: null }));
        })
    );
  }

  if (pendingGestureOperations.audioContext || needsUserInteraction) {
    operationNames.push("audioContext");
    operations.push(resumeAudioContext().then(() => { /* clear state */ }));
  }

  // Execute all operations in parallel (all within same user gesture)
  await Promise.all(operations);

  // Log success to Sentry
  Sentry.captureMessage("Setup completed via user gesture", {
    level: "info",
    tags: { browser: navigator.userAgent },
    extra: { operations: operationNames, success: true }
  });
}, [pendingGestureOperations, pendingOperationDetails, needsUserInteraction, devices, resumeAudioContext]);
```

**Why `Promise.all`?** All operations execute in parallel within the same user gesture context. This is more efficient than sequential execution and guarantees all operations can use the same gesture.

**Unified Prompt UI:**

The prompt shows when any operations are pending:

```jsx
{(Object.values(pendingGestureOperations).some(Boolean) ||
  (audioPlaybackBlocked || needsUserInteraction)) && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="mx-4 max-w-sm rounded-lg bg-slate-800 p-6 text-center shadow-xl">
      {Object.values(pendingGestureOperations).some(Boolean) ? (
        // Unified prompt for gesture-requiring operations
        <>
          <p className="mb-4 text-white">Click below to enable audio.</p>
          <button onClick={handleCompleteSetup}>Enable Audio</button>
        </>
      ) : (
        // Fallback for AudioContext-only issues
        <>
          <p className="mb-4 text-white">
            {audioContextState === "suspended"
              ? "Audio is paused. Click below to enable sound."
              : "Audio playback was blocked by your browser."}
          </p>
          <button onClick={handleEnableAudio}>Enable audio</button>
        </>
      )}
    </div>
  </div>
)}
```

**Visibility logic:**
- Show if ANY `pendingGestureOperations` flag is true (speaker, audioContext, etc.)
- Also show if `audioPlaybackBlocked` or `needsUserInteraction` (backward compatibility)
- Use unified prompt if gesture operations pending, otherwise use simple AudioContext prompt

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

### Why This Approach?

**Alternative 1: Separate prompts for each operation**
- ❌ Fragmented UX - user sees multiple prompts in sequence
- ❌ Confusing - why do I have to click multiple times?
- ❌ Not scalable - more operations = more prompts

**Alternative 2: Prevent the error upfront with a "Click to Join Call" button**
- ❌ Adds friction when not needed - most browsers don't require gestures for all operations
- ❌ Can't know which operations need gestures until we try them
- ❌ Still need error handling for edge cases

**Alternative 3: Automatically retry on next user interaction (any click)**
- ❌ Unpredictable behavior - user doesn't know what clicking will do
- ❌ May retry at inappropriate times (e.g., clicking mute button)
- ❌ No way to track which operations succeeded

**Chosen approach: Detect failures, batch operations, single prompt**
- ✅ Only shows when needed - no friction if browser allows operations
- ✅ Clear, actionable prompt - user knows what to click and why
- ✅ Single click for all operations - best UX
- ✅ Extensible - easy to add new gesture-requiring operations
- ✅ Analytics-friendly - Sentry tracks which operations need gestures

### Integration with Existing AudioContext Handling

The unified prompt **subsumes** the existing AudioContext banner when multiple operations need gestures:

**Strategy:**
- If AudioContext suspends ALONE → show existing simple banner (`handleEnableAudio`)
- If ANY gesture operation pending (speaker, etc.) → show unified prompt (`handleCompleteSetup`)
- Unified prompt also resumes AudioContext, so it handles both cases

**Why keep both?** Backward compatibility and simplicity:
- Simple AudioContext-only case uses existing, tested code path
- Unified prompt only appears when needed for multiple operations
- Conditional rendering (`Object.values(pendingGestureOperations).some(Boolean)`) chooses which to show

**Flow:**
```
User joins call
  ↓
alignSpeaker runs → setSpeaker fails with NotAllowedError
  ↓
handleSetupFailure marks speaker as pending
  ↓
Unified prompt appears: "Click below to enable audio"
  ↓
User clicks → handleCompleteSetup runs
  ↓
devices.setSpeaker(storedId) succeeds (has user gesture now)
  ↓
resumeAudioContext() also runs (if needed)
  ↓
Prompt disappears, audio works correctly
```

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

### Edge Cases and Considerations

**What if speaker selection succeeds on first try?**
- No error thrown → no pending state → no prompt shown
- Chrome/Firefox typically allow `setSinkId` without gesture

**What if user clicks button but operation still fails?**
- Error caught in `handleCompleteSetup`
- Pending state NOT cleared → prompt stays visible
- User can click again or see error in console/Sentry
- Rare case - usually means browser policy changed or device unavailable

**What if devices change while prompt is visible?**
- Device alignment useEffect re-runs when `devices` changes
- Will retry alignment with new device list
- If succeeds, clears pending state → prompt disappears
- If fails again, updates pending details with new device info

**What if component unmounts before user clicks?**
- State is lost (component-local state)
- User will see prompt again on next video stage if issue persists
- This is acceptable - each stage should handle its own setup

**What if both speaker AND audioContext need gestures?**
- Both marked as pending
- User sees one prompt: "Click below to enable audio"
- One click executes both operations via `Promise.all`
- This is the primary use case the unified prompt was designed for

**What about mobile Safari vs desktop Safari?**
- Both require gestures for `setSinkId`
- Mobile may have additional autoplay restrictions
- Implementation handles both - detects `NotAllowedError` regardless of platform

### Refactoring Considerations

When refactoring this code, preserve these behaviors:

1. **Detect gesture errors, don't assume them** - Always try the operation first and catch `NotAllowedError`. Don't preemptively show prompts based on browser detection, as policies vary.

2. **Clear pending state on success** - When operations succeed (either via retry or on first attempt), always clear both the flag and details:
   ```javascript
   setPendingGestureOperations(prev => ({ ...prev, speaker: false }));
   setPendingOperationDetails(prev => ({ ...prev, speaker: null }));
   ```

3. **Batch operations with `Promise.all`** - Don't execute sequentially. All operations need the same user gesture, so run them in parallel.

4. **Keep state separate from UI** - `pendingGestureOperations` and `pendingOperationDetails` are state; prompt visibility is derived from that state. Don't mix state and rendering logic.

5. **Log to Sentry at both failure and success** - Failure logs tell us when gestures are required; success logs confirm the fix worked. Both are needed for analytics.

6. **Use consistent error detection** - Check both `error?.name === "NotAllowedError"` and `error?.message?.includes("user gesture")` to handle different browser error formats.

7. **Integration with device alignment** - Speaker gesture detection happens inside the device alignment useEffect. Don't move it outside or it won't catch Safari errors.

8. **Extensibility** - To add a new gesture-requiring operation:
   - Add flag to `pendingGestureOperations` state
   - Add details to `pendingOperationDetails` state
   - Call `handleSetupFailure` when operation fails
   - Add retry logic in `handleCompleteSetup`
   - No UI changes needed - prompt automatically lists pending operations

9. **Don't skip AudioContext integration** - Even though AudioContext has its own banner, the unified prompt should also call `resumeAudioContext()`. This ensures audio works if both operations are needed.

10. **handleSetupFailure must be in useEffect dependencies** - The device alignment useEffect calls `handleSetupFailure`, so it must be in the dependency array. The callback is stable (created with `useCallback` with no dependencies).

### Success Criteria

- ✅ Unified prompt appears when ANY setup operation requires gesture
- ✅ User clicks one button to enable all pending operations
- ✅ All devices correctly set after user gesture
- ✅ Prompt disappears after successful setup
- ✅ No console errors for setSinkId or other operations
- ✅ Sentry tracking shows operation frequency and success rates
- ✅ Works across Safari versions (desktop and mobile)
- ✅ Gracefully handles single vs multiple pending operations
- ✅ Simple, non-technical UI message ("Enable Audio", not technical details)

---

## FixAV Modal Implementation Details

### Critical: Modal Must Be Rendered as JSX, Not as a Component Function

**The Problem:** The FixAV modal was originally implemented as a component function wrapped in `useCallback`:

```javascript
// ❌ INCORRECT - causes unmount/remount on state changes
const FixAVModal = useCallback(
  () => showFixModal ? <div>...</div> : null,
  [showFixModal, modalState, selectedIssues, /* ... */]
);
return { openFixAV, FixAVModal };

// Usage in parent:
<FixAVModal />
```

**Why this is broken:**
1. When user clicks a checkbox, `selectedIssues` state updates
2. The `useCallback` dependency array includes `selectedIssues`
3. A new `FixAVModal` function is created (different reference)
4. React sees the component type changed (new function reference)
5. React **unmounts the old component and mounts the new one**
6. During unmount/mount, the checkbox state update is lost
7. User sees checkbox briefly flash checked, then revert to unchecked

This is a **React anti-pattern**: defining components inside other components where the function reference changes on every render.

**The Solution:** Return JSX directly instead of a component function:

```javascript
// ✅ CORRECT - React reconciles normally
const fixAVModal = showFixModal ? <div>...</div> : null;
return { openFixAV, fixAVModal };

// Usage in parent:
{fixAVModal}
```

**Why this works:**
- The modal is just JSX that gets included in the render tree
- React can reconcile it normally when state changes
- No unmount/remount cycle
- Checkbox state persists correctly

**Related GitHub Issue:** [#1177](https://github.com/Watts-Lab/deliberation-empirica/issues/1177)

### Rejoin Call Implementation

**Purpose:** The "Rejoin Call" escalation option leaves and rejoins the Daily room without a full page reload. This preserves device IDs (avoiding Safari's device ID rotation) while reconnecting WebRTC.

**Implementation (`handleRejoinCall` in FixAV.jsx):**

```javascript
const handleRejoinCall = useCallback(async () => {
  if (!callObject || callObject.isDestroyed?.() || !roomUrl) return;

  setModalState("diagnosing");

  try {
    const meetingState = callObject.meetingState?.();

    // If currently in a meeting, leave first
    if (meetingState === "joined-meeting") {
      // 1. Leave the current call
      await callObject.leave();

      // 2. Wait briefly for leave to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 3. Always join (whether we just left or were already disconnected)
    await callObject.join({ url: roomUrl });

    // 4. Close modal only after successful rejoin
    setShowFixModal(false);
    setModalState("select");
  } catch (err) {
    // Fallback to full page reload if rejoin fails
    window.location.reload();
  }
}, [callObject, roomUrl]);
```

**Key Requirements:**

1. **roomUrl must be passed from VideoCall → Tray → useFixAV**
   - VideoCall gets it from `game.get("dailyUrl")`
   - Tray receives it as a prop and passes it to `useFixAV`
   - useFixAV uses it to rejoin the same room

2. **Handle both connected and disconnected states**
   - If user is currently `joined-meeting`: leave first, wait, then join
   - If user is already `left-meeting` or in error state: join directly
   - Always attempt join regardless of current state
   - Only close modal after successful join

3. **Wait between leave and join**
   - The 500ms delay allows Daily to fully process the leave
   - Without it, the join may fail or create inconsistent state

4. **Preserve device IDs**
   - Unlike page reload, leave+join keeps the same browser session
   - Safari doesn't rotate device IDs within a session
   - User's selected devices remain active

5. **Fallback to reload on failure**
   - If rejoin throws an error, reload the page as last resort
   - Better than leaving user stuck in broken state

**Data Flow:**

```
VideoCall.jsx
  roomUrl = game.get("dailyUrl")
      ↓ (prop)
  Tray.jsx
      ↓ (prop)
  useFixAV(player, ..., roomUrl)
      ↓ (closure in handleRejoinCall)
  callObject.join({ url: roomUrl })
```

**Why Not Auto-Rejoin?**

A previous implementation expected VideoCall to automatically rejoin after detecting the "left-meeting" state. This doesn't work because:

- VideoCall's join effect has dependencies `[callObject, joiningMeetingRef, roomUrl, player]`
- None of these change when `callObject.leave()` is called
- The effect doesn't re-run, so no auto-rejoin happens
- Solution: Explicitly call `callObject.join()` in `handleRejoinCall`

**Testing the Rejoin Flow:**

1. Join a video call normally
2. Open FixAV modal and select an issue
3. Click "Diagnose & Fix"
4. Click "Rejoin Call" from the escalation options
5. Verify:
   - Call leaves and rejoins within ~1 second
   - Your camera and microphone remain active
   - Your device selections are preserved (especially in Safari)
   - You can see and hear other participants
   - Modal closes automatically after successful rejoin

**Common Failure Modes:**

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| "Rejoin Call" does nothing | roomUrl not passed through | Check VideoCall → Tray → useFixAV props |
| Rejoin fails, falls back to reload | Daily room URL invalid or expired | Check `game.get("dailyUrl")` |
| Can't see/hear after rejoin | Device permissions revoked mid-call | User must grant permissions again |
| Modal shows "diagnosing" forever | Exception in rejoin code | Check console for errors |

### Refactoring Considerations for FixAV

When refactoring this code, preserve these critical behaviors:

1. **Modal rendering pattern** - Always return JSX directly (`fixAVModal`), never as a component function wrapped in `useCallback`. The component function pattern causes React to unmount/remount on state changes, breaking interactive elements like checkboxes.

2. **roomUrl must be threaded through** - The rejoin functionality requires the Daily room URL to be passed from VideoCall → Tray → useFixAV. Don't try to get it from `callObject` or other sources; use the explicit prop chain.

3. **Rejoin must explicitly call join()** - Don't rely on VideoCall to auto-detect the "left-meeting" state and rejoin. The leave() call doesn't trigger VideoCall's join effect to re-run. Always call `callObject.join({ url: roomUrl })` explicitly.

4. **Wait between leave and join** - The 500ms delay is critical for Daily to process the leave before rejoining. Without it, the join may fail with inconsistent state.

5. **Fallback to reload on rejoin failure** - If `callObject.join()` throws, fall back to `window.location.reload()`. This prevents users from being stuck in a broken state.

6. **Modal state management** - The modal uses a state machine with states: `select`, `diagnosing`, `success`, `partial`, `failed`, `unfixable`, `unknown`. Each state has specific UI and behavior. Don't simplify this to boolean flags; the state machine is needed for proper user feedback.

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
