# Video Call Test Implementation - Handoff to Sonnet

## Overview

You are implementing the test plan defined in [VIDEO-CALL-TEST-PLAN.md](./VIDEO-CALL-TEST-PLAN.md). This document contains 96 tests across 15 feature areas for the video call functionality.

**Your goal**: Implement all tests, validate they would catch regressions, and report results.

---

## Progress Tracking

### Create and Maintain a Progress File

At the start of your work, create `TEST-PROGRESS.md` in this directory. Use this exact format:

```markdown
# Test Implementation Progress

Last updated: [timestamp]
Current section: [section name]
Current test: [test ID]

## Summary
- Total tests: 96
- Implemented: 0
- Passing: 0
- Failing: 0
- Skipped: 0
- Blocked: 0

## Section Status

| Section | Total | Done | Pass | Fail | Skip | Notes |
|---------|-------|------|------|------|------|-------|
| 1. Safari Device ID Rotation | 9 | 0 | 0 | 0 | 0 | |
| 2. Safari AudioContext | 7 | 0 | 0 | 0 | 0 | |
| 3. Safari Speaker Gestures | 6 | 0 | 0 | 0 | 0 | |
| 4. A/V Diagnosis | 17 | 0 | 0 | 0 | 0 | |
| 5. Cross-Participant Diagnostics | 8 | 0 | 0 | 0 | 0 | |
| 6. Permission Monitoring | 6 | 0 | 0 | 0 | 0 | |
| 7. Subscription Reliability | 10 | 0 | 0 | 0 | 0 | |
| 8. Self-View Display | 4 | 0 | 0 | 0 | 0 | |
| 9. Tile UI States | 5 | 0 | 0 | 0 | 0 | |
| 10. Log Spam Prevention | 3 | 0 | 0 | 0 | 0 | |
| 11. A/V Error Reporting | 7 | 0 | 0 | 0 | 0 | |
| 12. Tray UI | 6 | 0 | 0 | 0 | 0 | |
| 13. DailyId History | 5 | 0 | 0 | 0 | 0 | |
| 14. Player Data Logging | 5 | 0 | 0 | 0 | 0 | |
| 15. AGC Configuration | 3 | 0 | 0 | 0 | 0 | |

## Detailed Progress

### Section 1: Safari Device ID Rotation
- [ ] DEVICE-001: ID match succeeds
- [ ] DEVICE-002: Label match fallback
- [ ] DEVICE-003: Fallback to first device
- [ ] DEVICE-004: Device labels stored during setup
- [ ] DEVICE-005: Handles empty device arrays
- [ ] DEVICE-006: Handles duplicate labels
- [ ] DEVICE-007: Skips alignment when "waiting"
- [ ] DEVICE-008: Skips alignment for current device
- [ ] DEVICE-INT-001: Real device alignment on join

[Continue for all sections...]

## Blockers and Issues

| Test ID | Issue | Resolution |
|---------|-------|------------|
| | | |

## Validation Log

| Test ID | Mutation Test | Result | Notes |
|---------|---------------|--------|-------|
| | | | |
```

**Update this file after completing each test or group of related tests.**

---

## Workflow for Each Test

### Step 1: Understand the Bug

Before writing any code, read:
1. The test description in VIDEO-CALL-TEST-PLAN.md
2. The related PR/Issue (listed in each section header)
3. The actual source code being tested

Use `gh pr view <number> --repo Watts-Lab/deliberation-empirica` to review PR details if needed.

### Step 2: Locate or Create Test File

Test files should follow this structure:
```
playwright/component-tests/video-call/
├── unit/
│   ├── avRecovery.test.js        # Unit tests for avRecovery.js
│   └── deviceAlignment.test.js   # Unit tests for deviceAlignment.js
├── mocked/
│   ├── Tile.ct.jsx               # Component tests with mocked Daily
│   ├── Tray.ct.jsx
│   ├── VideoCall.ct.jsx
│   ├── FixAV.ct.jsx
│   └── AudioContext.ct.jsx
├── integration/
│   └── VideoCall.integration.ct.jsx  # Tests with real Daily.co
└── fixtures/
    └── sentrySnapshots.js        # Real diagnostic data from Sentry
```

### Step 3: Write the Test

Follow this pattern for each test:

