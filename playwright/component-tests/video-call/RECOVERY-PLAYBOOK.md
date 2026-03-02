# Video Call Recovery Playbook

This is a spec for how every video call failure should be detected, diagnosed,
and recovered. It is organized by **recovery workflow** (what we do), not by
trigger (what fired). Many different signals can route to the same workflow.

Where current implementation differs from the spec, the gap is noted.

Last updated: 2026-03-02

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
`handleDeviceError` in VideoCall.jsx.

| `error.type` | Meaning | Route to workflow |
|---|---|---|
| `permissions` | Browser or OS blocked access. Has `blockedBy` (`user`\|`browser`) and `blockedMedia` fields | **W1: Permission denied** |
| `not-found` | No device detected. Has `missingMedia` field | **W2: Device not found** |
| `cam-in-use` / `mic-in-use` / `cam-mic-in-use` | Device locked by another app (common on Windows) | **W3: Device in-use** |
| `constraints` | Invalid getUserMedia constraints. Has `reason` (`invalid`\|`none-specified`) | **W3: Device in-use** (same generic guidance) |
| `undefined-mediadevices` | `navigator.mediaDevices` is undefined (non-HTTPS) | **W3: Device in-use** (with HTTPS-specific note) |
| `unknown` | Catchall — browser/system restart may be needed | **W3: Device in-use** |

**Currently handled:** Yes — VideoCall.jsx listens for this event. For
`not-found`, auto-switch is attempted before showing the picker (W2 auto-fix).

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

**Currently handled:** Yes — VideoCall.jsx listens, shows typed overlay with
Rejoin button for `connection-error` and permanent messages for other types.
Sentry capture on every fatal error.

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

**Currently handled:** Not listened for at all. Low priority.

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

**Currently handled:** Yes — VideoCall.jsx listens and shows a non-blocking
"Reconnecting…" banner. Sentry breadcrumb on interruption. Clears on reconnect.

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

**Currently handled:** Yes — permission revocation now shows
`PermissionDeniedGuidance` overlay proactively (W1 mid-call). Auto-reload on
re-grant works. Sentry breadcrumb logged on revocation.

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

**Currently handled:** Yes for W4 — VideoCall.jsx listens for `devicechange`
when a `not-found` device error is showing and auto-switches to the newly
available device. Speaker disappearance detection still absent (Daily has no
event for output devices).

### AudioContext `statechange`

Fires when `audioContext.state` transitions between `suspended` and `running`.

**Route to:** **W8: AudioContext suspended**

**Currently handled:** Yes — `useAudioContextMonitor` handles this fully.

---

## Proactive monitoring (heartbeat)

These are not event-driven — they require polling on a timer (e.g., every 5s).

### Track state poll

Check `callObject.localAudio()` / `callObject.localVideo()` for `readyState`:

| Condition | Route to |
|---|---|
| `audio.readyState === "ended"` | Re-acquire mic via `setInputDevicesAsync` |
| `video.readyState === "ended"` | Re-acquire camera via `setInputDevicesAsync` |

**Currently handled:** Yes — VideoCall.jsx polls every 5s. Detects ended
tracks proactively and calls `setInputDevicesAsync` to re-acquire. Sentry
breadcrumb logged on auto-recovery. (Tests: WF7-001 through WF7-003, which
use "W7" as a label for this detection path — distinct from the playbook's
W7 workflow which covers network quality UI.)

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

**Currently handled:** Yes — Sentry error-level message captured on every
Fix A/V click. (Test: WF-SENTRY-001)

---

# Part 2: Recovery workflows

Each workflow is defined once. Multiple signals can route to the same workflow.

---

## W1: Permission denied

**Triggered by:**
- `camera-error` / `mic-error` with `type = "permissions"`
- `permissions.onchange` → `"denied"` (mid-call revocation)
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

**Current implementation:** Mostly matches spec. Mid-call revocation now shows
proactive guidance overlay (not just logging). Auto-reload on re-grant works.

**Remaining gaps:**
- No test for Daily saying "permissions" when browser says "granted"
- FixAV should reuse `PermissionDeniedGuidance`

**Tests:** DEVRECOV-005, DEVRECOV-006, DEVRECOV-007, PERM-001–003,
WF1-MID-001, WF1-MID-002

---

## W2: Device not found / track lost

**Triggered by:**
- `camera-error` / `mic-error` with `type = "not-found"`
- `fatal-devices-error`
- `devicechange` showing a device disappeared
- Proactive poll finding `track.readyState === "ended"` (5s interval)
- FixAV diagnosis finding no active device

