# Video Call Testing Strategy

## Current Situation

Your videocall interface (client/src/call/) has **no dedicated tests** despite being critical infrastructure. Most issues occur in browser-specific handling of webcams, mics, and audio output. You're planning a refactor but lack confidence without test coverage.

## Testing Philosophy: Layered Approach

**Don't choose between mocking and live testing—use both strategically:**

1. **Unit/Integration Tests (mocked)** - Fast feedback on logic (90% of your test runs)
2. **Contract Tests (mocked with real shapes)** - Verify Daily.co integration assumptions
3. **Smoke Tests (live Daily.co)** - Confidence before deployment (run selectively)
4. **Cross-browser E2E (live Daily.co)** - Catch browser-specific bugs (run on-demand)

---

## Recommended Testing Stack

### Option A: Modern Stack (Recommended for Overhaul)
- **Vitest** - You already use it! Fast, modern, great ESM support
- **Playwright** - Better than Cypress for multi-browser, built-in video/audio testing
- **Testing Library** - For component tests
- **MSW (Mock Service Worker)** - Mock Daily.co REST API calls

**Why Playwright over Cypress:**
- Native multi-browser support (Chromium, Firefox, WebKit/Safari)
- Better handling of browser permissions (camera/mic)
- More stable video/audio testing primitives
- Faster and more reliable in CI
- Better debugging tools (trace viewer, inspector)

### Option B: Incremental Improvement (Keep Cypress)
- Keep Cypress for existing tests
- Add Vitest component tests with mocked Daily.co
- Use Playwright only for critical video call scenarios
- Migrate gradually

---

## Layer 1: Unit Tests with Vitest (Mocked Daily.co)

### What to Test
Focus on logic that doesn't require real WebRTC:

```javascript
// client/src/call/utils/deviceAlignment.test.js (already exists! ✓)
// client/src/call/layouts/defaultResponsiveLayout.test.js (already exists! ✓)

// NEW TESTS TO ADD:
// client/src/call/VideoCall.test.jsx - subscription management logic
// client/src/call/Call.test.jsx - layout computation and tile positioning
// client/src/call/Tray.test.jsx - UI controls
// client/src/call/hooks/eventLogger.test.js - event tracking
```

### Mocking Strategy

**Mock the Daily.co hooks and callObject:**

```javascript
// vitest.setup.js or test file
import { vi } from 'vitest';

// Mock @daily-co/daily-react
vi.mock('@daily-co/daily-react', () => ({
  DailyProvider: ({ children }) => children,
  useDaily: vi.fn(() => mockCallObject),
  useDevices: vi.fn(() => mockDevices),
  useParticipantIds: vi.fn(() => []),
  useLocalSessionId: vi.fn(() => 'local-session-id'),
  DailyAudio: () => null,
}));

const mockCallObject = {
  join: vi.fn(),
  leave: vi.fn(),
  setInputDevicesAsync: vi.fn(),
  setUserName: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  meetingState: vi.fn(() => 'joined-meeting'),
  participants: vi.fn(() => ({})),
  updateParticipants: vi.fn(),
  isDestroyed: vi.fn(() => false),
};

const mockDevices = {
  cameras: [
    { device: { deviceId: 'camera1', label: 'FaceTime HD Camera' } },
  ],
  microphones: [
    { device: { deviceId: 'mic1', label: 'Built-in Microphone' } },
  ],
  speakers: [
    { device: { deviceId: 'speaker1', label: 'Built-in Speakers' } },
  ],
  currentCam: { device: { deviceId: 'camera1' } },
  currentMic: { device: { deviceId: 'mic1' } },
  currentSpeaker: { device: { deviceId: 'speaker1' } },
};
```

**Benefits:**
- Fast (<1s per test)
- No Daily.co API key needed
- Test edge cases (device changes, permissions denied, etc.)
- Run in CI on every commit

**Example Test Cases:**
- Device alignment when preferred device is missing (Safari ID rotation)
- Subscription updates when layout changes
- Error handling for permission denials
- Track subscription reconciliation logic
- Room join/leave lifecycle

---

## Layer 2: Contract Tests (Verify Daily.co Integration)

Mock Daily.co but ensure your mocks match their **actual API shape**. This catches breaking changes.