```javascript
/**
 * Test ID: DEVICE-002
 * PR: #1170
 * Bug: Safari rotates device IDs, breaking device selection
 * Validates: Label-based fallback when ID doesn't match
 */
test('DEVICE-002: uses label match when ID not found', async ({ mount }) => {
  // 1. Arrange: Set up the bug condition
  const mockDevices = [
    { device: { deviceId: 'new-id-123', label: 'Blue Yeti USB' } }
  ];
  const preferredId = 'old-id-456';  // ID that won't match (Safari rotated it)
  const preferredLabel = 'Blue Yeti USB';  // Label should still match

  // 2. Act: Run the code under test
  const result = findMatchingDevice(mockDevices, preferredId, preferredLabel);

  // 3. Assert: Verify the fix works
  expect(result.device.deviceId).toBe('new-id-123');
  expect(result.matchType).toBe('label');
});
```

### Step 4: Validate the Test (Mutation Testing)

**This is critical.** A test that always passes is useless.

For unit tests (`avRecovery.js`, `deviceAlignment.js`):
```bash
# 1. Run the test - should pass
npm run test -- deviceAlignment.test.js

# 2. Temporarily break the code
# Edit the source file to introduce the bug

# 3. Run the test again - should FAIL
npm run test -- deviceAlignment.test.js

# 4. Restore the code
git checkout -- client/src/call/utils/deviceAlignment.js
```

For component tests:
```bash
# 1. Run the test
npx playwright test --config=playwright/playwright.config.mjs Tile.ct.jsx

# 2. Temporarily break the component
# Edit Tile.jsx to reintroduce the bug

# 3. Run again - should FAIL

# 4. Restore
git checkout -- client/src/call/Tile.jsx
```

**Log validation results in TEST-PROGRESS.md.**

### Step 5: Update Progress

After each test (or batch of related tests):
1. Mark the test as complete in TEST-PROGRESS.md
2. Update the summary counts
3. Note any issues or blockers

---

## Implementation Order

Follow this order (easier tests first, building up infrastructure):

### Phase 1: Unit Tests (No React, No Mocks)

These are pure JavaScript functions. Start here.

1. **deviceAlignment.js** - File: `client/src/call/utils/deviceAlignment.js`
   - Test file already exists: `client/src/call/utils/deviceAlignment.test.js`
   - Extend existing tests with Sentry fixture data
   - Tests: DEVICE-001 through DEVICE-008

2. **avRecovery.js** - File: `client/src/call/utils/avRecovery.js`
   - Test file already exists: `client/src/call/utils/avRecovery.test.js`
   - Tests: AVREC-001 through AVREC-003

### Phase 2: Component Tests (Mocked Daily)

These require React and mocked providers.

**Key files to understand first:**
- `playwright/mocks/MockDailyProvider.jsx` - Mocks Daily.co hooks
- `playwright/mocks/MockEmpiricaProvider.jsx` - Mocks Empirica hooks
- `playwright/index.jsx` - Test entry point with providers

3. **Tile.jsx** tests
   - Tests: TILE-001 through TILE-005, SELF-001 through SELF-004

4. **Tray.jsx** tests
   - Tests: TRAY-001 through TRAY-006

5. **FixAV.jsx** tests
   - Tests: FIXAV-001 through FIXAV-014, ERR-001 through ERR-007

6. **VideoCall.jsx** tests (mocked)
   - Tests: AUDIO-001 through AUDIO-006, SPEAKER-001 through SPEAKER-006
   - Tests: SUB-001 through SUB-006, PERM-001 through PERM-006
   - Tests: LOG-001 through LOG-003, HISTORY-001 through HISTORY-004
   - Tests: PDATA-001 through PDATA-004, DIAG-001 through DIAG-007

### Phase 3: Integration Tests (Real Daily.co)

These hit the real Daily API and cost money. Be selective.

7. **VideoCall integration tests**
   - Tests: DEVICE-INT-001, AUDIO-INT-001, SUB-INT-001, SUB-INT-002
   - Tests: AGC-INT-001 through AGC-INT-003

### Phase 4: E2E Tests (Cypress)

These require full server setup. May need to create new Cypress specs.

8. **Multi-participant scenarios**
   - Tests: DEVICE-E2E-001, DIAG-E2E-001, SUB-E2E-001, SUB-E2E-002
   - Tests: HISTORY-E2E-001, PDATA-E2E-001

---

## Running Tests

### Unit Tests (Vitest)
```bash
cd client
npm test -- <test-file>
npm test -- deviceAlignment.test.js
npm test -- avRecovery.test.js
```

### Component Tests - Mocked (Playwright)
```bash
# From repo root
npx playwright test --config=playwright/playwright.config.mjs <test-file>

# Example
npx playwright test --config=playwright/playwright.config.mjs Tile.ct.jsx

# Run specific test
npx playwright test --config=playwright/playwright.config.mjs -g "TILE-001"
```

### Component Tests - Integration (Playwright)
```bash
npx playwright test --config=playwright/playwright.integration.config.mjs <test-file>
```

