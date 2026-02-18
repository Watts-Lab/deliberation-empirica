# Video Call Test Plan

This document outlines the tests needed to verify video call functionality based on recent PRs and bug fixes. Tests are categorized by testing strategy:

- **Component (Mocked)**: Playwright component tests with fully mocked Daily.co
- **Component (Integration)**: Playwright component tests with real Daily.co API
- **E2E**: Full end-to-end Cypress tests with server and multiple browser instances

---

## 1. Safari Device ID Rotation Handling

**Related**: PR #1170, Issue #1169

Safari rotates device IDs for privacy, causing users to lose preferred device selections after page refresh. The fix implements a 3-tier device matching strategy: ID match → Label match → Fallback.

### Tests Needed

#### Component (Mocked)
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| DEVICE-001 | ID match succeeds | `preferredMicId` matches available device | Uses exact device, logs "id" match type |
| DEVICE-002 | Label match fallback | `preferredMicId` doesn't match, but `preferredMicLabel` matches | Uses label-matched device, logs "label" match type |
| DEVICE-003 | Fallback to first device | Neither ID nor label match | Uses first available device, logs "fallback" match type |
| DEVICE-004 | Device labels stored during setup | Complete camera/mic/speaker setup | `cameraLabel`, `micLabel`, `speakerLabel` saved to player |
| DEVICE-005 | Handles empty device arrays | No microphones available | Graceful no-op, no errors |
| DEVICE-006 | Handles duplicate labels | Multiple devices with same label | Uses first match |
| DEVICE-007 | Skips alignment when "waiting" | `preferredMicId === "waiting"` | Does not attempt alignment |
| DEVICE-008 | Skips alignment for current device | Already using target device | No redundant calls to setInputDevicesAsync |

#### Component (Integration)
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| DEVICE-INT-001 | Real device alignment on join | Player has stored device preferences | Devices aligned correctly after joining Daily room |

#### E2E
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| DEVICE-E2E-001 | Device persistence across stages | User completes setup, proceeds through multiple stages | Preferred devices used on each stage |

---

## 2. Safari AudioContext Suspension Recovery

**Related**: PR #1161, PR #1158, Issue #1159

Safari's autoplay policy causes AudioContext to be suspended by default, preventing audio playback. The fix adds proactive monitoring, auto-recovery attempts, and a user-facing prompt.

### Tests Needed

#### Component (Mocked)
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| AUDIO-001 | Detects suspended AudioContext | Mock AudioContext with `state: 'suspended'` | `useAudioContextMonitor` reports suspended state |
| AUDIO-002 | Shows enable audio banner | AudioContext suspended | Banner displayed with "Enable Audio" button |
| AUDIO-003 | Resume on button click | User clicks "Enable Audio" | `audioContext.resume()` called, banner disappears |
| AUDIO-004 | Auto-resume attempts | AudioContext suspended, periodic interval fires | `resume()` attempted automatically |
| AUDIO-005 | No banner when running | AudioContext state is 'running' | No banner displayed |
| AUDIO-006 | Logs state changes | AudioContext state transitions | Console logs and Sentry breadcrumbs recorded |

#### Component (Integration)
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| AUDIO-INT-001 | Real AudioContext integration | Join Daily call, check AudioContext state | AudioContext resumes properly after user interaction |

---

## 3. Safari Speaker Gesture Requirements

**Related**: PR #1181, Issue #1179

Safari requires a user gesture for `setSinkId` (speaker selection). The fix implements a unified setup completion prompt.

### Tests Needed

#### Component (Mocked)
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| SPEAKER-001 | Detects NotAllowedError on setSinkId | Mock `setOutputDevice` to throw `NotAllowedError` | Pending operation tracked, prompt shown |
| SPEAKER-002 | Shows unified prompt | Multiple operations pending (speaker + AudioContext) | Single "Enable Audio" prompt, not multiple |
| SPEAKER-003 | Batches operations on click | User clicks "Enable Audio" with multiple pending ops | All operations retried in single `Promise.all` |
| SPEAKER-004 | Clears pending state on success | Retry succeeds | Prompt disappears, pendingGestureOperations cleared |
| SPEAKER-005 | No prompt when operations succeed | Browser allows operations without gesture | No prompt shown |
| SPEAKER-006 | Logs to Sentry | Operation requires gesture | Sentry message with operation details |

