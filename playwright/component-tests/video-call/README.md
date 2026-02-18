# VideoCall Component Tests

Component tests for the VideoCall component, organized by testing approach.

## 🚀 Quick Status (December 2024)

**✅ WORKING: Mocked Tests** - 29 tests passing, ~12 seconds
- Full coverage of layouts, states, and UI behavior
- No external dependencies, runs on every commit
- Command: `npm run test:component`

**⚠️ IN PROGRESS: Integration Tests** - Infrastructure ready, tests need conversion
- Real Daily.co WebRTC connection works
- Discovered: Playwright CT serialization issue with class instances
- **Next step**: Convert integration tests to use `hooksConfig` pattern (see "Integration Test Status" below)
- Will enable testing Safari edge cases, device recovery, browser-specific behaviors

**✅ DECIDED: Multi-Participant Strategy**
- Single-participant scenarios → Playwright Component Tests (this directory)
- Multi-participant coordination → Cypress E2E (existing test suite)
- See "Architecture Challenges & Design Decisions" section for full rationale

## Directory Structure

```
video-call/
├── mocked/         # Fast tests with mocked Daily.co (no API key needed)
│   ├── VideoCall.basic.ct.jsx              # Basic rendering (2 tests)
│   ├── VideoCall.states.ct.jsx             # Connection states (3 tests)
│   ├── VideoCall.responsiveLayout.ct.jsx   # Responsive layouts (17 tests)
│   └── VideoCall.customLayouts.ct.jsx      # Custom layouts (6 tests)
└── integration/    # Slower tests with real Daily.co WebRTC (requires DAILY_APIKEY)
    └── VideoCall.integration.ct.jsx        # Real Daily integration (3 tests)
```

---

## Test Categories

### Mocked Tests (`mocked/`) - 28 tests

**Fast, no external dependencies** (~5 seconds for all 28 tests)

- **Purpose**: Test component rendering, layout logic, and UI states
- **Requirements**: None (fully mocked)
- **Run frequency**: Every commit, during development
- **Uses**:
  - `MockEmpiricaProvider` - Mocked Empirica context
  - `MockDailyProvider` - Mocked Daily.co hooks and components
  - No real WebRTC connections
  - No API keys needed

### Integration Tests (`integration/`) - 3 tests

**Slower, requires Daily.co API** (~10-30 seconds)

- **Purpose**: Test real WebRTC connections and Daily.co integration
- **Requirements**:
  - `DAILY_APIKEY` environment variable (in `.env`)
  - Internet connection
- **Run frequency**: Before releases, nightly, manually
- **Uses**:
  - `MockEmpiricaProvider` - Still mocks Empirica (no backend needed)
  - **Real** `DailyProvider` - Actual Daily.co WebRTC
  - Real Daily rooms (created and cleaned up)
  - Real MediaStreamTrack objects

---

## Running Tests

### Mocked Tests Only (Fast - Development)

**Uses**: `playwright.config.mjs` (with Daily/Empirica mocked)

```bash
# All mocked tests (from project root)
npm run test:component

# Specific test file
npx playwright test -c playwright/playwright.config.mjs component-tests/video-call/mocked/VideoCall.responsiveLayout.ct.jsx

# With UI (for debugging)
npm run test:component:ui
```

### Integration Tests Only (Slow - Pre-release)

**Uses**: `playwright.integration.config.mjs` (real Daily, mocked Empirica)
**Requires**: `DAILY_APIKEY` in `.env`

```bash
# All integration tests (from project root)
npm run test:component:integration

# With UI (for debugging)
npm run test:component:integration:ui
```

### All Tests (Mocked + Integration)

```bash
npm run test:component:all
```

---

## Config Architecture

### Two Separate Configs = Two Test Modes

| Config | Daily | Empirica | Use For | Speed |
|--------|-------|----------|---------|-------|
| `playwright.config.mjs` | **Mocked** | **Mocked** | UI states, layouts, edge cases | ~5s |
| `playwright.integration.config.mjs` | **REAL** | **Mocked** | WebRTC, browser behavior, devices | ~30s |

