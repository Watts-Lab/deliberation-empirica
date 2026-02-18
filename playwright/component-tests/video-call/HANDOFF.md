# Integration Tests Handoff - December 2024

**📢 UPDATE (February 2026): INTEGRATION TESTS NOW WORKING! ✅**

See [INTEGRATION-COMPLETE.md](./INTEGRATION-COMPLETE.md) for completion summary.
- All infrastructure complete
- 11/11 tests passing
- hooksConfig pattern implemented successfully
- Debug files cleaned up

---

## Original Session Summary (December 2024)

Investigated why Playwright Component Tests integration tests weren't rendering VideoCall component with real Daily.co connections.

## Root Cause Found

**Playwright Component Testing serializes JSX props**, which loses prototype methods on class instances.

### The Problem
```javascript
// ❌ This pattern FAILS in integration tests
const players = [new MockPlayer('p0', {...})];
await mount(<MockEmpiricaProvider players={players}>...</MockEmpiricaProvider>);
// ERROR: player.get is not a function
```

When Playwright's `mount()` serializes props to pass to browser context:
- `MockPlayer` instance → plain `Object`
- Prototype methods (`.get()`, `.set()`) are lost
- Component crashes when trying to call `player.get()`

### The Solution
```javascript
// ✅ Use hooksConfig pattern (like mocked tests do)
await mount(<VideoCall />, {
  hooksConfig: {
    empirica: {
      currentPlayerId: 'p0',
      players: [{id: 'p0', attrs: {...}}],  // Plain objects
    }
  }
});
// beforeMount hook creates MockPlayer instances in browser context
```

## Key Discoveries

### 1. Locator Issue (SOLVED)
- **Problem**: `component.locator()` couldn't find elements
- **Cause**: Components mounted without `hooksConfig` render outside Playwright's component boundary
- **Fix**: Use `page.locator()` instead of `component.locator()` for direct JSX mounting

### 2. Serialization Issue (SOLUTION IDENTIFIED)
- **Problem**: Class instances lose methods when passed as JSX props
- **Cause**: Playwright serializes props via JSON
- **Fix**: Use `hooksConfig` pattern so objects are created in browser context

### 3. Multi-Participant Limitation (ARCHITECTURAL)
- **Finding**: Playwright Component Testing is single-context only
- **Impact**: Cannot test dailyId synchronization between participants
- **Decision**: Use Cypress E2E for multi-participant, Playwright CT for single-participant edge cases

## Files Changed This Session

### Modified
- `playwright/component-tests/video-call/README.md` - Added comprehensive architecture documentation
- `playwright/component-tests/video-call/integration/Debug.test.ct.jsx` - Added `page` parameter, changed to `page.locator()`
- `playwright/component-tests/video-call/integration/VideoCall.integration.ct.jsx` - Changed to `page.locator()`
- `playwright/mocks/empirica-hooks.js` - Removed debug logs

### Created (for debugging - can delete or keep as examples)
- `playwright/component-tests/video-call/integration/SimpleDebug.ct.jsx` - Minimal test showing locator issue
- `playwright/component-tests/video-call/integration/ErrorDebug.ct.jsx` - Test capturing console errors

## Next Steps to Fix Integration Tests

### 1. Update beforeMount Hook to Support Real Daily
**File**: `playwright/index.jsx`

Add support for integration tests that need real Daily:

```javascript
beforeMount(async ({ App, hooksConfig }) => {
  if (!hooksConfig) {
    return <App />;
  }

  const { empirica, daily } = hooksConfig;

  // Create mock objects from serialized config
  const players = createPlayers(empirica?.players);
  const game = createGame(empirica?.game);
  const stage = createStage(empirica?.stage);

  let wrapped = (
    <div style={{ width: '800px', height: '600px', display: 'flex', flexDirection: 'column' }}>
      <App />
    </div>
  );

  // NEW: Support real Daily for integration tests
  if (daily?.roomUrl) {
    // Import DailyTestWrapper dynamically or conditionally
    wrapped = (
      <DailyTestWrapper roomUrl={daily.roomUrl}>
        {wrapped}
      </DailyTestWrapper>
    );
  } else if (daily) {
    // Use mock Daily provider
    wrapped = <MockDailyProvider {...daily}>{wrapped}</MockDailyProvider>;
  }

  if (empirica) {
    wrapped = (
      <MockEmpiricaProvider
        currentPlayerId={empirica.currentPlayerId}
        players={players}
        game={game}
        stage={stage}
        {...empirica}
      >
        {wrapped}
      </MockEmpiricaProvider>
    );
  }

  return wrapped;
});
```