---

## 4. Intelligent A/V Issue Diagnosis and Targeted Fixes

**Related**: PR #1171, Issue #1166

Replaces immediate page reload with diagnosis → targeted soft fix → escalation approach.

### Tests Needed

#### Component (Mocked)
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| FIXAV-001 | Modal opens on Fix A/V click | User clicks Fix Audio/Video button | Modal with issue checkboxes displayed |
| FIXAV-002 | Can select multiple issues | User checks multiple checkboxes | Multiple issues tracked in state |
| FIXAV-003 | Diagnose "can't hear" - AudioContext | Report "can't hear", AudioContext suspended | Diagnosis shows AudioContext as root cause |
| FIXAV-004 | Diagnose "can't hear" - speaker not set | Report "can't hear", no speaker device | Diagnosis shows speaker alignment needed |
| FIXAV-005 | Diagnose "others can't hear me" - mic muted | Report issue, mic track muted | Diagnosis shows mic muted, attempts unmute |
| FIXAV-006 | Diagnose "others can't hear me" - mic ended | Report issue, mic track readyState 'ended' | Diagnosis shows mic re-acquisition needed |
| FIXAV-007 | Diagnose "others can't see me" - camera off | Report issue, camera muted | Diagnosis shows camera toggle needed |
| FIXAV-008 | Diagnose "others can't see me" - camera ended | Report issue, camera readyState 'ended' | Diagnosis shows camera re-acquisition needed |
| FIXAV-009 | Shows "unfixable" for remote issues | Report "can't hear", remote participant audio off by user | Shows "This appears to be on the other participant's side" |
| FIXAV-010 | Soft fix attempts before escalation | Fixable issue diagnosed | Targeted fix attempted before showing Rejoin/Reload |
| FIXAV-011 | Validation after fix | Soft fix applied | Re-collects diagnostics, compares before/after |
| FIXAV-012 | Shows escalation options on failure | Soft fix doesn't resolve issue | "Rejoin Call" and "Reload Page" buttons shown |
| FIXAV-013 | Rejoin Call preserves devices | User clicks "Rejoin Call" | Leaves and rejoins without page reload |
| FIXAV-014 | Auto-close on success | Soft fix resolves issue | Modal auto-closes |

#### Unit Tests (avRecovery.js)
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| AVREC-001 | diagnoseIssue returns ranked causes | Various diagnostic states | Correct root causes identified with confidence |
| AVREC-002 | attemptSoftFix calls correct recovery | Each root cause type | Appropriate recovery function invoked |
| AVREC-003 | validateFix detects improvement | Before/after diagnostics | Returns true only when issue resolved |

---

## 5. Cross-Participant Diagnostic Logging

**Related**: PR #1158, Issue #1155

When participant reports A/V issue, automatically capture diagnostics from roommates.

### Tests Needed

#### Component (Mocked)
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| DIAG-001 | Generates unique avIssueId | User reports issue | UUID-style issueId created |
| DIAG-002 | Requests diagnostics from roommates | User reports issue, 2 roommates present | `avDiagnosticRequests` set on roommate players |
| DIAG-003 | Roommate auto-responds | Request set on player object | Diagnostics captured and sent to Sentry |
| DIAG-004 | Rate limiting works | Multiple requests within 60s | Only first request processed |
| DIAG-005 | Stale requests ignored | Request older than 5 seconds | Request ignored, flag cleared |
| DIAG-006 | Reports linked by avIssueId | Reporter + roommates respond | All reports have same avIssueId tag |
| DIAG-007 | Silent operation | Auto-diagnostic triggered | No UI feedback to user |

#### E2E
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| DIAG-E2E-001 | Cross-participant flow | P1 reports issue, P2 in same room | Both diagnostics sent to Sentry with same issueId |

---

## 6. Browser Permission Monitoring

**Related**: PR #1157, Issue #1154

Continuous monitoring of browser permissions during call.

### Tests Needed