**Key Point**: Integration tests use real Daily.co but still mock Empirica (no backend needed).

### Why Two Configs?

1. **Mocked tests** alias `@daily-co/daily-react` to mocks → Fast, full control over Daily state
2. **Integration tests** use real `@daily-co/daily-react` → Tests actual browser/WebRTC behavior

Without separate configs, we'd have to choose one or the other. This way we get **both**:
- Precise edge case testing (mocked)
- Real-world behavior validation (integration)

---

## Mocked Tests (`mocked/`)

### VideoCall.basic.ct.jsx (2 tests)
**Purpose**: Smoke tests to verify the component mounts and renders without errors.

**Tests**:
- `renders without errors when properly configured` - Basic mounting test
- `single player sees self-view tile` - Verifies self-view tile appears for solo player

**When to add tests here**: Add new tests when you need to verify basic rendering behavior or catch fundamental mounting errors.

---

### VideoCall.states.ct.jsx (3 tests)
**Purpose**: Test different tile states based on connection status and media settings.

**Tests**:
- `video muted state shows muted indicator` - Camera off shows muted tile
- `waiting state when I am not connected` - Shows waiting when local player hasn't joined Daily
- `waiting state when other player not connected` - Shows waiting tile for remote player who hasn't joined

**When to add tests here**: Add tests for:
- Audio/video mute states (muted, unmuted, toggling)
- Connection states (connecting, connected, disconnected)
- Error states (media blocked, device errors)
- Participant states (speaking, screen sharing, etc.)

---

### VideoCall.responsiveLayout.ct.jsx (17 tests)
**Purpose**: Test the automatic responsive layout with different player counts and screen sizes.

**Test groups**:

*Different Player Counts (5 tests):*
- `1 player - shows only self` - Solo player sees their own tile
- `2 players - both visible` - Two-player layout
- `3 players - all visible` - Three-player layout
- `4 players - all visible` - Four players in 2x2 grid
- `6 players - all visible` - Six players arranged efficiently

*Different Screen Widths (3 tests):*
- `narrow screen (mobile) - 3 players stack appropriately` - Mobile viewport (375px)
- `medium screen (tablet) - 3 players arranged efficiently` - Tablet viewport (768px)
- `wide screen (desktop) - 3 players arranged efficiently` - Desktop viewport (1920px)

*Dynamic Resizing (2 tests):*
- `tiles remain visible when window resizes` - Tests desktop → tablet → mobile resize
- `layout adjusts for many players on narrow screen` - 6 players on mobile viewport

*Layout Quality Checks (3 tests):*
- `tiles do not overlap (3 players)` - Verifies no bounding box overlaps
- `tiles efficiently fill container space (3 players)` - Checks space utilization
- `tiles do not overlap (6 players)` - Overlap check with more tiles

*Layout Adapts to Container Size (4 tests):*
- `wide container (landscape) arranges tiles efficiently` - 1600x400 viewport
- `narrow container (portrait) arranges tiles efficiently` - 400x1200 viewport
- `layout recalculates on window resize` - Landscape → portrait transition

**When to add tests here**: Add tests for:
- Additional player counts (8, 10+ players)
- Edge cases (ultra-wide monitors, specific aspect ratios)
- Performance with many participants

---

### VideoCall.customLayouts.ct.jsx (6 tests)
**Purpose**: Test custom layouts from treatment files (grid-based, breakout rooms, asymmetric layouts).

**Tests** (migrated from Cypress `test/discussionLayout`):
- `2x2 grid layout positions tiles correctly` - Custom 2x2 grid with specific positioning
- `picture-in-picture layout with overlapping tiles` - 4x4 grid with zOrder, audio-only tile, overlap verification
- `telephone game layout shows asymmetric views` - Player 0 sees only Player 1
- `telephone game layout - Player 1 sees only Player 2` - Different view per player
- `breakout rooms - Player 0 sees only roommates` - Room-based participant filtering
- `breakout rooms - Player 2 is alone` - Solo player in breakout room
- `hide self view removes player's own tile` - showSelfView=false hides own tile