**Diagnosis:**
- `navigator.mediaDevices.enumerateDevices()` → are alternatives available?
- `navigator.permissions.query()` → is this actually a permission issue
  misclassified as not-found? If so, re-route to W1
- Which device type is affected? (camera, mic, speaker, or multiple)

**Auto-fix (before showing anything):**
- If exactly 1 alternative exists, try switching silently:
  - Camera/mic: `callObject.setInputDevicesAsync({ videoDeviceId/audioDeviceId })`
  - If succeeds, clear error — user never sees UI
- If 0 alternatives: show "no devices found" message
- If 2+ alternatives: show `DevicePicker` — let user choose

**User-prompted recovery (only if auto-fix failed or ambiguous):**
- Show `DevicePicker` with available alternatives
- User selects device, clicks "Switch to this device"

**Fallback:**
- "Reload and retry" → `window.location.reload()`
- Fix A/V button

**Current implementation:** Matches spec for camera/mic. Auto-fix before
picker is implemented (single alternative switches silently). Picker shown for
multiple alternatives. Proactive track polling implemented (5s interval).
Speaker disconnect still not detected (no Daily event for output devices).

**Remaining gaps:**
- No test or message for 0 available alternatives
- No `ondevicechange` listener for speaker disappearance detection
- No specific `fatal-devices-error` handling

**Tests:** DEVRECOV-001, DEVRECOV-002, DEVRECOV-009, DEVRECOV-010,
DEVRECOV-011, WF2-001, WF2-002, WF2-003, WF7-001, WF7-002, WF7-003,
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
- Sentry breadcrumb logged for monitoring

**User-prompted recovery (if auto-fix fails):**
- Update DevicePicker to include newly available device
- "A new device was detected — select it to reconnect"