### E2E Tests (Cypress)
```bash
cd cypress
npx cypress run --spec "e2e/<spec-file>"
```

---

## Mock Infrastructure

### MockDailyProvider

Located at `playwright/mocks/MockDailyProvider.jsx`. Provides:
- `useDaily()` - returns mock callObject
- `useLocalSessionId()` - returns mock session ID
- `useParticipantIds()` - returns mock participant IDs
- `useDailyEvent()` - mock event handler

Configure via `hooksConfig.daily` in mount options:
```javascript
await mount(<VideoCall />, {
  hooksConfig: {
    daily: {
      participants: {
        'local': { local: true, tracks: { audio: { state: 'playable' } } },
        'remote-1': { local: false, tracks: { audio: { state: 'playable' } } }
      },
      meetingState: 'joined-meeting',
      localSessionId: 'local-123'
    }
  }
});
```

### MockEmpiricaProvider

Located at `playwright/mocks/MockEmpiricaProvider.jsx`. Provides:
- `usePlayer()` - returns MockPlayer
- `usePlayers()` - returns array of MockPlayer
- `useGame()` - returns MockGame
- `useStage()` - returns MockStage

Configure via `hooksConfig.empirica`:
```javascript
await mount(<Component />, {
  hooksConfig: {
    empirica: {
      player: { id: 'player-1', position: 0 },
      players: [{ id: 'player-1' }, { id: 'player-2' }],
      game: { treatment: { ... } },
      stage: { name: 'discussion' }
    }
  }
});
```

### Sentry Mock

Create a mock for Sentry in your tests:
```javascript
const sentryCaptureMessage = vi.fn();
vi.mock('@sentry/react', () => ({
  captureMessage: sentryCaptureMessage,
  captureException: vi.fn(),
  addBreadcrumb: vi.fn()
}));
```

### Browser API Mocks

For AudioContext:
```javascript
const mockAudioContext = {
  state: 'suspended',
  resume: vi.fn().mockResolvedValue(undefined)
};
window.AudioContext = vi.fn(() => mockAudioContext);
```

For permissions:
```javascript
navigator.permissions = {
  query: vi.fn().mockResolvedValue({ state: 'granted', onchange: null })
};
```

---

## Fixture Data

Create `playwright/component-tests/video-call/fixtures/sentrySnapshots.js`:

```javascript
/**
 * Real diagnostic data captured from Sentry issues.
 * Use these as test fixtures to ensure we catch real-world bugs.
 */

// From Issue #1159 - Safari AudioContext suspended
export const safariAudioContextBug = {
  meetingState: 'joining-meeting',
  audioContextState: 'suspended',
  localMediaState: {
    audioTrack: { state: 'interrupted' },
    videoTrack: { state: 'interrupted' }
  },
  browserPermissions: { camera: 'granted', microphone: 'granted' }
};

// From Issue #1131 - Subscription drift
export const subscriptionDriftBug = {
  desired: { audio: true, video: true },
  actual: {
    tracks: {
      audio: { subscribed: false, state: 'off' },
      video: { subscribed: true, state: 'playable' }
    }
  }
};

// From Issue #1169 - Safari device ID rotation
export const safariDeviceRotationBug = {
  preferredMicId: 'old-safari-id-abc123',
  preferredMicLabel: 'MacBook Pro Microphone',
  availableDevices: [
    { deviceId: 'new-safari-id-xyz789', label: 'MacBook Pro Microphone' },
    { deviceId: 'another-device', label: 'External USB Mic' }
  ]
};

// From PR #1171 - A/V diagnosis scenarios
export const diagnosisScenarios = {
  cantHearAudioContextSuspended: {
    reported: ['cant-hear'],
    audioContextState: 'suspended',
    remoteParticipants: [{ audio: { state: 'playable' } }]
  },
  cantHearRemoteMuted: {
    reported: ['cant-hear'],
    audioContextState: 'running',
    remoteParticipants: [{ audio: { off: { byUser: true } } }]
  },
  othersCantHearMeMicEnded: {
    reported: ['others-cant-hear-me'],
    localMediaState: { audioTrack: { readyState: 'ended' } }
  }
};
```

---

## Handling Blockers

### If a Test Cannot Be Written

Add to the Blockers section of TEST-PROGRESS.md:
```markdown
| DIAG-E2E-001 | Requires multi-browser Cypress setup not yet configured | Skipped - needs infra work |
```

Mark the test as "Skipped" in the summary.

### If a Test Fails Unexpectedly

1. Check if it's a real bug in the code (not just your test)
2. Check if mock infrastructure is incomplete
3. Document the failure in TEST-PROGRESS.md
4. Move on to the next test - don't get stuck

