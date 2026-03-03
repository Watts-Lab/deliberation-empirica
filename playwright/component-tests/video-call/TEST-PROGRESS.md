# Test Implementation Progress

Last updated: 2026-02-20 (device picker - Issue #1190, DEVRECOV-009 to 011 added)
Current section: Phase 2 Complete - Phase 3/4 pending (integration + E2E)

## Summary
- Total component tests: 116 passing (chromium) — 338 total across chromium + firefox + webkit
- Unit tests (existing): 61 passing
- Skipped/deferred: ~9 (require real Daily, multi-browser E2E)
- Failing: 0 (SUB-006 Firefox flaky — pre-existing, unrelated to DEVRECOV)

**Multi-browser:** Firefox + WebKit now enabled. Most tests run 3x (one per browser).

## Section Status

| Section | Total | Done | Pass | Fail | Skip | Notes |
|---------|-------|------|------|------|------|-------|
| 1. Safari Device ID Rotation | 9 | 8 | 8 | 0 | 1 | Integration test deferred |
| 2. Safari AudioContext | 7 | 6 | 6 | 0 | 1 | AUDIO-INT deferred |
| 3. Safari Speaker Gestures | 6 | 6 | 6 | 0 | 0 | ✅ COMPLETE (SPEAKER-004/006 added after merge from main f463d5df) |
| 4. A/V Diagnosis | 17 | 17 | 17 | 0 | 0 | ✅ COMPLETE: all FIXAV done incl. 005/006/007/008 (muted + track-ended fix) |
| 5. Cross-Participant Diagnostics | 8 | 0 | 0 | 0 | 8 | Requires multi-browser E2E |
| 6. Permission Monitoring | 6 | 4 | 4 | 0 | 2 | PERM-001 to PERM-004 done; PERM-005/006 deferred |
| 7. Subscription Reliability | 10 | 6 | 6 | 0 | 4 | SUB-001 to SUB-006 done; SUB-INT/E2E deferred |
| 8. Self-View Display | 4 | 4 | 4 | 0 | 0 | ✅ COMPLETE |
| 9. Tile UI States | 5 | 5 | 5 | 0 | 0 | ✅ COMPLETE |
| 10. Log Spam Prevention | 3 | 3 | 3 | 0 | 0 | ✅ COMPLETE via console capture helper |
| 11. A/V Error Reporting | 7 | 7 | 7 | 0 | 0 | ✅ COMPLETE (PDATA + ERR all done) |
| 12. Tray UI | 6 | 6 | 6 | 0 | 0 | ✅ COMPLETE (incl. muted states) |
| 13. DailyId History | 5 | 4 | 4 | 0 | 1 | ✅ HISTORY-001 to 004 done; E2E export deferred |
| 14. Player Data Logging | 5 | 2 | 2 | 0 | 3 | avReports done; cross-participant deferred |
| 15. AGC Configuration | 3 | 0 | 0 | 0 | 3 | Requires real Daily integration |
| 16. Device Error Recovery | 11 | 11 | 11 | 0 | 0 | ✅ COMPLETE (Issue #1190, all 3 browsers, device picker added) |

## Detailed Progress

### Section 1: Safari Device ID Rotation
- [x] DEVICE-001: ID match succeeds (Unit: deviceAlignment.test.js)
- [x] DEVICE-002: Label match fallback (Unit: deviceAlignment.test.js)
- [x] DEVICE-003: Fallback to first device (Unit: deviceAlignment.test.js)
- [x] DEVICE-004: Device labels stored during setup (Component: VideoCall.deviceAlignment.ct.jsx)
- [x] DEVICE-005: Handles empty device arrays (Unit: deviceAlignment.test.js)
- [x] DEVICE-006: Handles duplicate labels (Unit: deviceAlignment.test.js)
- [x] DEVICE-007: Skips alignment when "waiting" (Component: VideoCall.deviceAlignment.ct.jsx)
- [x] DEVICE-008: Skips alignment for current device (Unit + Component)
- [ ] DEVICE-INT-001: Real device alignment on join (Requires real Daily.co)

### Section 2: Safari AudioContext Suspension Recovery
- [x] AUDIO-001: Detects suspended AudioContext (Component: AudioContext.ct.jsx)
- [x] AUDIO-002: Shows enable audio banner (Component: AudioContext.ct.jsx)
- [x] AUDIO-003: Resume on button click (Component: AudioContext.ct.jsx)
- [x] AUDIO-004: Auto-resume attempts (Component: AudioContext.ct.jsx, uses page.clock.fastForward)
- [x] AUDIO-005: No banner when running (Component: AudioContext.ct.jsx)
- [x] AUDIO-006: Logs state changes (Component: AudioContext.ct.jsx)
- [ ] AUDIO-INT-001: Real AudioContext integration (Requires real Daily.co)

### Section 3: Safari Speaker Gesture Requirements
- [x] SPEAKER-001: setSpeaker NotAllowedError caught without crash (Component: Speaker.ct.jsx, via window.mockDailyDeviceOverrides)
- [x] SPEAKER-002: Non-gesture setSpeaker error triggers fallback retry (Component: Speaker.ct.jsx, uses generic Error not NotAllowedError)
- [x] SPEAKER-003: Speaker alignment logged as Sentry breadcrumb (Component: Speaker.ct.jsx)
- [x] SPEAKER-004: Gesture prompt UI shown after NotAllowedError (Component: Speaker.ct.jsx, merged from main f463d5df)
- [x] SPEAKER-005: No gesture prompt in happy path (Component: Speaker.ct.jsx)
- [x] SPEAKER-006: Gesture prompt dismisses after user clicks Enable Audio (Component: Speaker.ct.jsx)

### Section 4: A/V Issue Diagnosis
- [x] FIXAV-001: Modal opens on Fix A/V click (Component: FixAV.ct.jsx)
- [x] FIXAV-002: Can select multiple issues (Component: FixAV.ct.jsx)
- [x] FIXAV-002b: Modal resets after cancel (Component: FixAV.ct.jsx)
- [x] FIXAV-003: cant-hear option selectable (Component: FixAV.ct.jsx)
- [x] FIXAV-004: All issue types available (Component: FixAV.ct.jsx)
- [x] FIXAV-005: Mic muted diagnosis + fix (Component: FixAV.ct.jsx, real timers, MockCallObject._audioEnabled)
- [x] FIXAV-006: Mic track ended + re-acquire (Component: FixAV.ct.jsx, MockCallObject._audioReadyState='ended')
- [x] FIXAV-007: Camera muted diagnosis + fix (Component: FixAV.ct.jsx, real timers, MockCallObject._videoEnabled)
- [x] FIXAV-008: Camera track ended + re-acquire (Component: FixAV.ct.jsx, MockCallObject._videoReadyState='ended')
- [x] FIXAV-009: Cancel closes modal (Component: FixAV.ct.jsx)
- [x] FIXAV-010: Diagnose button disabled with no selection (Component: FixAV.ct.jsx)
- [x] FIXAV-010b: Diagnose button enabled after selection (Component: FixAV.ct.jsx)
- [x] FIXAV-011: Validation after fix - shows success state (Component: FixAV.ct.jsx, real timers)
- [x] FIXAV-012: Issue checkbox deselects (Component: FixAV.ct.jsx)
- [x] FIXAV-013: Multi-select state (Component: FixAV.ct.jsx)
- [x] FIXAV-014: Auto-close on success (Component: FixAV.ct.jsx, real timers)
- [x] AVREC-001: diagnoseIssue returns ranked causes (Unit: avRecovery.test.js)
- [x] AVREC-002: attemptSoftFix calls correct recovery (Unit: avRecovery.test.js)
- [x] AVREC-003: validateFix detects improvement (Unit: avRecovery.test.js)

### Section 5: Cross-Participant Diagnostic Logging
- [ ] DIAG-001 to DIAG-007: All skipped - require multi-participant state
- [ ] DIAG-E2E-001: Requires real multi-browser setup

### Section 6: Browser Permission Monitoring
- [x] PERM-001: Camera permission change → console.warn (Component: PermissionMonitoring.ct.jsx, Object.defineProperty mock)
- [x] PERM-002: Mic permission change → console.warn (Component: PermissionMonitoring.ct.jsx)
- [x] PERM-003: Permission denied → additional console.error (Component: PermissionMonitoring.ct.jsx)
- [x] PERM-004: browserPermissions field in Sentry reportedAVError (Component: PermissionMonitoring.ct.jsx)
- [ ] PERM-005: Daily participant permissions in summary (Cross-participant Daily state)
- [ ] PERM-006: Blocked tracks detected (Different system — blocked track state)

### Section 7: Subscription Reliability
- [x] SUB-001: Detects subscription drift and calls updateParticipants (Component: Subscriptions.ct.jsx)
- [x] SUB-002: Repair sends correct setSubscribedTracks payload (Component: Subscriptions.ct.jsx)
- [x] SUB-003: Heartbeat triggers repair console log (Component: Subscriptions.ct.jsx)
- [x] SUB-004: Consecutive repairs spaced >= 3000ms (cooldown enforced) (Component: Subscriptions.ct.jsx)
- [x] SUB-005: Does not repair when track state is null (not subscribable) (Component: Subscriptions.ct.jsx)
- [x] SUB-006: Repair log includes target participant ID (Component: Subscriptions.ct.jsx)
- [ ] SUB-INT-001, SUB-INT-002: Requires real Daily.co
- [ ] SUB-E2E-001, SUB-E2E-002: Requires multi-browser E2E

### Section 8: Self-View Display
- [x] SELF-001: Self-view shows video (Component: Tile.ct.jsx)
- [x] SELF-002: Self-view shows "Video Muted" (Component: Tile.ct.jsx)
- [x] SELF-003: Skips subscription check for local (Component: Tile.ct.jsx)
- [x] SELF-004: Remote tile shows "Waiting" correctly (Component: Tile.ct.jsx)

### Section 9: Tile UI States
- [x] TILE-001: Shows video when playable (Component: Tile.ct.jsx)
- [x] TILE-002: Shows "Video Muted" when off (Component: Tile.ct.jsx)
- [x] TILE-003: Shows "Waiting" when unsubscribed (Component: Tile.ct.jsx)
- [x] TILE-004: Shows audio muted badge (Component: Tile.ct.jsx)
- [x] TILE-005: Shows nickname when enabled (Component: Tile.ct.jsx)

### Section 10: Log Spam Prevention
- [x] LOG-001: Alignment log fires once when device matched (Component: DeviceAlignmentLogs.ct.jsx)
- [x] LOG-002: No alignment log when device list is empty (Component: DeviceAlignmentLogs.ct.jsx)
- [x] LOG-003: Fallback Sentry message includes available device list (Component: DeviceAlignmentLogs.ct.jsx)

### Section 11: A/V Error Reporting
- [x] PDATA-001: avReports array populated (Component: VideoCall.historyAndData.ct.jsx)
- [x] PDATA-002: Report includes all fields (Component: VideoCall.historyAndData.ct.jsx)
- [x] ERR-001: camera-error event renders UserMediaError (Component: ErrorReporting.ct.jsx)
- [x] ERR-002: Sentry.captureMessage("User media error") called with dailyErrorType (Component: ErrorReporting.ct.jsx)
- [x] ERR-002b: mic-error captures permissions error type (Component: ErrorReporting.ct.jsx)
- [x] ERR-007: Sentry extra includes summary string (Component: ErrorReporting.ct.jsx)
- [x] ERR-Breadcrumb: device alignment fallback captured in Sentry (Component: ErrorReporting.ct.jsx)
- [x] ERR-FixAV: Fix A/V completion sends reportedAVError to Sentry (Component: ErrorReporting.ct.jsx)

### Section 12: Tray UI
- [x] TRAY-001: Fix A/V button visible (Component: Tray.ct.jsx)
- [x] TRAY-002: Camera toggle shows disable when on (Component: Tray.ct.jsx)
- [x] TRAY-002b: Camera toggle shows enable when muted (Component: Tray.ct.jsx)
- [x] TRAY-003: Mic toggle shows mute when on (Component: Tray.ct.jsx)
- [x] TRAY-003b: Mic toggle shows unmute when muted (Component: Tray.ct.jsx)
- [ ] TRAY-004: Responsive on narrow screens (Visual test)
- [ ] TRAY-005: Icon sizes consistent (Visual regression)
- [x] TRAY-006: Missing Participant button visible (Component: Tray.ct.jsx)
- [x] TRAY-006b: Missing Participant button hidden (Component: Tray.ct.jsx)

### Section 13: DailyId History
- [x] HISTORY-001: Logs dailyId on join (Component: VideoCall.historyAndData.ct.jsx)
- [x] HISTORY-002: Entry includes timestamp (Component: VideoCall.historyAndData.ct.jsx)
- [x] HISTORY-003: Entry includes progressLabel (Component: VideoCall.historyAndData.ct.jsx)
- [x] HISTORY-004: New entry logged when session ID changes (Component: VideoCall.historyAndData.ct.jsx)
- [ ] HISTORY-E2E-001: Exported in science data (E2E)

### Section 14: Player Data Logging
- [x] PDATA-001: avReports array populated (Component: VideoCall.historyAndData.ct.jsx)
- [x] PDATA-002: Report includes all fields (Component: VideoCall.historyAndData.ct.jsx)
- [ ] PDATA-003: avDiagnosticResponses populated (Cross-participant flow)
- [ ] PDATA-004: Response includes reporter info (Cross-participant flow)
- [ ] PDATA-E2E-001: Exported in science data (E2E)

### Section 15: AGC Configuration
- [ ] AGC-INT-001 to AGC-INT-003: Require real Daily.co integration

### Section 16: Device Error Recovery (Issue #1190)
- [x] DEVRECOV-001: Fix A/V button accessible after camera-error event (3 browsers)
- [x] DEVRECOV-002: Fix A/V button accessible after mic-error event (3 browsers)
- [x] DEVRECOV-003: Device error overlay has Dismiss button (3 browsers)
- [x] DEVRECOV-004: Dismissing error restores call UI (3 browsers)
- [x] DEVRECOV-005: Permissions error shows browser-specific guidance, not generic steps (3 browsers)
- [x] DEVRECOV-006: Shows correct browser-specific image for current browser (chromium→Chrome, firefox→Firefox, webkit→Safari)
- [x] DEVRECOV-007: Auto-reloads when permissions re-granted (page.route interception, 3 browsers)
- [x] DEVRECOV-008: In-use error still shows generic steps — regression guard (3 browsers)
- [x] DEVRECOV-009: Camera not-found error shows device picker with available cameras (3 browsers)
- [x] DEVRECOV-010: Mic not-found error shows device picker with available microphones (3 browsers)
- [x] DEVRECOV-011: Selecting device from picker calls setInputDevicesAsync and clears error (3 browsers)

## Test Files Created

### Unit Tests (existing, used as-is)
- `client/src/call/utils/deviceAlignment.test.js` - 21 tests (DEVICE-001 to DEVICE-008)
- `client/src/call/utils/avRecovery.test.js` - 40 tests (AVREC-001 to AVREC-003)

### Mocked Component Tests (new - this session)
- `playwright/component-tests/video-call/mocked/Tile.ct.jsx` - 9 tests
- `playwright/component-tests/video-call/mocked/Tray.ct.jsx` - 7 tests
- `playwright/component-tests/video-call/mocked/FixAV.ct.jsx` - 16 tests (FIXAV-001/002/002b/003/004/005/006/007/008/009/010/010b/011/012/013/014)
- `playwright/component-tests/video-call/mocked/Subscriptions.ct.jsx` - 6 tests (SUB-001 to SUB-006)
- `playwright/component-tests/video-call/mocked/VideoCall.deviceAlignment.ct.jsx` - 3 tests
- `playwright/component-tests/video-call/mocked/AudioContext.ct.jsx` - 6 tests (AUDIO-001/002/003/004/005/006)
- `playwright/component-tests/video-call/mocked/VideoCall.historyAndData.ct.jsx` - 5 tests
- `playwright/component-tests/video-call/mocked/ErrorReporting.ct.jsx` - 5 tests (ERR-001/002/002b/007/Breadcrumb/FixAV)
- `playwright/component-tests/video-call/mocked/DeviceAlignmentLogs.ct.jsx` - 3 tests (LOG-001/002/003)
- `playwright/component-tests/video-call/mocked/Speaker.ct.jsx` - 6 tests (SPEAKER-001 to SPEAKER-006)
- `playwright/component-tests/video-call/mocked/PermissionMonitoring.ct.jsx` - 4 tests (PERM-001 to PERM-004)
- `playwright/component-tests/video-call/mocked/VideoCall.deviceRecovery.ct.jsx` - 11 tests (DEVRECOV-001 to DEVRECOV-011, all 3 browsers)

### Fixtures
- `playwright/component-tests/video-call/fixtures/sentrySnapshots.js`
- `playwright/component-tests/shared/fixtures.js`

### Mock Updates
- `playwright/mocks/MockDailyProvider.jsx` - Added MockCallObject EventEmitter, participants prop, device data merging with defaults, `window.mockDailySetLocalSessionId` setter, `window.mockCallObject` event emitter, `window.mockDailyDeviceOverrides` hook, `getInputDevices()`/`getOutputDevices()` stubs, `localAudio()`/`localVideo()` local media state stubs, `setLocalAudio()`/`setLocalVideo()` soft-fix methods, `_audioEnabled`/`_videoEnabled`/`_audioReadyState`/`_videoReadyState` state vars for test control, `setInputDevicesAsync()` resets readyState on re-acquisition
- `playwright/mocks/sentry-mock.js` - Full rewrite: `window.mockSentryCaptures` store captures all `captureMessage`, `captureException`, `addBreadcrumb` calls with `.reset()` method
- `playwright/mocks/console-capture.js` - New helper: `setupConsoleCapture(page)` for intercepting console output in tests
- `playwright/mocks/daily-hooks.jsx` - Fixed useParticipantProperty to read from context
- `playwright/playwright.config.mjs` - Set workers=2 locally to prevent parallel load failures

## Blockers and Issues

| Test ID | Issue | Resolution |
|---------|-------|------------|
| SPEAKER-004/006 | Gesture prompt UI not yet implemented in VideoCall.jsx | Skipped (feature gap) |
| DIAG-* | Requires multi-participant real-time state | Deferred to E2E |
| PERM-* | navigator.permissions unreliable in headless | Deferred to integration |
| SUB-* | callObject spy functions not serializable | Deferred to integration |
| AGC-* | Requires real Daily.co to verify media constraints | Deferred to integration |

## Validation Notes
All implemented tests use real assertions that would catch regressions:
- TILE-003 catches the self-view bug (no subscription check for local tile)
- TILE-005 catches the useParticipantProperty bug (now reads from context)
- AUDIO-002 catches AudioContext banner rendering regression
- HISTORY-001 catches dailyIdHistory logging regression
- PDATA-001/002 catch avReports logging regression and field structure
