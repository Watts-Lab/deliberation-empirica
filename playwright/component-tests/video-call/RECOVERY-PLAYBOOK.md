# Video Call Recovery Playbook

This is a spec for how every video call failure should be detected, diagnosed,
and recovered. It is organized by **recovery workflow** (what we do), not by
trigger (what fired). Many different signals can route to the same workflow.

Where current implementation differs from the spec, the gap is noted.

Last updated: 2026-03-01

---

## Recovery philosophy

1. **Catch errors before the user does.** Proactively monitor track state,
   device availability, and connection quality. When something breaks, we should
   detect it and start recovery before the user ever notices — not wait for them
   to report a symptom.

2. **Diagnose before displaying.** Never trust a single signal. When an event
   fires, independently verify the state before choosing what to show.

3. **Fix silently when possible.** If we can resolve the issue in under ~2
   seconds without user input, do it. The user should never see an error for
   something we can handle ourselves.

4. **Show targeted guidance when user input is required.** When we do need the
   user, show them exactly what to do based on our diagnosis — not a generic
   message.

5. **Escalate incrementally.** Soft fix → rejoin call → reload page. Each step
   is more disruptive than the last. Never skip to reload when a softer option
   could work.

6. **Always leave an escape hatch.** Even when showing an error overlay, keep
   the Fix A/V button and Dismiss accessible so the user isn't stuck.

7. **Fix A/V button usage is a failure.** The Fix A/V button exists as a
   fallback, but if a user clicks it, that means our proactive detection and
   auto-fix pipeline missed something. Every Fix A/V button click should send a
   Sentry error log so we can track how often this happens and close the gaps.

---

# Part 1: Detection — every signal that can indicate a problem

Each signal is something we listen for (or should listen for). When it fires,
we run diagnosis and route to the appropriate recovery workflow.

## Daily SDK events

### `camera-error`

Fires when Daily can't acquire or maintain a camera or mic. Caught by
`handleDeviceError` in VideoCall.jsx:461–493.

| `error.type` | Meaning | Route to workflow |
|---|---|---|
| `permissions` | Browser or OS blocked access. Has `blockedBy` (`user`\|`browser`) and `blockedMedia` fields | **W1: Permission denied** |
| `not-found` | No device detected. Has `missingMedia` field | **W2: Device not found** |
| `cam-in-use` / `mic-in-use` / `cam-mic-in-use` | Device locked by another app (common on Windows) | **W3: Device in-use** |
| `constraints` | Invalid getUserMedia constraints. Has `reason` (`invalid`\|`none-specified`) | **W3: Device in-use** (same generic guidance) |
| `undefined-mediadevices` | `navigator.mediaDevices` is undefined (non-HTTPS) | **W3: Device in-use** (with HTTPS-specific note) |
| `unknown` | Catchall — browser/system restart may be needed | **W3: Device in-use** |

**Currently handled:** Yes — VideoCall.jsx listens for this event.

### `mic-error`

Same subtypes and routing as `camera-error`, but for the microphone specifically.

**Currently handled:** Yes.

### `fatal-devices-error`

Fires when the browser can't access devices at all (not just one device).

**Note:** This event does NOT appear in current Daily TypeScript definitions.
It may have been removed or renamed. Our code listens for it, but it's unclear
when (or whether) it fires in practice.

**Route to:** **W2: Device not found** (try re-acquiring both devices)

**Currently handled:** Falls through to generic error copy. No specific
handling.

### `error` (fatal)

Fires when the call is **unrecoverably dead**. Meeting state transitions to
`"error"`. A `left-meeting` event follows immediately.

| `error.type` | Meaning |
|---|---|
| `connection-error` | Network/WebRTC failure. Has `details.on`: `load`\|`join`\|`reconnect`\|`move`\|`rtc-connection`\|`room-lookup` |
| `ejected` | Removed by an owner/admin |
| `exp-room` / `exp-token` | Room or meeting token expired |
| `nbf-room` / `nbf-token` | Room/token "not before" time not reached |
| `no-room` | Room does not exist |
| `meeting-full` | Room at max participant limit |
| `not-allowed` | Participant not authorized to join |
| `end-of-life` | Deprecated SDK version no longer supported |

