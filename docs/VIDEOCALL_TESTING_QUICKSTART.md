# Video Call Testing - Quick Start Guide

This guide helps you get started testing your videocall interface in **under 30 minutes**.

## Prerequisites

- Node.js 20+
- Daily.co API key (get from https://dashboard.daily.co/)
- Git branch created for this work

## Step 1: Install Dependencies (5 min)

```bash
# Unit tests (Vitest - already installed!)
cd client
npm install  # You're all set!

# E2E tests (Playwright - new)
cd ../playwright-videocall
npm init -y
npm install -D @playwright/test
npx playwright install chromium  # Install browser
```

## Step 2: Run Your First Unit Test (10 min)

```bash
cd ../client

# Run the example test
npm test -- client/src/call/__tests__/VideoCall.subscription.test.jsx

# Expected output:
# ✓ VideoCall - Subscription Management (3 tests)
# ✓ VideoCall - Device Alignment (2 tests)
```

**If tests fail:** Check that mocks are set up correctly. The test file includes mock setup.

## Step 3: Run a Smoke Test with Live Daily.co (10 min)

```bash
# Set your API key
export DAILY_APIKEY="your-api-key-here"

# Or add to .env file:
echo "DAILY_APIKEY=your-api-key" >> .env

cd ../playwright-videocall

# Run one smoke test
npx playwright test --grep "two participants" --headed

# Watch the test:
# - Two browser windows open
# - Both join a Daily.co room
# - Both see each other's video tiles
```

**If test fails:**
- Check that `DAILY_APIKEY` is set
- Verify your app is running on `http://localhost:3000`
- Adjust selectors in the test to match your app's HTML

## Step 4: Customize for Your App (5 min)

### Update test selectors

The example tests use generic selectors. Update them to match your app:

```javascript
// playwright-videocall/tests/videocall-smoke.spec.js

// Change this:
await page1.goto(`/?playerKey=participant1&testRoomUrl=${encodeURIComponent(roomUrl)}`);

// To match your app's URL pattern:
await page1.goto(`/?playerKey=participant1&...your params...`);

// Change this:
await page1.click('button[data-test="joinButton"]');

// To match your actual intro flow:
await page1.click('button[data-test="your-actual-button"]');
```

### Expose Daily.co callObject for tests

Add this to your VideoCall component for testing:

```javascript
// client/src/call/VideoCall.jsx

useEffect(() => {
  if (process.env.NODE_ENV === 'test' || window.Cypress) {
    window.dailyCallObject = callObject;
  }
}, [callObject]);
```

## Step 5: Add to CI (Optional, 5 min)

```bash
# Add DAILY_APIKEY to GitHub Secrets
# Settings → Secrets and variables → Actions → New repository secret

# The workflow is already created at:
# .github/workflows/videocall-tests.yml

# Push your branch and see tests run!
git add .
git commit -m "Add video call tests"
git push
```

## What You've Accomplished ✅

- ✅ Unit tests that run fast (< 1s) and don't hit Daily.co
- ✅ Smoke tests that verify browser integration with real WebRTC
- ✅ CI workflow that runs conditionally (only when call code changes)
- ✅ Foundation to add more tests as you refactor

## Next Steps

1. **Add more unit tests** - Cover edge cases (Safari device ID rotation, permission errors)
2. **Expand smoke tests** - Add device toggle, error handling scenarios
3. **Run cross-browser** - Test in Firefox and Safari: `npx playwright test --project=firefox`
4. **Measure coverage** - `npm test -- --coverage` in client folder

## Common Issues

### "Cannot find module '@playwright/test'"
```bash
cd playwright-videocall
npm install -D @playwright/test
```

### "DAILY_APIKEY not set"
```bash
export DAILY_APIKEY="your-key-here"
```

### "Timeout waiting for selector"
- Your app's HTML may have different selectors
- Update test selectors to match your actual DOM
- Use Playwright's inspector: `npx playwright test --debug`

### "Browser didn't grant permissions"
- Check `playwright.config.js` has `launchOptions` for fake devices
- Verify permissions are set in test: `context({ permissions: ['camera'] })`

## Getting Help

- **Strategy doc:** `docs/VIDEOCALL_TESTING_STRATEGY.md`
- **Example tests:** `client/src/call/__tests__/`
- **Playwright docs:** https://playwright.dev/docs/intro
- **Daily.co docs:** https://docs.daily.co/

## Measuring Success

After implementing tests, you should feel confident to:

- ✅ Refactor VideoCall.jsx without fear of breaking things
- ✅ Catch browser-specific bugs before they hit production
- ✅ Add new features knowing tests will catch regressions

---

**Time to first test:** ~30 minutes
**Time to production-ready suite:** ~2 weeks (following the full strategy)