#### Component (Mocked)
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| PERM-001 | Monitors camera permission changes | Mock permission change event | Console warning logged |
| PERM-002 | Monitors mic permission changes | Mock permission change event | Console warning logged |
| PERM-003 | Error logged on denial | Permission changes to 'denied' | Console error with clear message |
| PERM-004 | Permissions in error reports | User submits Fix A/V | `browserPermissions` field in Sentry report |
| PERM-005 | Daily permissions captured | Participant state checked | `owner` and `permissions` in participant summary |
| PERM-006 | Blocked tracks detected | Remote track becomes blocked | Warning logged immediately |

---

## 7. Subscription Reliability and State Tracking

**Related**: PR #1132, Issue #1131, PR #1134

Fixes flakiness where participants fail to see/hear each other due to subscription state drift.

### Tests Needed

#### Component (Mocked)
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| SUB-001 | Compares actual vs desired state | Subscription state drifted | Mismatch detected |
| SUB-002 | Repairs drifted subscriptions | Actual != desired | `updateParticipants` called to fix |
| SUB-003 | Heartbeat interval checks | 2 seconds elapsed | Re-check triggered |
| SUB-004 | Cooldown after repair | Just attempted repair | Waits 3 seconds before next repair attempt |
| SUB-005 | Only subscribes to subscribable tracks | Track not ready | Skips subscription until track ready |
| SUB-006 | Logs repair events | Repair triggered | "[Subscription Fix]" logged with details |

#### Component (Integration)
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| SUB-INT-001 | Two participants subscribe | Two browsers join room | Both see each other's video/audio |
| SUB-INT-002 | Late joiner gets subscribed | P1 joins, waits, P2 joins | P2 subscribed to P1 and vice versa |

#### E2E
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| SUB-E2E-001 | Room transitions | Participants move between rooms | Subscriptions update correctly |
| SUB-E2E-002 | Multi-round subscriptions | 6 participants, rotating pairs | All subscription changes successful |

---

## 8. Self-View Display

**Related**: PR #1134

Self-view was incorrectly showing "Waiting for participant to connect..."

### Tests Needed

#### Component (Mocked)
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| SELF-001 | Self-view shows video | Local participant with camera on | Video displayed, not "Waiting..." |
| SELF-002 | Self-view shows "Video Muted" | Local participant, camera off | Shows "Video Muted" not "Waiting..." |
| SELF-003 | Skips subscription check for local | Local tile rendered | No subscription check performed |
| SELF-004 | Remote tile shows "Waiting" correctly | Remote participant, not yet subscribed | Shows "Waiting for participant..." |

---

## 9. Tile UI States

**Related**: PR #1132, PR #1134

Correct UI states for different participant conditions.

### Tests Needed

#### Component (Mocked)
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| TILE-001 | Shows video when playable | `videoState.state === 'playable'` | Video element visible |
| TILE-002 | Shows "Video Muted" when off | `videoState.isOff && subscribed` | "Video Muted" overlay |
| TILE-003 | Shows "Waiting" when unsubscribed | `!subscribed` | "Waiting for participant..." |
| TILE-004 | Shows audio muted badge | `audioState.isOff` | Mute icon overlay |
| TILE-005 | Shows nickname when enabled | `showNickname={true}` | Nickname displayed |

---

## 10. Device Alignment Log Spam Prevention

**Related**: PR #1135

Prevents console spam when preferred device not available.

### Tests Needed

#### Component (Mocked)
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| LOG-001 | Logs once per unavailable device | Device unavailable, multiple renders | Only one log message |
| LOG-002 | Waits for device list population | Device list initially empty | No premature "not available" logs |
| LOG-003 | Logs available devices | Device not found | Log includes list of available device IDs |

---

## 11. A/V Error Reporting and Diagnostics

**Related**: PR #1146, PR #1140

Enhanced diagnostic data capture for A/V issues.

### Tests Needed

#### Component (Mocked)
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| ERR-001 | Captures Daily event payload | Camera error occurs | Full event payload in Sentry |
| ERR-002 | Extracts Daily error type | Different error types | Correct type (not-found, permissions, in-use) |
| ERR-003 | Includes track off/blocked reasons | Various track states | `off` and `blocked` reasons captured |
| ERR-004 | Includes audioDevices info | A/V report submitted | Current mic/camera, output count in report |
| ERR-005 | Includes networkStats | A/V report submitted | RTT, packet loss, bitrate data captured |
| ERR-006 | Includes audioContextState | A/V report submitted | AudioContext state in report |
| ERR-007 | Summary field for easy scanning | A/V report submitted | One-line summary at top of extra data |