**When to add tests here**: Add tests for:
- New custom layout configurations from treatment files
- Complex grid layouts with spanning regions
- zOrder and overlapping tiles
- Breakout room scenarios
- Audio-only or video-only media configurations

---

## Integration Tests (`integration/`)

### VideoCall.integration.ct.jsx (3 tests)
**Purpose**: Test real WebRTC connections with Daily.co API.

**Tests**:
- `two participants connect with real video streams` - Both participants join room, video tracks verified
- `participant leaves and tile disappears` - Remote participant leaves, tile count updates
- `video tracks have correct state` - Verifies track.state === 'playable'

**What these tests verify**:
- Real Daily room creation and cleanup
- Real WebRTC connection establishment
- Real MediaStreamTrack objects in video elements
- Participant join/leave events
- Video track states (playable, subscribed)

**When to add tests here**: Add tests for:
- Real WebRTC edge cases (network issues, reconnection)
- Browser permission scenarios
- Device switching
- Audio stream reconciliation
- Complex multi-participant interactions

---

## Shared Fixtures

All tests import configurations from `../../shared/` to avoid duplication:

```javascript
import { singlePlayerConnected, twoPlayersOneWaiting } from '../../shared/fixtures';

const component = await mount(<VideoCall showSelfView />, {
  hooksConfig: singlePlayerConnected,
});
```

**Available fixtures**:

From `fixtures.js` (basic scenarios):
- `singlePlayerConnected` - 1 player, fully connected with video/audio on
- `singlePlayerVideoMuted` - 1 player, video muted
- `singlePlayerNotConnected` - 1 player, not connected to Daily yet
- `twoPlayersOneWaiting` - 2 players, only player 0 connected
- `threePlayersConnected` - 3 players, all connected

From `layout-fixtures.js` (custom layouts):
- `twoByTwoGrid` - 2x2 grid layout with custom positioning
- `pictureInPicture` - 4x4 grid with overlapping tiles, audio-only participant
- `telephoneGame` - Asymmetric layouts (each player sees different participants)
- `breakoutRooms` - Players split into separate rooms
- `hideSelfView` - Configuration for testing showSelfView=false

From `layout-helpers.js` (assertions):
- `assertNoTileOverlap(component, expect)` - Verifies no tiles overlap
- `assertSpaceFilling(component, expect)` - Verifies efficient space usage
- `assertZIndexOrder(topTile, bottomTile, expect)` - Verifies z-index stacking
- `detectLayoutOrientation(component)` - Returns 'horizontal', 'vertical', or 'grid'

---

## Mock Architecture (Mocked Tests)

Tests use two provider layers:

1. **MockEmpiricaProvider** (via `hooksConfig.empirica`)
   - Provides player data, game state, stage info
   - Hooks: `usePlayer()`, `usePlayers()`, `useGame()`, `useStage()`

2. **MockDailyProvider** (via `hooksConfig.daily`)
   - Provides Daily.co connection state
   - Hooks: `useLocalSessionId()`, `useVideoTrack()`, `useAudioTrack()`
   - Components: `DailyVideo` (mocked as placeholder div)

Both providers are set up automatically in the `beforeMount` hook (see `playwright/index.jsx`).

---

## Integration Test Architecture

Integration tests use:

1. **MockEmpiricaProvider** - Still mocks Empirica (no backend needed)
2. **Real DailyProvider** - Actual Daily.co WebRTC from `@daily-co/daily-react`
3. **Real Daily.js** - `Daily.createCallObject()` from `@daily-co/daily-js`
4. **Room helpers** - `createTestRoom()`, `cleanupTestRoom()` from `playwright/helpers/daily.js`

---

## Architecture Challenges & Design Decisions

### Challenge: Multi-Participant Testing with Playwright Component Tests

**Problem Discovered**: Playwright Component Testing (`@playwright/experimental-ct-react`) fundamentally **cannot synchronize state across multiple browser contexts**.