**Current implementation:** Fully implemented. VideoCall.jsx listens for
`devicechange` when a `not-found` error is active. Enumerates devices and
auto-switches to the first available of the affected type. Only applies to
`not-found` errors (not `permissions` or `in-use` — plugging in a device
won't help those).

**Tests:** WF4-001, WF4-002, WF4-003

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
  - `connection-error`: "Connection lost" + Rejoin Call button
  - `ejected`: "Removed from call" (no rejoin — intentional by moderator)
  - `exp-room`/`exp-token`: "Session expired"
  - `meeting-full`: "Call is full"
  - `not-allowed`: "Not authorized"
- Sentry error-level capture on every fatal error

**Current implementation:** Fully implemented. `FatalErrorOverlay` component
shows typed messages for all known error types. Rejoin button calls
`callObject.join()` for `connection-error`. Sentry capture on every fatal error.

**Tests:** WF5-001, WF5-002, WF5-003, WF5-004, WF5-005

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
- **5-second grace period** before showing the banner — brief blips resolve
  silently without interrupting participant flow
- After 5s: show non-blocking banner "Reconnecting…" (yellow, above call tiles)
- Call tiles remain visible underneath (not a blocking overlay)
- Clear banner when `network-connection` with `event = "connected"` fires
- If reconnection happens within the 5s window, the banner never appears
- If no recovery after ~20s, the fatal `error` event fires → route to **W5**
- Sentry breadcrumb logged immediately on interruption (regardless of grace period)

**Current implementation:** Fully implemented. VideoCall.jsx listens for
`network-connection`, starts a 5s timer on interruption, and shows/hides the
banner. Reconnection within the grace period cancels the timer.

**Tests:** WF6-001, WF6-002, WF6-002b, WF6-003

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

**Auto-fix (3-tier matching):**
1. **Exact ID match** — preferred device found directly → use it silently
2. **Label match** — labels survive Safari ID rotation → use it silently
3. **Fallback** — preferred device not found by ID or label:
   - Show `DevicePicker` via `setDeviceError` with `dailyErrorType: "not-found"`
     so user can see which device we're switching to and choose an alternative
   - If `setInputDevicesAsync` fails on the chosen device, retry with fallback

**User impact:** Silent for exact/label matches. When fallback is needed (even
with a single alternative), shows the device picker modal so the user has
situational awareness that we're using a different device than expected.

**Design rationale:** Silent fallback can surprise users — they may not realize
their preferred device (e.g., external webcam) isn't connected and we're using
a different one (e.g., built-in laptop camera). The picker gives them that
awareness and the option to plug in their preferred device before continuing.

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
| `camera-error` | `type = "not-found"` | W2 | Yes — auto-switch if 1 alt, picker if 2+ |
| `camera-error` | `type = "cam-in-use"` | W3 | Yes |
| `camera-error` | `type = "constraints"` | W3 | Yes |
| `camera-error` | `type = "undefined-mediadevices"` | W3 | Yes |
| `camera-error` | `type = "unknown"` | W3 | Yes |
| `mic-error` | `type = "permissions"` | W1 | Yes |
| `mic-error` | `type = "not-found"` | W2 | Yes — auto-switch if 1 alt, picker if 2+ |
| `mic-error` | `type = "mic-in-use"` | W3 | Yes |
| `fatal-devices-error` | — | W2 | Partial (generic copy) |
| `error` | `connection-error` | W5 | Yes — "Connection lost" + Rejoin button |
| `error` | `ejected` | W5 | Yes — "Removed from call" |
| `error` | `exp-room` / `exp-token` | W5 | Yes — "Session expired" |
| `error` | `no-room` / `meeting-full` / `not-allowed` | W5 | Yes — typed messages |
| **`nonfatal-error`** | **`input-settings-error`** | **W2** | **Not listened for** |
| **`nonfatal-error`** | **other types** | **Log only** | **Not listened for** |
| `network-connection` | `interrupted` | W6 | Yes — "Reconnecting…" banner |
| `network-connection` | `connected` | Clear W6 UI | Yes |
| `network-quality-change` | `bad` | W7 | Logged, no UI |
| `left-meeting` | unexpected | W5 | Logged, no recovery |
| `load-attempt-failed` | — | None (Daily retries) | Not listened for (OK) |
| `cpu-load-change` | `high` | Log only | Not listened for (low priority) |

## Browser API signals

| Signal | Condition | Routes to | Handled? |
|---|---|---|---|
| `permissions.onchange` | → `"denied"` | W1 | Yes — proactive guidance overlay shown |
| `permissions.onchange` | → `"granted"` | Clear W1 UI, reload | Yes |
| `mediaDevices.devicechange` | Device appeared during error | W4 | Yes — auto-switch to new device |
| **`mediaDevices.devicechange`** | **Camera/mic disappeared** | **W2** | **Not listened for (no proactive detection)** |
| **`mediaDevices.devicechange`** | **Speaker disappeared** | **W2** | **Not listened for** |
| `audioContext.statechange` | `suspended` | W8 | Yes |
| `setSpeaker` throws | `NotAllowedError` | W9 | Yes |

## Proactive monitoring (heartbeat)

| Check | Condition | Routes to | Handled? |
|---|---|---|---|
| Track state poll (5s) | `readyState === "ended"` | Re-acquire via `setInputDevicesAsync` | Yes |
| Subscription drift (2s) | Desired ≠ actual | W10 | Yes |
| Device alignment | At join time | W11 (picker if 2+ alts) | Yes |
| Network stats | High loss / RTT | W7 | Logged, no UI |

## User-initiated

| Signal | Routes to | Handled? |
|---|---|---|
| Fix A/V button click | Diagnosis → W1/W2/W3 | Yes — Sentry error-level message on every click |

---

# Part 4: Coverage summary

## Fully implemented and tested

| Workflow | Description | Tests |
|---|---|---|
| W1 | Permission denied (at error + mid-call revocation + auto-reload) | DEVRECOV-005/006/007, PERM-001–003, WF1-MID-001/002 |
| W2 | Device not found (auto-fix + picker + proactive track poll) | DEVRECOV-009/010/011, WF2-001/002/003, WF7-001/002/003 |
| W3 | Device in-use | DEVRECOV-008 |
| W4 | Device reconnected (`devicechange` auto-recovery) | WF4-001/002/003 |
| W5 | Call disconnected (fatal error overlay + rejoin) | WF5-001/002/003/004/005 |
| W6 | Network interrupted ("Reconnecting…" banner) | WF6-001/002/003 |
| W8 | AudioContext suspended | AUDIO-001–006 |
| W9 | Safari speaker gesture | SPEAKER-001–006 |
| W10 | Subscription drift | SUB-001–006 |
| W11 | Device alignment (picker on multi-device fallback) | DEVICE-001–008 |
| — | Sentry on Fix A/V click | WF-SENTRY-001 |

## Partially implemented — need work

| Workflow | What exists | What's missing |
|---|---|---|
| W1: Permission denied (FixAV) | Generic text in FixAV modal | Should reuse `PermissionDeniedGuidance` with screenshots |
| W2: Device not found | Picker, auto-fix, proactive poll | 0-alternatives case ("plug in a device"); speaker disconnect via `devicechange` |
| W12/W13: Rejoin/Reload | Buttons exist in UI | No component tests |

## Not yet implemented

| Workflow | What needs to be built | Priority |
|---|---|---|
| W7: Network degraded UI | Show subtle "poor connection" indicator on `network-quality-change = "bad"` | Low |
| `nonfatal-error` listener | Listen for `input-settings-error`, route to W2 | Low |
| `cpu-load-change` listener | Log, possibly reduce quality | Low |
| Proactive speaker disconnect | `devicechange` listener to detect when speaker is unplugged | Low |

---

# Part 5: Test plan

Tests cover two dimensions independently:

## Detection tests

"When signal X fires, the correct workflow is triggered."

| Test | Signal | Expected routing |
|---|---|---|
| DET-001 | `camera-error` type=permissions | W1 overlay shown |
| DET-002 | `camera-error` type=not-found, 1 alt available | W2 auto-switch, no UI |
| DET-003 | `camera-error` type=not-found, 2+ alts | W2 picker shown |
| DET-004 | `camera-error` type=cam-in-use | W3 generic guidance shown |
| DET-005 | `mic-error` type=permissions | W1 overlay shown |
| DET-006 | `mic-error` type=not-found | W2 picker/auto-switch |
| DET-007 | `fatal-devices-error` | W2 triggered |
| DET-008 | `error` type=connection-error | W5 "connection lost" shown |
| DET-009 | `error` type=ejected | W5 "removed" shown |
| DET-010 | `error` type=exp-room | W5 "expired" shown |
| DET-011 | `network-connection` interrupted | W6 "reconnecting" shown |
| DET-012 | `network-connection` connected | W6 banner cleared |
| DET-013 | `permissions.onchange` → denied | W1 overlay shown proactively |
| DET-014 | `permissions.onchange` → granted | Auto-reload |
| DET-015 | `devicechange` during not-found error | W4 auto-retry |
| DET-016 | Track poll — readyState ended | `setInputDevicesAsync` called |
| DET-017 | Fix A/V click | Sentry error logged |

## Workflow tests

"Given this diagnosis, the recovery sequence works end-to-end."

| Test | Workflow | Scenario |
|---|---|---|
| WF-001 | W1 | Permission denied → guidance shown with correct browser image |
| WF-002 | W1 | Permission re-granted → auto-reload |
| WF1-MID-001 | W1 | Mid-call permission revocation → proactive overlay |
| WF1-MID-002 | W1 | Mid-call re-grant → auto-reload |
| WF2-001 | W2 | Camera not-found, 1 alt → auto-switch silently |
| WF2-002 | W2 | Mic not-found, 1 alt → auto-switch silently |
| WF2-003 | W2 | Camera not-found, 2+ alts → picker shown |
| WF4-001 | W4 | Camera error + devicechange → auto-switch, overlay clears |
| WF4-002 | W4 | Mic error + devicechange → auto-switch, overlay clears |
| WF4-003 | W4 | Non-not-found error + devicechange → no auto-recovery |
| WF5-001 | W5 | connection-error → "Connection lost" + rejoin button |
| WF5-002 | W5 | Ejected → "Removed from call", no rejoin |
| WF5-003 | W5 | exp-room → "Session expired" |
| WF5-004 | W5 | Rejoin button calls `callObject.join()` |
| WF5-005 | W5 | Fatal error sends Sentry capture |
| WF6-001 | W6 | Network interrupted → banner visible, call tiles visible |
| WF6-002 | W6 | Network reconnected → banner clears |
| WF6-003 | W6 | Interruption sends Sentry breadcrumb |
| WF7-001 | W2 detect | Ended audio track → `setInputDevicesAsync` called |
| WF7-002 | W2 detect | Ended video track → `setInputDevicesAsync` called |
| WF7-003 | W2 detect | Track auto-recovery → Sentry breadcrumb logged |
| WF-SENTRY-001 | — | Fix A/V click → Sentry error-level message |

## Existing tests mapped

| Old ID | Coverage |
|---|---|
| DEVRECOV-001/002 | Device error fires, overlay + Fix A/V accessible |
| DEVRECOV-003/004 | Dismiss button clears overlay, restores call tiles |
| DEVRECOV-005/006 | Permission denied guidance with browser-specific image |
| DEVRECOV-007 | Auto-reload on permissions re-grant |
| DEVRECOV-008 | Device in-use guidance |
| DEVRECOV-009/010 | Picker shown for not-found (2+ alts) |
| DEVRECOV-011 | Switch device from picker clears error |
| PERM-001–003 | Permission change detection |
| AUDIO-001–006 | W8: AudioContext fully covered |
| SPEAKER-001–006 | W9: Safari gesture fully covered |
| SUB-001–006 | W10: Subscription drift fully covered |
| DEVICE-001–008 | W11: Device alignment fully covered |