---

## 12. Tray UI and Button Layout

**Related**: PR #1140

Responsive tray button layout improvements.

### Tests Needed

#### Component (Mocked)
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| TRAY-001 | Fix A/V button visible | VideoCall rendered | "Fix Audio/Video" button in tray |
| TRAY-002 | Camera toggle works | Click camera button | Camera toggles on/off |
| TRAY-003 | Mic toggle works | Click mic button | Mic toggles on/off |
| TRAY-004 | Buttons responsive on narrow screens | Viewport < 640px | Buttons wrap correctly, no overflow |
| TRAY-005 | Icon sizes consistent | Various buttons | All icons properly sized |
| TRAY-006 | Missing Participant button works | Click button | Report modal opens |

---

## 13. DailyId History Logging

**Related**: PR #1126

Logs dailyId changes to correlate video call segments with stages.

### Tests Needed

#### Component (Mocked)
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| HISTORY-001 | Logs dailyId on join | Join Daily room | Entry added to dailyIdHistory |
| HISTORY-002 | Entry includes timestamp | DailyId logged | Entry has timestamp field |
| HISTORY-003 | Entry includes progressLabel | DailyId logged | Entry has progressLabel field |
| HISTORY-004 | Multiple entries for stage changes | Multiple stages with video | Multiple entries in history |

#### E2E
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| HISTORY-E2E-001 | Exported in science data | Complete game session | dailyIdHistory in JSONL export |

---

## 14. Player Data Logging for A/V Issues

**Related**: PR #1161

Logs A/V reports and diagnostic responses to player data for research analysis.

### Tests Needed

#### Component (Mocked)
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| PDATA-001 | avReports array populated | User reports issue | Entry added to player.avReports |
| PDATA-002 | Report includes all fields | A/V report created | issues, stage, timestamp, avIssueId, audioContextState, meetingState |
| PDATA-003 | avDiagnosticResponses populated | Auto-diagnostic triggered | Entry added to player.avDiagnosticResponses |
| PDATA-004 | Response includes reporter info | Auto-diagnostic created | reporterPosition, reportedIssues fields present |

#### E2E
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| PDATA-E2E-001 | Exported in science data | A/V issue reported during session | avReports and avDiagnosticResponses in export |

---

## 15. AGC (Auto Gain Control) Configuration

**Related**: PR #1164

Disables browser autoGainControl to test audio quality.

### Tests Needed

#### Component (Integration)
| Test ID | Description | Conditions | Expected Result |
|---------|-------------|------------|-----------------|
| AGC-INT-001 | AGC disabled in constraints | Join Daily call | autoGainControl: false in media constraints |
| AGC-INT-002 | Echo cancellation still enabled | Check constraints | echoCancellation: true |
| AGC-INT-003 | Noise suppression still enabled | Check constraints | noiseSuppression: true |

---

## Test Implementation Priority

### High Priority (Core Functionality)
1. SUB-001 through SUB-006 - Subscription reliability
2. TILE-001 through TILE-005 - Tile display states
3. SELF-001 through SELF-004 - Self-view
4. DEVICE-001 through DEVICE-008 - Device alignment
5. FIXAV-001 through FIXAV-014 - A/V diagnosis flow

### Medium Priority (Error Recovery)
6. AUDIO-001 through AUDIO-006 - AudioContext handling
7. SPEAKER-001 through SPEAKER-006 - Safari speaker gestures
8. PERM-001 through PERM-006 - Permission monitoring
9. DIAG-001 through DIAG-007 - Cross-participant diagnostics

### Lower Priority (Logging/Analytics)
10. ERR-001 through ERR-007 - Error reporting
11. LOG-001 through LOG-003 - Log spam prevention
12. HISTORY-001 through HISTORY-004 - DailyId history
13. PDATA-001 through PDATA-004 - Player data logging
14. TRAY-001 through TRAY-006 - Tray UI

---

## Mock Requirements

