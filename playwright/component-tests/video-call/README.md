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

### VideoCall.layout.ct.jsx
**Purpose**: Test layout behavior with different numbers of participants.

**Tests**:
- `multi-player scenario with three connected players` - Verifies all 3 tiles render

**When to add tests here**: Add tests for:
- Different player counts (1, 2, 3, 4, 5+ players)
- Responsive layout behavior (grid vs. row layouts)
- Tile sizing and positioning
- Overflow behavior with many participants

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
- `singlePlayerConnected` - 1 player, fully connected with video/audio on
- `singlePlayerVideoMuted` - 1 player, video muted
- `singlePlayerNotConnected` - 1 player, not connected to Daily yet
- `twoPlayersOneWaiting` - 2 players, only player 0 connected
- `threePlayersConnected` - 3 players, all connected

See [shared/fixtures.js](../shared/fixtures.js) for full configurations.

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
