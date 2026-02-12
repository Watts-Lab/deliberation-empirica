# VideoCall Component Tests

Component tests for the VideoCall component using mocked Empirica and Daily.co providers.

## Test Organization

Tests are organized by concern into separate files:

### VideoCall.basic.ct.jsx
**Purpose**: Smoke tests to verify the component mounts and renders without errors.

**Tests**:
- `renders without errors when properly configured` - Basic mounting test
- `single player sees self-view tile` - Verifies self-view tile appears for solo player

**When to add tests here**: Add new tests when you need to verify basic rendering behavior or catch fundamental mounting errors.

---

### VideoCall.states.ct.jsx
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

### VideoCall.responsiveLayout.ct.jsx
**Purpose**: Test the automatic responsive layout with different player counts and screen sizes.

**Tests**:

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

**When to add tests here**: Add tests for:
- Additional player counts (8, 10+ players)
- Edge cases (ultra-wide monitors, portrait orientation)
- Specific responsive breakpoints
- Performance with many participants

---

### VideoCall.customLayouts.ct.jsx
**Purpose**: Test custom layouts from treatment files (grid-based, breakout rooms, asymmetric layouts).

**Tests** (migrated from Cypress `test/discussionLayout`, 7 tests):
- `2x2 grid layout positions tiles correctly` - Custom 2x2 grid with specific positioning
- `picture-in-picture layout with overlapping tiles` - 4x4 grid with zOrder, audio-only tile
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
- Layout edge cases (empty rooms, single participant, etc.)

---

## Shared Fixtures

All tests import configurations from `../shared/fixtures.js` to avoid duplication:

```javascript
import { singlePlayerConnected, twoPlayersOneWaiting } from '../shared/fixtures';

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
- `defaultLayout` - 3 players, default responsive layout
- `twoByTwoGrid` - 2x2 grid layout with custom positioning
- `pictureInPicture` - 4x4 grid with overlapping tiles, audio-only participant
- `telephoneGame` - Asymmetric layouts (each player sees different participants)
- `breakoutRooms` - Players split into separate rooms
- `hideSelfView` - Configuration for testing showSelfView=false

See [shared/fixtures.js](../shared/fixtures.js) and [shared/layout-fixtures.js](../shared/layout-fixtures.js) for full configurations.

---

## Mock Architecture

Tests use two provider layers:

1. **MockEmpiricaProvider** (via `hooksConfig.empirica`)
   - Provides player data, game state, stage info
   - Hooks: `usePlayer()`, `usePlayers()`, `useGame()`, `useStage()`

2. **MockDailyProvider** (via `hooksConfig.daily`)
   - Provides Daily.co connection state
   - Hooks: `useLocalSessionId()`, `useVideoTrack()`, `useAudioTrack()`
   - Components: `DailyVideo` (mocked as placeholder div)

Both providers are set up automatically in the `beforeMount` hook (see [playwright/index.jsx](../../index.jsx)).

---

## Running Tests

```bash
# Run all component tests
npm run test:component

# Run in headed mode (see browser)
npm run test:component:headed

# Run with Playwright UI (interactive mode)
npm run test:component:ui

# Run only VideoCall tests
npm run test:component -- video-call
```

---

## Adding New Tests

1. **Determine the concern**: Which file should it go in?
   - Basic rendering → `VideoCall.basic.ct.jsx`
   - Tile states → `VideoCall.states.ct.jsx`
   - Layout behavior → `VideoCall.layout.ct.jsx`

2. **Check fixtures**: Can you reuse an existing fixture from `shared/fixtures.js`?
   - If yes, import and use it
   - If no, add a new fixture to `fixtures.js` for reuse

3. **Write the test**:
   ```javascript
   test('descriptive test name', async ({ mount }) => {
     const component = await mount(<VideoCall showSelfView />, {
       hooksConfig: yourFixture,
     });

     await expect(component.locator('[data-test="something"]')).toBeVisible();
   });
   ```

4. **Document in this README**: Add the test name and purpose to the appropriate section above.

---

## Future Test Ideas

**States to test**:
- Audio mute indicator
- Mixed states (video on, audio off)
- Screen sharing state
- Participant left state
- Network quality indicators

**Layout scenarios**:
- 4 players (2x2 grid)
- 5+ players (overflow behavior)
- Dynamic addition/removal of participants
- Resizing behavior

**Interactive behaviors**:
- Toggle video button
- Toggle audio button
- Leave call button
- Full-screen toggle