### Mocked Daily.co (for Component tests)
- `callObject.participants()` - return mocked participant states
- `callObject.setInputDevicesAsync()` - mock device selection
- `callObject.setOutputDevice()` - mock with optional NotAllowedError
- `callObject.updateParticipants()` - mock subscription updates
- `callObject.getNetworkStats()` - mock network stats
- `callObject.meetingState()` - mock meeting state transitions
- `useDaily()`, `useLocalSessionId()`, `useParticipantIds()` hooks

### Mocked Browser APIs
- `navigator.mediaDevices.enumerateDevices()` - mock device list
- `navigator.permissions.query()` - mock permission states
- `AudioContext` - mock with controllable state
- `setSinkId` - mock with optional NotAllowedError

### Mocked Empirica
- `usePlayer()`, `usePlayers()` - mock player data
- `player.get()`, `player.set()` - mock state operations

### Mocked Sentry
- `Sentry.captureMessage()` - verify calls and parameters
- `Sentry.captureException()` - verify calls and parameters

---

## Notes on Test Strategy

### Why Component (Integration) Tests?
Some behaviors require real Daily.co API interactions to properly verify:
- Actual WebRTC connection establishment
- Real track subscription states
- Device enumeration with real hardware (or virtual devices)
- Network stats from actual connections

### Why E2E Tests?
Multi-participant scenarios require:
- Multiple browser instances
- Real server-side Empirica state
- Cross-browser communication
- Stage transitions with video call state preservation

### Safari-Specific Testing
Many features specifically address Safari behaviors:
- Device ID rotation
- AudioContext autoplay policy
- setSinkId user gesture requirement

Consider running integration tests on Safari via BrowserStack/Sauce Labs, or use feature detection mocks that simulate Safari behavior.

---

## Test Validation Plan

Since we're writing tests after the fixes were implemented (not TDD), we need strategies to ensure our tests would actually catch regressions if the bugs reappeared.

### 1. Mutation Testing (Manual)

For each test, temporarily revert or break the specific fix and verify the test fails:

```bash
# Example: For device alignment tests
git stash
git checkout <commit-before-fix> -- client/src/call/utils/deviceAlignment.js
npm run test:ct  # Should fail
git checkout -- client/src/call/utils/deviceAlignment.js
git stash pop
```

**Commits to revert for validation:**

| Feature | File(s) | Pre-fix Commit |
|---------|---------|----------------|
| Device alignment | `deviceAlignment.js` | Before PR #1170 |
| AudioContext monitor | `useAudioContextMonitor.js` | Before PR #1161 |
| Subscription repair | `Call.jsx` | Before PR #1132 |
| Self-view fix | `Tile.jsx` | Before PR #1134 |
| A/V recovery | `avRecovery.js`, `FixAV.jsx` | Before PR #1171 |

### 2. Test the Bug Condition, Not Just Current Behavior

Instead of testing "does the code work", test "does this specific failure mode get caught".

**Bad example** (confirms current behavior):
```javascript
test('shows banner when AudioContext suspended', async () => {
  // mount component, check banner exists
});
```

**Good example** (tests the bug condition):
```javascript
test('AudioContext suspended prevents audio - banner enables recovery', async () => {
  // 1. Mock AudioContext in suspended state
  // 2. Verify audio would NOT play (the bug condition)
  // 3. Verify banner appears (the detection)
  // 4. Click banner
  // 5. Verify resume() called (the fix)
  // 6. Verify audio WOULD play now (the resolution)
});
```

### 3. Use Real Sentry Data as Test Fixtures

Several PRs include actual diagnostic dumps from real failures. Use these as test fixtures:

```javascript
// From Issue #1159 - actual Safari AudioContext bug state
const safariAudioContextBugState = {
  meetingState: 'joining-meeting',
  audioContextState: 'suspended',
  localMediaState: {
    audioTrack: { state: 'interrupted' },
    videoTrack: { state: 'interrupted' }
  },
  browserPermissions: { camera: 'granted', microphone: 'granted' }
};

// From Issue #1131 - subscription drift state
const subscriptionDriftState = {
  desired: { audio: true, video: true },
  actual: {
    tracks: {
      audio: { subscribed: false },
      video: { subscribed: true }
    }
  }
};
```

