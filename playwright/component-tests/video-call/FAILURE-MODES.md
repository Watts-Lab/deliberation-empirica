# Video Call Failure Mode Analysis

This document enumerates every way a Daily.co video call can fail, maps current test coverage,
and identifies gaps. The goal is to make sure every failure mode has a defined recovery path
and a test that would catch a regression.

Last updated: 2026-03-03 (Issue #1190 — speaker disconnect picker added)

---

## What must go right for a call to succeed

1. A valid Daily room URL is provisioned by the server
2. The browser can reach Daily's network (ICE/TURN servers)
3. Camera/mic hardware is present and not in use by another app
4. The OS has granted permission to access camera/mic
5. The browser has granted permission to access camera/mic
6. The browser's AudioContext is not suspended by autoplay policy
7. The correct input and output devices are selected (not a wrong/absent device)
8. Local tracks are published and remote tracks are subscribed
9. The tab was focused (or briefly focused) during the join handshake — Firefox
10. The call remains joined as the user navigates between experiment stages

---

## Failure mode taxonomy

### 1. Pre-join: room provisioning and network

| Failure                     | Recovery                                        | Test coverage | Gap? |
| --------------------------- | ----------------------------------------------- | ------------- | ---- |
| No room URL from server     | Game waits; researcher must check server config | None          | Yes  |
| Room URL expired or invalid | None — Daily join fails silently                | None          | Yes  |
| No network / ICE failure    | Daily shows its own error UI                    | None          | Yes  |

### 2. Device acquisition at join time

| Failure                              | Recovery                                                 | Test ID      | Gap?    |
| ------------------------------------ | -------------------------------------------------------- | ------------ | ------- |
| Camera permission denied by browser  | Browser-specific guidance shown (screenshot per browser) | DEVRECOV-005 | No      |
| Mic permission denied by browser     | Browser-specific guidance shown                          | DEVRECOV-005 | No      |
| Camera not found (device absent)     | Device picker with available alternatives                | DEVRECOV-009 | No      |
| Mic not found (device absent)        | Device picker with available alternatives                | DEVRECOV-010 | No      |
| Selecting device from picker         | `setInputDevicesAsync` called, error cleared             | DEVRECOV-011 | No      |
| Device in-use by another app         | Generic recovery steps shown                             | DEVRECOV-008 | No      |
| Speaker/output not found at join     | Device picker shown (same path as mid-call disconnect)   | DEVRECOV-015 | No      |

### 3. Mid-call device disconnection

The original failure in Issue #1190 is in this category.

| Failure                                                   | Recovery                                         | Test ID              | Gap?    |
| --------------------------------------------------------- | ------------------------------------------------ | -------------------- | ------- |
| Camera disconnected → `camera-error` event                | Fix A/V accessible; device picker for not-found  | DEVRECOV-001/009/011 | No      |
| Mic disconnected → `mic-error` event                      | Fix A/V accessible; device picker for not-found  | DEVRECOV-002/010/011 | No      |
| Speaker/output disconnected (e.g., monitor unplugged)     | Device picker shown via alignSpeaker() fallback  | DEVRECOV-015/016     | No      |
| **`fatal-devices-error` event**                           | **Not handled**                                  | **None**             | **Yes** |
| Device reconnected (same or replacement)                  | Not handled — no "device reconnected" listener   | None                 | Yes     |
| Reload-and-retry fails after device error                 | Reported broken in Issue #1190                   | None                 | Yes     |
| Normal browser refresh fails to recover                   | Reported broken in Issue #1190                   | None                 | Yes     |

### 4. Mid-call track state degradation

These happen without a device-disconnect event (e.g., OS-level interruption, browser suspension).

| Failure                             | Recovery                               | Test ID             | Gap?    |
| ----------------------------------- | -------------------------------------- | ------------------- | ------- |
| Mic track `readyState = 'ended'`    | FixAV diagnoses and re-acquires device | FIXAV-006           | No      |
| Camera track `readyState = 'ended'` | FixAV diagnoses and re-acquires device | FIXAV-008           | No      |
| Mic muted at Daily API level        | FixAV diagnoses and unmutes            | FIXAV-005           | No      |
| Camera muted at Daily API level     | FixAV diagnoses and unmutes            | FIXAV-007           | No      |
| Track blocked by browser            | Logged; Fix A/V escalates              | PERM-006 (deferred) | Partial |

### 5. AudioContext suspension (autoplay policy)

| Failure                                             | Recovery                                   | Test ID               | Browser           |
| --------------------------------------------------- | ------------------------------------------ | --------------------- | ----------------- |
| AudioContext suspended at page load                 | "Enable Audio" banner; auto-retry every 5s | AUDIO-001/002/003/004 | Safari primarily  |
| AudioContext suspended when tab unfocused           | Auto-resume on tab focus                   | AUDIO-006             | Firefox primarily |
| Safari `setSpeaker` requires user gesture           | Gesture prompt shown; retry on click       | SPEAKER-001 to 006    | Safari only       |
| Firefox WebRTC stall when tab unfocused during join | Overlay shown; auto-dismiss on focus       | Issue #1187 (fixed)   | Firefox only      |

### 6. Browser permission changes mid-call

| Failure                              | Recovery                               | Test ID      | Gap? |
| ------------------------------------ | -------------------------------------- | ------------ | ---- |
| Camera permission revoked by user    | Warning logged; Fix A/V shows guidance | PERM-001/003 | No   |
| Mic permission revoked by user       | Warning logged; Fix A/V shows guidance | PERM-002/003 | No   |
| Permissions re-granted → auto-reload | Page reloads automatically             | DEVRECOV-007 | No   |

### 7. Subscription drift

Remote participants may stop receiving your audio/video if Daily's internal state drifts.

| Failure                                  | Recovery                                        | Test ID        | Gap? |
| ---------------------------------------- | ----------------------------------------------- | -------------- | ---- |
| Subscription state drifts from desired   | Heartbeat detects; `updateParticipants` repairs | SUB-001 to 006 | No   |
| Track not yet subscribable               | Repair skipped until track ready                | SUB-005        | No   |
| **Consecutive repair attempts too fast** | 3s cooldown enforced                            | SUB-004        | No   |

### 8. Device alignment (Safari device ID rotation)

Safari rotates device IDs for privacy after reboot, breaking stored preferences.

| Failure                          | Recovery                 | Test ID        | Gap? |
| -------------------------------- | ------------------------ | -------------- | ---- |
| Stored device ID no longer valid | Label-match fallback     | DEVICE-001/002 | No   |
| Label also unavailable           | Fallback to first device | DEVICE-003     | No   |
| No devices available at all      | No-op, no crash          | DEVICE-005     | No   |

### 9. Network degradation

| Failure                         | Recovery                                 | Test ID                | Gap? |
| ------------------------------- | ---------------------------------------- | ---------------------- | ---- |
| High packet loss detected       | `avRecovery` can surface in diagnostics  | None (unit-level only) | Yes  |
| High RTT detected               | Surfaced in FixAV diagnostic report      | None (unit-level only) | Yes  |
| Network drops entirely mid-call | Not handled — Daily reconnect not tested | None                   | Yes  |

---

## Browser-specific differences

| Failure mode                | Chrome | Firefox           | Safari            |
| --------------------------- | ------ | ----------------- | ----------------- |
| AudioContext suspension     | Rare   | On tab blur       | Always at load    |
| setSpeaker / setSinkId      | Works  | Works             | Requires gesture  |
| Device ID rotation          | Stable | Stable            | Rotates on reboot |
| WebRTC stall on tab blur    | No     | Yes (Issue #1187) | No                |
| Permission revoke mid-call  | Tested | Tested            | Tested            |
| Device picker on disconnect | Tested | Tested            | Tested            |

All DEVRECOV, AUDIO, SPEAKER, PERM, SUB tests run across chromium, firefox, and webkit.

---

## Key open questions (Issue #1190)

1. ~~**What event does Daily fire when an audio output device (e.g., a monitor) is disconnected?**~~
   **Answered**: Daily fires NO event for speaker/output disconnection. The OS silently
   re-routes to the next available device. Detection is only possible via `alignSpeaker()`
   noticing a fallback match (preferred device gone). Fixed in DEVRECOV-015/016.

2. **Why does "Reload and Retry" not work after the monitor-unplug scenario?**
   This is the most severe gap — the recovery path itself is broken. Possible causes:

   - The error leaves the Daily call object in a bad state that survives reload
   - Empirica game state was corrupted by the error path
   - The "Reload and Retry" button doesn't actually trigger a full page reload

3. **Why does a normal browser refresh also fail to recover?**
   Suggests the problem persists in server-side or Daily session state, not just
   client-side React state.

4. **Is `fatal-devices-error` ever fired, and is it handled?**
   The event is referenced in VideoCall.jsx but has no component test coverage.

---

## Coverage summary

| Category                        | Tests exist         | Fully covered |
| ------------------------------- | ------------------- | ------------- |
| Pre-join provisioning & network | No                  | No            |
| Permission denied at join       | Yes                 | Yes           |
| Device not found at join        | Yes                 | Yes           |
| Speaker/output disconnect       | Yes (DEVRECOV-015/016) | Yes        |
| Camera/mic mid-call disconnect  | Yes                 | Yes           |
| `fatal-devices-error`           | No                  | No            |
| Device reconnection             | No                  | No            |
| Track ended / degraded          | Yes                 | Yes           |
| AudioContext suspension         | Yes                 | Yes           |
| Safari speaker gesture          | Yes                 | Yes           |
| Firefox join stall              | Fixed (#1187)       | Yes           |
| Permission revoked mid-call     | Yes                 | Yes           |
| Subscription drift              | Yes                 | Yes           |
| Safari device ID rotation       | Yes                 | Yes           |
| Network degradation             | Partial (unit only) | No            |