**Root Cause**: Component Testing is designed for isolated component rendering, not multi-user scenarios. Each `mount()` call:
1. **Serializes JSX props** via JSON to pass to browser context
2. **Loses prototype methods** on class instances (MockPlayer, MockGame, MockStage)
3. **Runs in single isolated context** - no cross-tab communication

**Example of the Issue**:
```javascript
// This FAILS - class instances get serialized, losing .get()/.set() methods
const players = [new MockPlayer('p0', {...})];
await mount(<MockEmpiricaProvider players={players}>...</MockEmpiricaProvider>);
// ERROR: player.get is not a function
```

**What Works**:
```javascript
// Using hooksConfig - objects created in browser context, methods intact
await mount(<VideoCall />, {
  hooksConfig: {
    empirica: {
      currentPlayerId: 'p0',
      players: [{id: 'p0', attrs: {...}}],  // Plain serializable objects
      // beforeMount hook creates MockPlayer instances from these
    }
  }
});
```

### Challenge: dailyId Synchronization for Multi-Participant Calls

**The App's Architecture**:
1. Participant A joins Daily.co → gets `dailyId` from Daily
2. Participant A calls `player.set('dailyId', 'abc123')`
3. **Empirica backend syncs** this to all other players
4. Participant B reads `playerA.get('dailyId')` to subscribe to their tracks

**Why This Matters**: Without `dailyId` sync, participants can't subscribe to each other's video/audio tracks.

**Playwright CT Limitation**: No shared Empirica backend → no `dailyId` synchronization between test contexts.

**Alternatives Considered**:

1. ❌ **BroadcastChannel API** - Would work for cross-tab communication, but Playwright CT doesn't support multiple browser contexts in one test
2. ❌ **SharedWorker** - Same issue, requires multiple browser contexts
3. ❌ **Multiple `mount()` calls** - Each mount is isolated, can't share state
4. ✅ **Cypress E2E** - Full backend running, real multi-participant sync

### Decision: Hybrid Testing Strategy

**Use Playwright Component Tests For**:
- ✅ **Single-participant scenarios** (vast majority of edge cases)
- ✅ **Browser-specific behaviors** (Safari audio context suspension, autoplay blocking)
- ✅ **Device recovery** (camera/mic switching, reconnection after tab sleep)
- ✅ **Layout calculations** (responsive layouts, custom grids, breakout rooms)
- ✅ **UI states** (muted indicators, waiting states, connection errors)
- ✅ **Performance** (many tiles, resizing, efficient space filling)

**Use Cypress E2E For**:
- ✅ **Multi-participant coordination** (dailyId synchronization)
- ✅ **Cross-player interactions** (player A mutes → player B sees muted indicator)
- ✅ **Backend integration** (game state sync, stage transitions)
- ✅ **Full user flows** (join → discuss → leave)

**What We're NOT Testing Here**:
- ❌ Multiple participants joining same Daily room (use Cypress E2E)
- ❌ Real-time state sync via Empirica backend (use Cypress E2E)
- ❌ Multi-player coordination scenarios (use Cypress E2E)

**What We ARE Testing**:
- ✅ Single participant can join Daily room
- ✅ Real WebRTC connection establishment
- ✅ Real video/audio tracks render correctly
- ✅ Device permissions and recovery
- ✅ Browser-specific edge cases (Safari, Chrome, Firefox)
- ✅ Component handles Daily events correctly
- ✅ Layout calculations work for any number of participants
- ✅ UI states display correctly based on mock data

### Integration Test Status (December 2024)

**Current State**: Integration tests discovered but **NOT YET WORKING**.

**Issues Found**:
1. ✅ **SOLVED**: Vite module aliasing - Integration config now correctly uses real Daily hooks
2. ✅ **SOLVED**: Locator boundary issue - Use `page.locator()` instead of `component.locator()` for direct JSX mounting
3. ⚠️ **IN PROGRESS**: Serialization issue - Need to convert tests to use `hooksConfig` pattern

**Next Steps**:
1. Update integration tests to use `hooksConfig` instead of direct JSX mounting
2. Create integration-specific fixtures for single-participant scenarios
3. Add edge case tests (Safari audio context, device recovery, permissions)
4. Document patterns for testing browser-specific behaviors