### 2. Create Integration Fixtures
**File**: `playwright/component-tests/shared/integration-fixtures.js`

```javascript
export const singlePlayerRealDaily = {
  empirica: {
    currentPlayerId: 'p0',
    players: [{ id: 'p0', attrs: { name: 'Test Player', position: '0' } }],
    game: { attrs: { dailyUrl: 'ROOM_URL_PLACEHOLDER' } },
    stage: { attrs: {} },
  },
  daily: {
    roomUrl: 'ROOM_URL_PLACEHOLDER',  // Will be replaced in test
  },
};
```

### 3. Convert Integration Tests
**File**: `playwright/component-tests/video-call/integration/VideoCall.integration.ct.jsx`

```javascript
test('single participant joins and sees self-view', async ({ mount, page }) => {
  const room = await createTestRoom();

  // Use hooksConfig pattern
  const config = {
    ...singlePlayerRealDaily,
    empirica: {
      ...singlePlayerRealDaily.empirica,
      game: { attrs: { dailyUrl: room.url } }
    },
    daily: { roomUrl: room.url }
  };

  const component = await mount(<VideoCall showSelfView />, {
    hooksConfig: config
  });

  // Now use page.locator() (component is wrapped differently)
  await expect(page.locator('[data-test="callTile"]')).toBeVisible();
});
```

### 4. Test the Fix
```bash
# Clear cache
rm -rf playwright/.cache

# Run integration tests
npm run test:component:integration
```

## Testing Strategy Going Forward

### Playwright Component Tests (Single-Participant)
**Use for**:
- Safari audio context suspension recovery
- Device switching mid-call
- Permission revocation handling
- Browser autoplay blocking
- Network interruption recovery
- Layout calculations (any # of participants)

**Pattern**:
```javascript
test('edge case name', async ({ mount, page }) => {
  const room = await createTestRoom();

  await mount(<VideoCall />, {
    hooksConfig: {
      empirica: { /* player config */ },
      daily: { roomUrl: room.url }
    }
  });

  // Test single-participant behavior
});
```

### Cypress E2E (Multi-Participant)
**Use for**:
- dailyId synchronization between participants
- Cross-player visual updates (A mutes → B sees indicator)
- Backend state sync
- Full user flows with multiple players

## Questions for Next Session (ANSWERED ✅)

1. ✅ **Should we move `DailyTestWrapper` into the `beforeMount` hook?**
   - **ANSWER**: Yes, moved! `beforeMount` now dynamically imports `DailyTestWrapper` when `daily.roomUrl` is present

2. ✅ **Do we want separate fixture files for integration tests?**
   - **ANSWER**: Yes, created `integration-fixtures.js` with `singlePlayerRealDaily`, `withRoomUrl()` helper, etc.

3. ✅ **Should we delete the debug test files?**
   - **ANSWER**: Yes, deleted all debug files (Debug.test.ct.jsx, ErrorDebug.ct.jsx, SimpleDebug.ct.jsx, DailyTestWrapper.test.ct.jsx)

## Resources

- [Playwright Component Testing Docs](https://playwright.dev/docs/test-components)
- [Ministry of Testing: Multi-user Playwright](https://club.ministryoftesting.com/t/how-do-you-approach-testing-multi-user-workflows-in-playwright/84901)
- [Daily.co WebRTC Testing](https://www.daily.co/blog/testing-dailys-webrtc-performance-with-testrtc/)

## Current Test Status (February 2026 Update)

**Mocked Tests**: ✅ 29/29 passing (~12 seconds)
**Integration Tests**: ✅ 11/11 passing (~10 seconds) - **COMPLETE!**

We now have:
- ✅ Fast mocked tests for development (every commit)
- ✅ Real Daily.co integration tests for edge cases (pre-release)
- ✅ Framework for additional edge case testing (6 TODOs ready to implement)
- Cypress E2E for multi-participant scenarios (full flows)

**See [INTEGRATION-COMPLETE.md](./INTEGRATION-COMPLETE.md) for implementation details.**