### 4. Adversarial Test Review Checklist

For each test, answer these questions:

- [ ] "What bug would slip through if I deleted this assertion?"
- [ ] "Could the code pass this test while still being broken?"
- [ ] "Does this test the implementation detail or the user-facing behavior?"
- [ ] "If I reverted the fix, would this test fail?"
- [ ] "Does this test cover the exact condition from the original bug report?"

### 5. Boundary Conditions from PRs

The PRs document specific edge cases. Ensure tests cover boundaries, not just happy paths:

| Feature | Happy Path | Boundaries to Test |
|---------|------------|-------------------|
| Device alignment | ID matches | ID missing + label matches, both missing, duplicate labels, empty arrays |
| Subscription repair | Works first try | Needs retry, track not ready, cooldown period active |
| A/V diagnosis | Single issue | Multiple issues, unfixable issues, partial fixes, all issues unfixable |
| Auto-diagnostics | Request processed | Rate limited (60s), stale request (>5s), multiple simultaneous requests |
| AudioContext | Running state | Suspended, closed, resume fails, resume succeeds after retry |

### 6. Time-Based Behavior Testing

Several features have timing components that are easy to miss:

| Feature | Timing Requirement | How to Test |
|---------|-------------------|-------------|
| Auto-diagnostics rate limit | 60 seconds between reports | Use `vi.useFakeTimers()`, advance by 59s (should block), then 61s (should allow) |
| Stale request threshold | Ignore requests > 5 seconds old | Create request with `Date.now() - 6000` timestamp |
| Subscription repair cooldown | 3 seconds after repair attempt | Mock timer, verify no repair at 2s, repair allowed at 4s |
| Heartbeat interval | Re-check every 2 seconds | Verify reconciliation runs after 2s interval |
| AudioContext auto-resume | Retry every 5 seconds | Verify multiple resume attempts with interval |

```javascript
// Example: Testing rate limiting
test('rate limits auto-diagnostics to once per 60 seconds', async () => {
  vi.useFakeTimers();

  // First request should be processed
  await triggerDiagnosticRequest();
  expect(sentryCapture).toHaveBeenCalledTimes(1);

  // Request at 30s should be blocked
  vi.advanceTimersByTime(30000);
  await triggerDiagnosticRequest();
  expect(sentryCapture).toHaveBeenCalledTimes(1); // Still 1

  // Request at 61s should be allowed
  vi.advanceTimersByTime(31000);
  await triggerDiagnosticRequest();
  expect(sentryCapture).toHaveBeenCalledTimes(2); // Now 2

  vi.useRealTimers();
});
```

### 7. Implementation Order for Validation

For each feature area, follow this workflow:

1. **Read the original issue** - understand the user-reported symptom
2. **Read the PR discussion** - understand the root cause analysis
3. **Identify the pre-fix commit** - for mutation testing
4. **Write a failing test first** by temporarily reverting the fix
5. **Re-enable the fix** and verify the test passes
6. **Document the bug condition** in the test description

### 8. Suggested Implementation Order

Start with areas where mutation testing is easiest:

1. **`avRecovery.js` unit tests** - Pure functions, easy to mutate, already has test file
2. **`deviceAlignment.js` tests** - Already has 21 tests, extend with Sentry fixture data
3. **Tile/subscription component tests** - Visual output, can verify by breaking CSS/logic
4. **Safari-specific mocked tests** - Hardest to validate without real Safari

### 9. Integration Test Validation

For Daily.co integration tests, we can't easily "break" the external service, but we can:

- Test with intentionally wrong room tokens (should fail gracefully)
- Test with simulated network disconnection (Playwright can throttle/disconnect)
- Test permission denied scenarios (can be mocked at browser level)
- Compare behavior between Chrome and Safari (if using BrowserStack)

### 10. Validation Checklist per Test

Before marking a test as complete:

- [ ] Test fails when fix is reverted (mutation tested)
- [ ] Test uses realistic fixture data (ideally from actual Sentry reports)
- [ ] Test covers the exact symptom from the original bug report
- [ ] Test includes boundary conditions, not just happy path
- [ ] Time-based behaviors use fake timers with explicit advancement
- [ ] Test description documents which bug/PR it validates