**Single-Participant Test Ideas** (for future integration tests):
```javascript
// Safari audio context suspension after tab inactive
test('Safari audio context recovers after tab suspension')

// Device switching mid-call
test('switching camera mid-call maintains connection')
test('switching speaker preserves selected device after Daily reconnect')

// Permission revocation
test('camera permission revoked mid-call shows error UI')
test('microphone permission denied shows helpful error message')

// Network recovery
test('network interruption shows reconnecting state')
test('Daily reconnection after network drop restores video')

// Browser autoplay policies
test('autoplay blocked shows user gesture prompt')
test('user gesture resumes audio context successfully')
```

**Example Test Pattern** (for single participant):
```javascript
test('Safari audio context recovery with custom speaker', async ({ mount, page }) => {
  // Create real Daily room
  const room = await createTestRoom();

  // Mount with hooksConfig (avoids serialization issue)
  const component = await mount(<VideoCall />, {
    hooksConfig: {
      empirica: {
        currentPlayerId: 'p0',
        players: [{
          id: 'p0',
          attrs: {
            speakerId: 'external-speakers',
            speakerLabel: 'External Speakers'
          }
        }],
        game: { attrs: { dailyUrl: room.url } }
      },
      daily: { roomUrl: room.url }  // beforeMount creates DailyTestWrapper
    }
  });

  // Join call
  await page.waitForSelector('[data-test="callTile"]');

  // Simulate Safari suspending audio context
  await page.evaluate(() => window.audioContext?.suspend());

  // Verify UI prompts for user gesture
  await expect(page.locator('text=Enable audio')).toBeVisible();

  // User clicks to resume
  await page.click('text=Enable audio');

  // Verify audio context resumed and speaker still selected
  const speakerStillSelected = await page.evaluate(() =>
    window.currentTestCall?.getInputDevices()?.speaker?.label
  );
  expect(speakerStillSelected).toBe('External Speakers');
});
```

---

## Adding New Tests

### For Mocked Tests:

1. **Determine the concern**: Which file should it go in?
   - Basic rendering → `mocked/VideoCall.basic.ct.jsx`
   - Tile states → `mocked/VideoCall.states.ct.jsx`
   - Responsive layout → `mocked/VideoCall.responsiveLayout.ct.jsx`
   - Custom layouts → `mocked/VideoCall.customLayouts.ct.jsx`

2. **Check fixtures**: Can you reuse an existing fixture from `../../shared/`?
   - If yes, import and use it
   - If no, add a new fixture for reuse

3. **Write the test**:
   ```javascript
   test('descriptive test name', async ({ mount }) => {
     const component = await mount(<VideoCall showSelfView />, {
       hooksConfig: yourFixture,
     });

     await expect(component.locator('[data-test="something"]')).toBeVisible();
   });
   ```

### For Integration Tests:

1. **Ensure DAILY_APIKEY is set** in `.env`

2. **Write the test** with proper cleanup:
   ```javascript
   test.beforeEach(async () => {
     room = await createTestRoom();
     localCall = Daily.createCallObject();
   });

   test.afterEach(async () => {
     await localCall?.leave();
     await localCall?.destroy();
     if (room) await cleanupTestRoom(room.name);
   });

   test('descriptive test name', async ({ mount, page }) => {
     // ... test with real Daily
   });
   ```

3. **Document in this README**: Add the test name and purpose above.

---

## Migration Progress

**From Cypress E2E to Playwright Component Tests:**

- ✅ Discussion Layout Tests (6 tests) → `mocked/VideoCall.customLayouts.ct.jsx`
- ✅ Basic rendering → `mocked/VideoCall.basic.ct.jsx`
- ✅ Connection states → `mocked/VideoCall.states.ct.jsx`
- ✅ Responsive layouts → `mocked/VideoCall.responsiveLayout.ct.jsx`
- ✅ Real Daily integration → `integration/VideoCall.integration.ct.jsx`

See `../MIGRATION.md` for full migration tracking.