**Route to:** **W5: Call disconnected**

**Currently handled:** Logged only ([eventLogger.js:101](client/src/call/hooks/eventLogger.js#L101)).
**No UI, no recovery action.** This is a significant gap — the user sits with
a dead call and no feedback.

### `nonfatal-error`

Fires for degraded but recoverable states. The call continues.

| `type` | Meaning | Relevance |
|---|---|---|
| `input-settings-error` | Error applying mic/camera config | Could indicate device config failure |
| `screen-share-error` | Screen share failed | Low — we don't use screen sharing |
| `video-processor-error` | Background blur/replace failed | Low — we don't use video processors |
| `audio-processor-error` | Noise cancellation failed | Low — we don't use audio processors |
| `local-audio-level-observer-error` | Audio level monitoring failed | Low |
| `remote-media-player-error` | Remote media player failed | Low |

**Route to:** Log to Sentry. `input-settings-error` could route to **W2**.

**Currently handled:** Not listened for at all.

### `network-connection`

Fires when a network connection changes state.

| `type` × `event` | Meaning |
|---|---|
| `signaling` × `interrupted` | Connection to Daily servers lost. If not recovered in ~20s, participant is ejected |
| `sfu` × `interrupted` | Connection to media server lost. Remote tracks stop. Daily auto-reconnects |
| `peer-to-peer` × `interrupted` | P2P connection lost |
| Any × `connected` | Connection restored |

**Route to:** `interrupted` → **W6: Network interrupted** (show
"reconnecting" UI). `connected` → clear reconnecting UI.

**Currently handled:** Not listened for at all. This is a gap — user sees
frozen video with no explanation.

### `network-quality-change`

Fires when network quality metrics change (packet loss, RTT, bitrate).

| `networkState` | Meaning |
|---|---|
| `good` | Normal quality |
| `warning` | Some degradation |
| `bad` | Significant degradation |

**Route to:** `bad` → **W7: Network degraded** (informational banner)

**Currently handled:** Logged to Empirica stage data
([eventLogger.js:92](client/src/call/hooks/eventLogger.js#L92)). No UI.

### `load-attempt-failed`

Fires during `join()` when the Daily bundle fails to load. Daily retries
automatically. If all retries fail, a fatal `error` event follows.

**Route to:** No action needed — Daily handles retries. The fatal `error`
event catches total failure.

**Currently handled:** Not listened for. Acceptable — the `error` event is
the one that matters.

### `left-meeting`

Fires when participant leaves (intentionally or due to error).

**Route to:** If unexpected (no user-initiated leave), route to **W5: Call
disconnected**.

**Currently handled:** Logged, `dailyId` cleared
([eventLogger.js:48](client/src/call/hooks/eventLogger.js#L48)).

### `cpu-load-change`

Fires when CPU load transitions between `low` and `high`. Includes
`cpuLoadStateReason`: `encode`|`decode`|`scheduleDuration`|`none`.

**Route to:** Log to Sentry. Could reduce video quality if `high`.

**Currently handled:** Not listened for. Low priority.

---

## Browser API signals

### `navigator.permissions.query().onchange`

Fires when camera or mic permission state changes.

| New state | Route to |
|---|---|
| `denied` | **W1: Permission denied** (proactively, before user notices) |
| `granted` | Clear any permission-denied UI; auto-reload page |

**Currently handled:** Logged to console
([VideoCall.jsx:500–540](client/src/call/VideoCall.jsx#L500)). Auto-reload on
re-grant works (DEVRECOV-007). But permission revocation only logs — no
proactive UI.

### `navigator.mediaDevices.ondevicechange`

Fires when a device is plugged in or unplugged.

**Diagnosis on each fire:**
- Run `enumerateDevices()` and compare with previous snapshot
- If a device disappeared: route based on type
- If a device appeared while error overlay is showing: route to **W4**

| What changed | Route to |
|---|---|
| Camera disappeared & was active | **W2: Device not found** |
| Mic disappeared & was active | **W2: Device not found** |
| Speaker disappeared & was active | **W2: Device not found** (speaker variant) |
| Any device appeared during error state | **W4: Device reconnected** |

**Currently handled:** Not listened for at all. This is a critical gap — it's
the only way to detect speaker disconnection (Daily has no event for output
devices) and to detect device reconnection.

### AudioContext `statechange`

Fires when `audioContext.state` transitions between `suspended` and `running`.

**Route to:** **W8: AudioContext suspended**

**Currently handled:** Yes — `useAudioContextMonitor` handles this fully.

---

## Proactive monitoring (heartbeat)

These are not event-driven — they require polling on a timer (e.g., every 5s).

### Track state poll

Check `callObject.participants().local.tracks` for:

| Condition | Route to |
|---|---|
| `audio.persistentTrack.readyState === "ended"` | **W2: Device not found** (mic variant) — re-acquire |
| `video.persistentTrack.readyState === "ended"` | **W2: Device not found** (camera variant) — re-acquire |
| `audio.state === "off"` unexpectedly | Log; possibly **W2** |
| `video.state === "off"` unexpectedly | Log; possibly **W2** |

**Currently handled:** Only checked when user opens FixAV. Should be
proactive (philosophy #1).

### Device alignment poll

Check that the active device still matches the preferred device. Already runs
at join time; could run periodically.

**Currently handled:** At join time only. Drift during call not monitored.

### Network stats poll

`callObject.getNetworkStats()` polled every 30s.

**Currently handled:** Yes — logged to Empirica stage data
([eventLogger.js:144–174](client/src/call/hooks/eventLogger.js#L144)). No UI.

---

## User-initiated signals

### Fix A/V button click

User opens the Fix Audio/Video modal. This triggers `collectAVDiagnostics()`
and `diagnoseIssues()` which independently verify all device, track, and
permission state.

**Per philosophy #7:** Every click should send a Sentry error log with the
full diagnostics payload, because it means proactive detection failed.

**Route to:** Diagnosis determines which workflow to enter (W1–W3 typically).

**Currently handled:** Yes — FixAV.jsx handles the full diagnostic flow. But
no Sentry error is sent on click.

---

# Part 2: Recovery workflows

Each workflow is defined once. Multiple signals can route to the same workflow.

---

## W1: Permission denied

**Triggered by:**
- `camera-error` / `mic-error` with `type = "permissions"`
- `permissions.onchange` → `"denied"`
- FixAV diagnosis finding `browserPermissions.camera/microphone === "denied"`

**Diagnosis (verify before showing):**
- Query `navigator.permissions.query({ name: "camera"/"microphone" })`
- If permissions API says `"granted"` but Daily said `"permissions"`, the real
  cause is something else — re-route to W3

**Auto-fix:** None possible — browser requires manual user action.

**User-prompted recovery:**
- Show `PermissionDeniedGuidance` with browser-specific screenshot (Chrome lock
  icon, Firefox camera icon, Safari settings, Edge lock icon)
- Watch `permissions.onchange` — if user re-grants, auto-reload

**Fallback:**
- "Reload and retry" → `window.location.reload()`
- "Dismiss" → clear overlay, return to call (one device may still work)
- Fix A/V button remains accessible

**Current implementation:** Mostly matches spec. UI trusts Daily's `error.type`
rather than cross-checking with permissions API. Independent verification runs
but results only go to Sentry, not used to drive UI. FixAV uses generic text
instead of `PermissionDeniedGuidance`.

**Gaps:**
- No test for Daily saying "permissions" when browser says "granted"
- FixAV should reuse `PermissionDeniedGuidance`
- Permission revocation mid-call only logs, doesn't show proactive UI

**Tests:** DEVRECOV-005, DEVRECOV-006, DEVRECOV-007, PERM-001–003

---

## W2: Device not found / track lost

**Triggered by:**
- `camera-error` / `mic-error` with `type = "not-found"`
- `fatal-devices-error`
- `devicechange` showing a device disappeared
- Proactive poll finding `track.readyState === "ended"`
- FixAV diagnosis finding no active device

**Diagnosis:**
- `navigator.mediaDevices.enumerateDevices()` → are alternatives available?
- `navigator.permissions.query()` → is this actually a permission issue
  misclassified as not-found? If so, re-route to W1
- Which device type is affected? (camera, mic, speaker, or multiple)

**Auto-fix (before showing anything):**
- If alternatives exist, try switching:
  - Camera/mic: `callObject.setInputDevicesAsync({ videoDeviceId/audioDeviceId })`
    using `findMatchingDevice` (preferred label → first available)
  - Speaker: `devices.setSpeaker(matchedDeviceId)`
- If switch succeeds, clear error silently — user never sees UI
- If switch fails, fall through to user recovery

**User-prompted recovery (only if auto-fix failed):**
- Show `DevicePicker` with available alternatives of the affected type
- User selects device, clicks "Switch to this device"
- If 0 alternatives: "No [cameras/microphones/speakers] found. Plug one in,
  then reload."

**Fallback:**
- "Reload and retry" → `window.location.reload()`
- Fix A/V button

**Current implementation:**
- For `camera-error`/`mic-error` not-found: Shows picker immediately, skips
  auto-fix attempt
- For `fatal-devices-error`: Falls through to generic copy, no specific handling
- For speaker disconnect: No detection at all (core Issue #1190 gap)
- For proactive track monitoring: Not implemented — only checked in FixAV
- For `devicechange`: Not listened for

**Gaps:**
- No auto-fix attempt before showing picker
- No test for 0 available alternatives
- No `ondevicechange` listener for speaker disconnect detection
- No proactive track state monitoring
- No specific `fatal-devices-error` handling

**Tests:** DEVRECOV-001, DEVRECOV-002, DEVRECOV-009, DEVRECOV-010, DEVRECOV-011,
FIXAV-006, FIXAV-008

---

## W3: Device in-use / generic device error

**Triggered by:**
- `camera-error` / `mic-error` with `type = "cam-in-use"`, `"mic-in-use"`,
  `"cam-mic-in-use"`, `"constraints"`, `"undefined-mediadevices"`, or `"unknown"`
- W1 or W2 re-routing here when diagnosis doesn't match initial signal

**Diagnosis:**
- Check permissions (might be misclassified → re-route to W1)
- Enumerate devices (might be misclassified → re-route to W2)
- Check for "NotReadableError" (Windows-specific for in-use)

**Auto-fix:** None practical — the other app must release the device, or the
browser/system issue must be resolved externally.

**User-prompted recovery:**
- "Close any other app (Zoom, Meet, FaceTime, etc.) that may be using your
  camera/mic"
- "Reload the page to retry"
- For `undefined-mediadevices`: "This page must be served over HTTPS"
- For `unknown`: "Try restarting your browser"

**Current implementation:** Shows generic steps from `deviceErrorCopy`. Matches
spec reasonably well.

**Tests:** DEVRECOV-008

---

## W4: Device reconnected

**Triggered by:**
- `devicechange` event fires while `deviceError` state is set (UserMediaError
  overlay is showing)
- `devicechange` event fires and a new device of a needed type appears

**Diagnosis:**
- Run `enumerateDevices()` — did a device of the needed type appear?
- Is it the same device that was lost (by label), or a new one?

**Auto-fix:**
- Try re-acquiring: `callObject.setInputDevicesAsync()` with the reconnected
  device
- If succeeds, clear `deviceError` — overlay disappears automatically

**User-prompted recovery (if auto-fix fails):**
- Update DevicePicker to include newly available device
- "A new device was detected — select it to reconnect"

**Current implementation:** Not implemented. No `ondevicechange` listener.
User must manually reload or use the picker (which was populated at error time
and won't reflect new devices).

**Tests:** None

---

## W5: Call disconnected (fatal)

**Triggered by:**
- `error` event (any `DailyFatalErrorType`)
- Unexpected `left-meeting` event (not user-initiated)

**Diagnosis:**
- Check `error.type` for specific cause
- For `connection-error`: check `details.on` to know which phase failed

**Auto-fix:**
- For `connection-error` with `details.on = "reconnect"`: Daily may still be
  trying to reconnect — wait briefly
- For `ejected`, `exp-room/token`, `meeting-full`, `not-allowed`: no auto-fix,
  these are intentional/permanent

**User-prompted recovery:**
- Show clear message based on `error.type`:
  - `connection-error`: "Your connection to the call was lost. Click to rejoin."
  - `ejected`: "You were removed from the call by the moderator."
  - `exp-room`/`exp-token`: "This call session has expired."
  - `meeting-full`: "The call is full."
  - `not-allowed`: "You are not authorized to join this call."
- For `connection-error`: offer "Rejoin Call" button
- For permanent failures: offer "Reload Page" or explain situation

**Current implementation:** **Not implemented.** The `error` event is logged
to console but no UI is shown and no recovery is attempted. The user sees a
frozen/black call with no feedback. This is a significant gap.

**Tests:** None

---

## W6: Network interrupted (transient)

**Triggered by:**
- `network-connection` event with `event = "interrupted"`

**Diagnosis:**
- Check `type`: `signaling` (severe — ejection in ~20s) vs `sfu`/`peer-to-peer`
  (less severe — Daily auto-reconnects)

**Auto-fix:** Daily handles reconnection automatically. We just need to show
appropriate UI.

**User-facing UI:**
- Show non-blocking banner: "Reconnecting..." (with spinner)
- For `signaling` interrupted: escalate to "Connection lost — reconnecting..."
- Clear banner when `network-connection` with `event = "connected"` fires
- If no recovery after ~20s, the fatal `error` event fires → route to **W5**

**Current implementation:** Not implemented. No listener for
`network-connection`. User sees frozen video with no explanation.

**Tests:** None

---

## W7: Network degraded (informational)

**Triggered by:**
- `network-quality-change` event with `networkState = "bad"`
- Network stats poll showing high packet loss (>5%) or high RTT (>500ms)

**Auto-fix:** Not fixable from our side.

**User-facing UI:**
- Show subtle, non-blocking indicator: "Poor network connection"
- Clear when quality improves to `"good"`
- Don't interrupt the call — this is informational only

**Current implementation:** Logged to Empirica data. No UI. Low priority.

**Tests:** None (unit tests only for stats collection)

---

## W8: AudioContext suspended

**Triggered by:**
- `audioContext.state === "suspended"` at page load or during call
- Tab blur while AudioContext is suspended (Firefox)

**Auto-fix:** `audioContext.resume()` — retried every 5 seconds. Succeeds
silently if browser allows (Chrome usually does, Safari usually doesn't).

**User fix (if auto-resume fails):** "Enable Audio" overlay. User click
provides the gesture browsers require. Also resumes AudioContext.

**Auto-dismiss:** When `audioContext.state` transitions to `"running"`.

**Current implementation:** Fully implemented in `useAudioContextMonitor`.

**Tests:** AUDIO-001 through AUDIO-006

---

## W9: Safari speaker gesture required

**Triggered by:**
- `devices.setSpeaker()` throws `NotAllowedError` during device alignment

**Auto-fix:** None — gesture is required by definition.

**User fix:** "Enable Audio" overlay. Click calls `handleCompleteSetup()` which
retries `setSpeaker()` within the gesture context.

**Fallback:** If gesture-retry fails, try fallback speaker device.

**Current implementation:** Fully implemented.

**Tests:** SPEAKER-001 through SPEAKER-006

---

## W10: Subscription drift

**Triggered by:**
- Heartbeat timer (every 2s) detecting mismatch between desired and actual
  track subscriptions

**Auto-fix:** `callObject.updateParticipants()` with correct subscription
payload. 3-second cooldown between repairs.

**User impact:** None — drift is repaired silently.

**Current implementation:** Fully implemented.

**Tests:** SUB-001 through SUB-006

---

## W11: Device alignment (Safari ID rotation)

**Triggered by:**
- Device alignment runs after `callObject.join()` succeeds
- Stored device ID doesn't match any available device

**Auto-fix:**
1. Label match (labels survive Safari ID rotation)
2. Fallback to first available device
3. If `setInputDevicesAsync` fails, retry with fallback

**User impact:** None — alignment happens silently. Sentry breadcrumb logged.

**Current implementation:** Fully implemented.

**Tests:** DEVICE-001 through DEVICE-008

---

## W12: Escalation — Rejoin Call

**When used:** After targeted fixes in W1–W4 fail to resolve the issue.

**What it does:** `callObject.leave()` → 500ms wait → `callObject.join()`

**Why this over reload:** Preserves device IDs (avoids Safari rotation), less
disruptive, faster.

**On failure:** Falls back to W13 (reload page).

**Tests:** None. **Gap:** No component test.

---

## W13: Escalation — Reload Page

**When used:** After Rejoin fails, or as explicit user choice.

**What it does:** `window.location.reload()`

**Tests:** None. **Gap:** No component test.

---

## W14: Firefox WebRTC stall during join

**Triggered by:**
- `blur` event during `callObject.join()`, or page already unfocused at join

**Diagnosis:** `joiningMeetingRef.current === true` AND tab unfocused, checked
after 500ms delay.

**Auto-fix:** None — Firefox won't complete WebRTC handshake without focus.

**User fix:** "Video connection paused. Click below to continue." Click focuses
the page, join completes.

**Auto-dismiss:** Clears when join succeeds.

**Current implementation:** Implemented (Issue #1187 fix).

**Tests:** No dedicated component test (covered by manual QA).

---

# Part 3: Detection → Workflow routing matrix

This maps every signal to the workflow it should trigger, and shows current
implementation status.

## Daily SDK events

| Signal | Subtype / condition | Routes to | Handled? |
|---|---|---|---|
| `camera-error` | `type = "permissions"` | W1 | Yes |
| `camera-error` | `type = "not-found"` | W2 | Yes (no auto-fix) |
| `camera-error` | `type = "cam-in-use"` | W3 | Yes |
| `camera-error` | `type = "constraints"` | W3 | Yes |
| `camera-error` | `type = "undefined-mediadevices"` | W3 | Yes |
| `camera-error` | `type = "unknown"` | W3 | Yes |
| `mic-error` | `type = "permissions"` | W1 | Yes |
| `mic-error` | `type = "not-found"` | W2 | Yes (no auto-fix) |
| `mic-error` | `type = "mic-in-use"` | W3 | Yes |
| `fatal-devices-error` | — | W2 | Partial (generic copy) |
| **`error`** | **`connection-error`** | **W5** | **Log only — no UI** |
| **`error`** | **`ejected`** | **W5** | **Log only — no UI** |
| **`error`** | **`exp-room` / `exp-token`** | **W5** | **Log only — no UI** |
| **`error`** | **`no-room` / `meeting-full` / `not-allowed`** | **W5** | **Log only — no UI** |
| **`nonfatal-error`** | **`input-settings-error`** | **W2** | **Not listened for** |
| **`nonfatal-error`** | **other types** | **Log only** | **Not listened for** |
| **`network-connection`** | **`interrupted`** | **W6** | **Not listened for** |
| `network-connection` | `connected` | Clear W6 UI | Not listened for |
| `network-quality-change` | `bad` | W7 | Logged, no UI |
| `left-meeting` | unexpected | W5 | Logged, no recovery |
| `load-attempt-failed` | — | None (Daily retries) | Not listened for (OK) |
| `cpu-load-change` | `high` | Log only | Not listened for (low priority) |

## Browser API signals

| Signal | Condition | Routes to | Handled? |
|---|---|---|---|
| `permissions.onchange` | → `"denied"` | W1 | **Log only — no proactive UI** |
| `permissions.onchange` | → `"granted"` | Clear W1 UI, reload | Yes |
| **`mediaDevices.ondevicechange`** | **Camera disappeared** | **W2** | **Not listened for** |
| **`mediaDevices.ondevicechange`** | **Mic disappeared** | **W2** | **Not listened for** |
| **`mediaDevices.ondevicechange`** | **Speaker disappeared** | **W2** | **Not listened for** |
| **`mediaDevices.ondevicechange`** | **Device appeared during error** | **W4** | **Not listened for** |
| `audioContext.statechange` | `suspended` | W8 | Yes |
| `setSpeaker` throws | `NotAllowedError` | W9 | Yes |

## Proactive monitoring (heartbeat)

| Check | Condition | Routes to | Handled? |
|---|---|---|---|
| **Track state poll** | **`readyState === "ended"`** | **W2** | **FixAV only — not proactive** |
| **Track state poll** | **`state === "off"` unexpectedly** | **W2** | **FixAV only — not proactive** |
| Subscription drift | Desired ≠ actual | W10 | Yes (every 2s) |
| Device alignment | At join time | W11 | Yes |
| Network stats | High loss / RTT | W7 | Logged, no UI |

## User-initiated

| Signal | Routes to | Handled? |
|---|---|---|
| **Fix A/V button click** | Diagnosis → W1/W2/W3 | **Yes, but no Sentry error on click** |

---

# Part 4: Coverage summary

## Fully implemented and tested

| Workflow | Description | Tests |
|---|---|---|
| W1 | Permission denied | DEVRECOV-005/006/007, PERM-001–003 |
| W3 | Device in-use | DEVRECOV-008 |
| W8 | AudioContext suspended | AUDIO-001–006 |
| W9 | Safari speaker gesture | SPEAKER-001–006 |
| W10 | Subscription drift | SUB-001–006 |
| W11 | Device alignment | DEVICE-001–008 |

## Partially implemented — need work

| Workflow | What exists | What's missing |
|---|---|---|
| W2: Device not found | Picker shown on `not-found` error | Auto-fix before picker; `ondevicechange` detection; proactive track poll; speaker disconnect; 0-alternatives case |
| W1: Permission denied (mid-call) | Logged on revocation | Proactive UI on revocation (not just logging) |
| W1: Permission denied (FixAV) | Generic text | Should reuse `PermissionDeniedGuidance` with screenshots |
| W12/W13: Rejoin/Reload | Buttons exist in UI | No component tests |

## Not yet implemented

| Workflow | What needs to be built | Priority |
|---|---|---|
| **W5: Call disconnected** | Listen for `error` event, show typed messages, offer rejoin for `connection-error` | **High** — user is silently disconnected |
| **W6: Network interrupted** | Listen for `network-connection` interrupted, show "reconnecting" banner | **High** — user sees frozen call |
| **W4: Device reconnected** | `ondevicechange` listener during error state, auto-retry acquisition | Medium |
| Proactive track monitoring | Poll track state every 5s, auto-recover before user notices | Medium |
| Sentry on Fix A/V click | Log Sentry error with diagnostics on every Fix A/V click | Medium |
| W7: Network degraded UI | Show subtle "poor connection" indicator | Low |
| `nonfatal-error` listener | Listen for `input-settings-error`, route to W2 | Low |
| `cpu-load-change` listener | Log, possibly reduce quality | Low |

---

# Part 5: Test plan

Tests should cover two dimensions independently:

## Detection tests

"When signal X fires, the correct workflow is triggered."

These verify the routing logic — that each signal is listened for and correctly
classified.

| Test | Signal | Expected routing |
|---|---|---|
| DET-001 | `camera-error` type=permissions | W1 overlay shown |
| DET-002 | `camera-error` type=not-found | W2 picker shown |
| DET-003 | `camera-error` type=cam-in-use | W3 generic guidance shown |
| DET-004 | `mic-error` type=permissions | W1 overlay shown |
| DET-005 | `mic-error` type=not-found | W2 picker shown |
| DET-006 | `fatal-devices-error` | W2 triggered |
| DET-007 | `error` type=connection-error | W5 "connection lost" shown |
| DET-008 | `error` type=ejected | W5 "removed" shown |
| DET-009 | `error` type=exp-room | W5 "expired" shown |
| DET-010 | `network-connection` interrupted (signaling) | W6 "reconnecting" shown |
| DET-011 | `network-connection` interrupted (sfu) | W6 "reconnecting" shown |
| DET-012 | `network-connection` connected | W6 banner cleared |
| DET-013 | `permissions.onchange` → denied | W1 shown proactively |
| DET-014 | `permissions.onchange` → granted | Auto-reload |
| DET-015 | `devicechange` — camera disappeared | W2 triggered |
| DET-016 | `devicechange` — speaker disappeared | W2 triggered |
| DET-017 | `devicechange` — device appeared during error | W4 auto-retry |
| DET-018 | Track poll — readyState ended | W2 triggered |
| DET-019 | Fix A/V click | Sentry error logged |

## Workflow tests

"Given this diagnosis, the recovery sequence works end-to-end."

These verify the recovery logic independent of how it was triggered.

| Test | Workflow | Scenario |
|---|---|---|
| WF-001 | W1 | Permission denied → guidance shown with correct browser image |
| WF-002 | W1 | Permission re-granted → auto-reload |
| WF-003 | W2 | Device lost, alternative exists → auto-switch succeeds silently |
| WF-004 | W2 | Device lost, alternative exists, auto-switch fails → picker shown |
| WF-005 | W2 | Device lost, 0 alternatives → "plug in device" message |
| WF-006 | W2 | Speaker lost → auto-switch to alternative speaker |
| WF-007 | W3 | Device in-use → generic guidance shown |
| WF-008 | W4 | Device reconnected during error → auto-retry succeeds, overlay clears |
| WF-009 | W4 | Device reconnected, auto-retry fails → picker updated |
| WF-010 | W5 | Connection error → "connection lost" + rejoin button |
| WF-011 | W5 | Ejected → "removed by moderator" (no rejoin) |
| WF-012 | W5 | Room expired → "session expired" |
| WF-013 | W6 | Network interrupted → banner shown → connected → banner cleared |
| WF-014 | W12 | Rejoin call succeeds |
| WF-015 | W13 | Reload page triggered |

## Existing tests mapped to new IDs

| Old ID | New coverage | Notes |
|---|---|---|
| DEVRECOV-001/002 | DET-002/005 | Device error fires, overlay shown |
| DEVRECOV-005 | DET-001/004, WF-001 | Permission denied guidance |
| DEVRECOV-006 | WF-001 | Correct browser image |
| DEVRECOV-007 | DET-014, WF-002 | Auto-reload on re-grant |
| DEVRECOV-008 | DET-003, WF-007 | Device in-use guidance |
| DEVRECOV-009/010 | WF-004 | Picker shown for not-found |
| DEVRECOV-011 | WF-004 | Switch device clears error |
| FIXAV-005/007 | — | Mute toggle (user-initiated, not auto-fix) |
| FIXAV-006/008 | WF-003 (partial) | Track ended recovery (via FixAV, not proactive) |
| PERM-001–003 | DET-013 (partial) | Permission change logged (no proactive UI) |
| AUDIO-001–006 | W8 | AudioContext fully covered |
| SPEAKER-001–006 | W9 | Safari gesture fully covered |
| SUB-001–006 | W10 | Subscription drift fully covered |
| DEVICE-001–008 | W11 | Device alignment fully covered |
