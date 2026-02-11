# Video Call Tests (Playwright)

This directory contains Playwright-based tests for video call functionality using **live Daily.co endpoints**.

## Why Separate from Cypress?

- **Gradual migration:** Keep existing Cypress tests working while adding Playwright for video
- **Browser coverage:** Playwright has better multi-browser support (Chromium, Firefox, WebKit)
- **WebRTC testing:** Better fake device and permission mocking for video/audio tests
- **Modern APIs:** Playwright is actively developed with better async/await patterns

Eventually, you can consolidate everything into Playwright or keep them separate.

## Setup

```bash
# Install dependencies
npm install

# Install browsers (Chromium, Firefox, WebKit)
npx playwright install

# Set Daily.co API key
export DAILY_APIKEY="your-api-key"
```

## Running Tests

```bash
# Run all tests
npm test

# Run smoke tests only (quick, ~2 min)
npm run test:smoke

# Run cross-browser tests (slower, ~10 min)
npm run test:cross-browser

# Debug a failing test
npm run test:debug

# Watch tests in UI mode
npm run test:ui

# Run in headed mode (see browser)
npm run test:headed
```

## Test Organization

```
tests/
  videocall-smoke.spec.js    # Core smoke tests (@smoke tag)
  videocall-cross-browser.spec.js  # Browser-specific tests (@cross-browser tag)

fixtures/
  dailyHelpers.js            # Daily.co room management utilities
```

## Tags

Tests are tagged for selective execution:

- `@smoke` - Core tests that verify basic functionality (run on every PR)
- `@critical` - Must-pass tests that gate releases
- `@cross-browser` - Tests that verify browser-specific behavior

## Writing Tests

### Example Test

```javascript
import { test, expect } from '@playwright/test';
import { createTestRoom, deleteTestRoom } from '../fixtures/dailyHelpers';

test.describe('My Feature @smoke', () => {
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

  test('does something', async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });
    const page = await context.newPage();

    await page.goto(`/?testRoomUrl=${encodeURIComponent(roomUrl)}`);
    await expect(page.locator('[data-test="callTile"]')).toBeVisible();

    await context.close();
  });
});
```

### Best Practices

1. **Clean up rooms:** Always delete test rooms in `afterAll`
2. **Grant permissions:** Use `permissions: ['camera', 'microphone']` in context
3. **Expose Daily object:** Add `window.dailyCallObject = callObject` for testing
4. **Use data-test attributes:** Prefer `data-test` selectors over class names
5. **Tag appropriately:** Use `@smoke`, `@critical`, etc. for filtering

## CI Integration

The `.github/workflows/videocall-tests.yml` workflow:

- **Runs unit tests** on every push to call-related code
- **Runs smoke tests** only on main branch or manual trigger
- **Runs cross-browser** only on manual trigger (to save API usage)

### Manual Trigger

Go to Actions → Video Call Tests → Run workflow → Check "Run smoke tests"

## Cost Management

- **Free tier:** 10,000 participant minutes/month
- **Typical test run:** 2-5 minutes of call time
- **Estimated usage:** ~100 minutes/month (20 runs × 5 min)
- **Usage:** ~1% of free tier

To minimize costs:

- Use short-lived rooms (`exp: 1 hour`)
- Run smoke tests conditionally (path filters)
- Delete rooms after tests (`deleteTestRoom`)
- Avoid running cross-browser on every commit

## Debugging

### Trace Viewer

Playwright captures traces on failure:

```bash
# After a test fails, open the trace
npx playwright show-trace playwright-report/data/xxx.zip
```

You can step through the test execution, see DOM snapshots, network requests, etc.

### Inspector

Run tests with inspector to step through:

```bash
npx playwright test --debug
```

### Screenshots/Video

On failure, Playwright automatically captures:

- Screenshots: `playwright-report/`
- Videos: `playwright-report/` (if enabled)

## Troubleshooting

### "Cannot create room: 401 Unauthorized"
- Check that `DAILY_APIKEY` is set correctly
- Verify the key has permissions to create rooms

### "Timeout waiting for selector"
- Your app's selectors may differ from test expectations
- Use `--debug` to inspect the actual DOM
- Update selectors in test files

### "Browser didn't grant permissions"
- Check `playwright.config.js` has fake device launch options
- Verify `permissions: ['camera', 'microphone']` in context

### "Daily.co room still exists after test"
- Check that `deleteTestRoom` is called in `afterAll`
- Rooms auto-expire after 1 hour (see `exp` property)

## Next Steps

1. Add more smoke tests for critical flows
2. Expand cross-browser coverage
3. Test mobile browsers (iOS Safari, Android Chrome)
4. Add visual regression tests (Playwright supports screenshots)

## Resources

- **Playwright Docs:** https://playwright.dev/docs/intro
- **Daily.co API:** https://docs.daily.co/reference/rest-api
- **Strategy Doc:** `../docs/VIDEOCALL_TESTING_STRATEGY.md`
- **Quick Start:** `../docs/VIDEOCALL_TESTING_QUICKSTART.md`