### If Mutation Testing Fails (Test Passes When It Shouldn't)

The test is not properly validating the behavior. Options:
1. Add more specific assertions
2. Test a different aspect of the behavior
3. Document that the test needs improvement

---

## Final Report

When all tests are complete (or you've gone through all of them), create `FINAL-REPORT.md`:

```markdown
# Video Call Test Implementation - Final Report

Date: [timestamp]
Implementer: Claude Sonnet

## Summary

| Category | Count |
|----------|-------|
| Total tests in plan | 96 |
| Tests implemented | X |
| Tests passing | X |
| Tests failing | X |
| Tests skipped | X |
| Tests blocked | X |

## Passing Tests

[List all passing tests by section]

## Failing Tests

| Test ID | Failure Reason | Suggested Fix |
|---------|----------------|---------------|
| | | |

## Skipped Tests

| Test ID | Reason | Prerequisites Needed |
|---------|--------|---------------------|
| | | |

## Blocked Tests

| Test ID | Blocker | Suggested Resolution |
|---------|---------|---------------------|
| | | |

## Infrastructure Gaps

[List any mock infrastructure that was missing or incomplete]

## Recommendations

[Any suggestions for improving the test plan or infrastructure]

## Files Created/Modified

[List all test files created or modified]
```

---

## Important Reminders

1. **Update TEST-PROGRESS.md frequently** - This is your working memory across context windows

2. **Validate every test with mutation testing** - A test that can't fail is worthless

3. **Use real Sentry data as fixtures** - The bugs we're testing actually happened

4. **Don't get stuck** - If a test is blocked, document it and move on

5. **Run tests after each implementation** - Don't batch up too many changes

6. **Commit working tests** - After completing each section, commit your progress:
   ```bash
   git add playwright/component-tests/video-call/
   git commit -m "test(video-call): implement [section name] tests"
   ```

7. **Check existing test files first** - Some tests may already partially exist:
   - `client/src/call/utils/deviceAlignment.test.js` (21 tests exist)
   - `client/src/call/utils/avRecovery.test.js` (37 tests exist)

---

## Quick Reference: Test Commands

```bash
# Unit tests
cd client && npm test -- deviceAlignment.test.js

# Component tests (mocked)
npx playwright test --config=playwright/playwright.config.mjs

# Component tests (integration)
npx playwright test --config=playwright/playwright.integration.config.mjs

# Specific test file
npx playwright test --config=playwright/playwright.config.mjs Tile.ct.jsx

# Specific test by name
npx playwright test --config=playwright/playwright.config.mjs -g "TILE-001"

# With UI for debugging
npx playwright test --config=playwright/playwright.config.mjs --ui
```

---

## Existing Test Infrastructure

### Unit Tests (Vitest) - Already Exist
```
client/src/call/utils/
├── deviceAlignment.test.js     # 200 lines, ~21 tests - EXTEND THESE
├── avRecovery.test.js          # 702 lines, ~37 tests - EXTEND THESE
├── audioLevelUtils.test.js     # Exists
└── layouts/
    ├── defaultResponsiveLayout.test.js
    └── computePixelsForLayout.test.js
```

### Playwright Component Tests - Already Exist
```
playwright/component-tests/video-call/
├── mocked/
│   ├── VideoCall.states.ct.jsx        # State-based tests
│   ├── VideoCall.basic.ct.jsx         # Basic render tests
│   ├── VideoCall.customLayouts.ct.jsx # Layout tests
│   └── VideoCall.responsiveLayout.ct.jsx
├── integration/
│   ├── VideoCall.integration.ct.jsx   # Real Daily.co tests
│   ├── DailyHooks.test.ct.jsx
│   ├── MockHarnessDebug.ct.jsx        # Debug harness tests
│   ├── VideoCall.edgeCases.ct.jsx
│   └── VideoCall.simpleHookTest.ct.jsx
└── debug/
    └── infrastructure.ct.jsx
```

**Important**: Review these existing files before creating new ones. Many tests may already partially exist or provide patterns to follow.

---

## Start Here

1. **Create `TEST-PROGRESS.md`** using the template above
2. **Review existing test files** to understand patterns:
   - `client/src/call/utils/deviceAlignment.test.js` - Unit test patterns
   - `playwright/component-tests/video-call/mocked/VideoCall.basic.ct.jsx` - Component test patterns
3. **Start with Phase 1**: Extend existing unit tests in `deviceAlignment.test.js` and `avRecovery.test.js`
4. **After each test**, update progress and validate with mutation testing
5. **When complete**, create `FINAL-REPORT.md`

Good luck!