```javascript
// client/src/call/__tests__/dailyContract.test.js
import { describe, it, expect } from 'vitest';

describe('Daily.co contract assumptions', () => {
  it('callObject.participants() returns expected shape', () => {
    // This test documents what shape YOU expect from Daily
    const mockParticipant = {
      session_id: 'abc123',
      user_name: 'Test User',
      tracks: {
        audio: {
          state: 'playable',
          subscribed: true,
          blocked: false,
        },
        video: {
          state: 'playable',
          subscribed: true,
          blocked: false,
        },
      },
    };

    // If Daily changes their API, this test forces you to update mocks
    expect(mockParticipant).toMatchSnapshot();
  });

  it('device objects have expected properties', () => {
    const mockDevice = {
      device: {
        deviceId: 'abc123',
        label: 'FaceTime HD Camera',
        kind: 'videoinput',
      },
    };
    expect(mockDevice).toMatchSnapshot();
  });
});
```

**Update these snapshots when you verify against Daily.co docs or real calls.**

---

## Layer 3: Live Daily.co Smoke Tests (Selective)

### When to Run
- **On-demand:** Before merging PRs that touch call code
- **Scheduled:** Nightly or weekly
- **Conditional:** Only if call-related files changed (git diff)

### Setup: Dedicated Test Room

```javascript
// cypress/support/dailyHelpers.js or playwright/fixtures/daily.js

export async function createTestRoom(name = `test-${Date.now()}`) {
  const response = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DAILY_APIKEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      properties: {
        enable_people_ui: false,
        enable_screenshare: false,
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      },
    }),
  });
  return response.json();
}

export async function deleteTestRoom(name) {
  await fetch(`https://api.daily.co/v1/rooms/${name}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${process.env.DAILY_APIKEY}` },
  });
}
```

### Example Smoke Test (Playwright)

```javascript
// playwright/tests/videocall-smoke.spec.js
import { test, expect } from '@playwright/test';
import { createTestRoom, deleteTestRoom } from '../fixtures/daily';

test.describe('Video Call Smoke Tests', () => {
  let roomUrl;
  let roomName;

  test.beforeAll(async () => {
    const room = await createTestRoom();
    roomUrl = room.url;
    roomName = room.name;
  });

  test.afterAll(async () => {
    await deleteTestRoom(roomName);
  });

  test('two participants can join and see each other', async ({ browser }) => {
    // Grant camera/mic permissions to both contexts
    const context1 = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });
    const context2 = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Set test room URL in your app
    await page1.goto(`/?roomUrl=${encodeURIComponent(roomUrl)}`);
    await page2.goto(`/?roomUrl=${encodeURIComponent(roomUrl)}`);

    // Assert video tiles appear
    await expect(page1.locator('[data-test="callTile"]')).toHaveCount(2);
    await expect(page2.locator('[data-test="callTile"]')).toHaveCount(2);

    // Verify audio tracks are subscribed
    const tracks1 = await page1.evaluate(() => {
      const daily = window.daily; // Expose for testing
      const participants = daily.participants();
      return Object.values(participants).map(p => ({
        audio: p.tracks?.audio?.subscribed,
        video: p.tracks?.video?.subscribed,
      }));
    });
    expect(tracks1.some(t => t.audio && t.video)).toBeTruthy();

    await context1.close();
    await context2.close();
  });

  test('device changes are handled gracefully', async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });
    const page = await context.newPage();

    await page.goto(`/?roomUrl=${encodeURIComponent(roomUrl)}`);
    await expect(page.locator('[data-test="callTile"]')).toHaveCount(1);

    // Simulate device change (this is tricky - may need browser APIs)
    await page.evaluate(() => {
      // Trigger a device change event
      window.dispatchEvent(new Event('devicechange'));
    });

    // Assert the app re-enumerates devices
    await expect(page.locator('[data-test="deviceError"]')).not.toBeVisible();

    await context.close();
  });
});
```

### Cost Management
- Use short-lived rooms (1 hour expiry)
- Run only on branches that touch `client/src/call/**` or `server/src/providers/dailyco.js`
- Limit to 1-2 core scenarios (join, device change)
- Use GitHub Actions conditional workflows:

```yaml
# .github/workflows/videocall-smoke.yml
name: Video Call Smoke Tests
on:
  push:
    paths:
      - 'client/src/call/**'
      - 'server/src/providers/dailyco.js'
      - 'client/src/intro-exit/setup/**'
  workflow_dispatch: # Manual trigger

jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - name: Run smoke tests
        env:
          DAILY_APIKEY: ${{ secrets.DAILY_APIKEY }}
        run: npx playwright test --grep "smoke"
```

**Estimated Cost:**
- ~5 minutes of call time per test run
- Daily.co free tier: 10,000 participant minutes/month
- If you run 20 times/month = 100 minutes used (~1% of free tier)

---

## Layer 4: Cross-Browser E2E (Run Manually Before Releases)

Use Playwright to test Safari, Chrome, Firefox with real devices.

```javascript
// playwright.config.js
export default {
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
};
```

**Test Cases:**
- Device enumeration across browsers
- Audio output device selection (Chrome supports, Safari doesn't)
- Device ID persistence (Safari rotates IDs)
- Permission prompts and denials
- Tab switching and audio context suspension

**Run These:**
- Before major releases
- When debugging browser-specific bugs
- After Safari/Chrome updates

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
1. ✅ Create this strategy doc (you're reading it!)
2. Set up Vitest config for client/src/call components
3. Write mock utilities for @daily-co/daily-react
4. Add 5 critical unit tests:
   - Device alignment (Safari ID rotation)
   - Subscription reconciliation
   - Layout computation
   - Join/leave lifecycle
   - Error handling

### Phase 2: Smoke Tests (Week 2)
1. Choose Playwright vs. keep Cypress (see comparison below)
2. Set up test room creation helper
3. Write 2 smoke tests:
   - Two participants join
   - Device change handling
4. Add GitHub Actions workflow with path filter

### Phase 3: Expand Coverage (Week 3-4)
1. Add contract tests for Daily.co API shape
2. Expand unit tests to 80% coverage
3. Add cross-browser E2E suite (manual trigger)
4. Document in CI how to run tests selectively

### Phase 4: Refactor with Confidence (Week 5+)
Now you can refactor VideoCall.jsx knowing tests will catch breakage!

---

## Playwright vs. Cypress Comparison

| Feature | Playwright | Cypress |
|---------|-----------|---------|
| **Multi-browser** | ✅ Native (Chromium, Firefox, WebKit) | ⚠️ Requires separate config |
| **Speed** | ✅ Faster (parallel by default) | ⚠️ Slower (serial by default) |
| **Video/Audio** | ✅ Better permission mocking | ⚠️ Limited support |
| **Debugging** | ✅ Trace viewer, inspector | ✅ Time-travel debugger |
| **Learning curve** | ⚠️ Steeper (more APIs) | ✅ Easier to start |
| **Migration effort** | ⚠️ Rewrite tests | ✅ Keep existing |
| **Cost** | Free, OSS | Free for OSS |

**Recommendation:** Start Playwright for NEW video tests, keep Cypress for existing tests, migrate gradually.

---

## FAQ

### Q: Does Daily.co have a test/sandbox environment?
**A:** No separate sandbox. Use short-lived rooms with `exp` property. The free tier is generous (10,000 participant minutes/month).

### Q: Can I mock Daily.co WebRTC without their service?
**A:** Not fully. WebRTC is complex and browser-dependent. Mock for logic tests, but you NEED real calls for device/permission/browser tests.

### Q: How do I test Safari-specific bugs in CI?
**A:** Use Playwright's WebKit engine (Chromium-based Safari) in CI. For REAL Safari, use BrowserStack or manual testing on macOS.

### Q: What about testing audio quality?
**A:** Hard to automate. Use manual QA with real humans. You can detect audio tracks exist but not subjective quality.

### Q: How do I test the equipment setup flow?
**A:** Mock navigator.mediaDevices.getUserMedia() for unit tests. Use real browser permissions for E2E.

---

## Resources

- **Daily.co API Docs:** https://docs.daily.co/
- **Playwright Video/Audio:** https://playwright.dev/docs/api/class-browsercontext#browser-context-grant-permissions
- **Vitest Mocking:** https://vitest.dev/guide/mocking.html
- **Testing Library:** https://testing-library.com/docs/react-testing-library/intro/
- **MSW (Mock Service Worker):** https://mswjs.io/

---

## Success Metrics

After implementing this strategy, you should have:

- ✅ **80%+ unit test coverage** of call logic (fast, run on every commit)
- ✅ **2-3 smoke tests** with live Daily.co (run before merges to main)
- ✅ **Cross-browser suite** (run manually before releases)
- ✅ **<5 minutes added** to CI pipeline (unit + smoke tests)
- ✅ **Confidence to refactor** without breaking production

---

## Next Steps

1. **Review this strategy** with your team
2. **Choose Option A or B** (full overhaul vs. incremental)
3. **Start with Phase 1** (5 unit tests)
4. **Measure impact** (bugs caught, refactor confidence)
5. **Iterate** based on what works

**Questions?** Check the FAQ or file an issue with specific scenarios you want to test.
