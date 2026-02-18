# Mock Architecture

Mock providers and hooks for Playwright Component Testing.

## Overview

Component tests use mocked Empirica and Daily.co providers to test components in isolation without requiring a real backend or WebRTC connections. This architecture uses Vite module aliasing to redirect imports to mock implementations.

## How Mocking Works

### 1. Vite Module Aliasing

In `playwright.config.mjs`, imports are redirected to mock implementations:

```javascript
ctViteConfig: {
  resolve: {
    alias: [
      {
        find: '@empirica/core/player/classic/react',
        replacement: path.resolve(__dirname, './mocks/empirica-hooks.js'),
      },
      {
        find: '@daily-co/daily-react',
        replacement: path.resolve(__dirname, './mocks/daily-hooks.jsx'),
      },
    ],
  },
}
```

When component code imports:
```javascript
import { usePlayer, usePlayers } from '@empirica/core/player/classic/react';
```

It actually gets:
```javascript
import { usePlayer, usePlayers } from './mocks/empirica-hooks.js';
```

### 2. Provider-Based State

Mock hooks read state from React context providers:

```javascript
// Test passes config via hooksConfig
const component = await mount(<VideoCall />, {
  hooksConfig: {
    empirica: { currentPlayerId: 'p0', players: [...] },
    daily: { localSessionId: 'daily-123', ... },
  },
});

// beforeMount hook wraps component
<MockEmpiricaProvider {...hooksConfig.empirica}>
  <MockDailyProvider {...hooksConfig.daily}>
    <VideoCall />
  </MockDailyProvider>
</MockEmpiricaProvider>

// Mock hooks read from context
export function usePlayer() {
  const { currentPlayerId, players } = useContext(MockEmpiricaContext);
  return players.find(p => p.id === currentPlayerId);
}
```

## Mock Layers

### Layer 1: MockEmpiricaProvider

**File**: `MockEmpiricaProvider.jsx`

**Purpose**: Provides Empirica game state (players, game, stage, timer).

**Configuration via `hooksConfig.empirica`**:
```javascript
{
  currentPlayerId: 'p0',           // Which player's perspective
  players: [                       // Array of MockPlayer instances
    { id: 'p0', attrs: { name: 'Player 0', position: '0' } }
  ],
  game: { attrs: { dailyUrl: 'https://...' } },    // MockGame
  stage: { attrs: {} },            // MockStage
  stageTimer: { elapsed: 0 },      // Timer state
  progressLabel: 'test_0_stage',   // Optional progress label
  elapsedTime: 0,                  // Optional elapsed time (number or function)
}
```

**Provides context for hooks**:
- `usePlayer()` - Returns current player
- `usePlayers()` - Returns all players
- `useGame()` - Returns game object
- `useStage()` - Returns stage object
- `useStageTimer()` - Returns timer state
- `useProgressLabel()` - Returns progress label
- `useGetElapsedTime()` - Returns elapsed time getter

### Layer 2: MockDailyProvider

**File**: `MockDailyProvider.jsx`

**Purpose**: Provides Daily.co call state (participants, tracks, session).

**Configuration via `hooksConfig.daily`**:
```javascript
{
  localSessionId: 'daily-123',     // My Daily session ID
  participantIds: ['daily-123', 'daily-456'],  // All participants in call
  videoTracks: {
    'daily-123': { isOff: false, subscribed: true },
    'daily-456': { isOff: true, subscribed: true },
  },
  audioTracks: {
    'daily-123': { isOff: false, subscribed: true },
    'daily-456': { isOff: false, subscribed: true },
  },
}
```

**Provides context for hooks**:
- `useLocalSessionId()` - Returns my session ID
- `useVideoTrack(sessionId)` - Returns video track state
- `useAudioTrack(sessionId)` - Returns audio track state
- `useParticipantProperty(sessionId, prop)` - Returns participant property
- `DailyVideo` - Mocked as placeholder div
- `DailyAudio` - Mocked as null

## Mock Objects

### MockPlayer

**File**: `MockPlayer.js`

Stateful mock of Empirica player with attribute tracking.

```javascript
const player = new MockPlayer('p0', { name: 'Test User', position: '0' });

// Get attributes
player.get('name');           // 'Test User'
player.get('position');       // '0'

// Set attributes
player.set('dailyId', 'daily-123');

// Append to array attributes
player.append('history', { event: 'joined' });

// Nested stage
player.stage.get('submit');
player.stage.set('submit', true);
```

### MockGame

**File**: `MockGame.js`

Mock of Empirica game object.

```javascript
const game = new MockGame({ dailyUrl: 'https://test.daily.co/room' });

game.get('dailyUrl');
game.set('treatment', 'control');
```

### MockStage

**File**: `MockStage.js`

Mock of Empirica stage object.

```javascript
const stage = new MockStage({ callStarted: false });

stage.get('callStarted');
stage.set('discussion', true);
```

## File Reference

| File | Purpose |
|------|---------|
| `MockEmpiricaProvider.jsx` | React context provider for Empirica state |
| `MockDailyProvider.jsx` | React context provider for Daily state |
| `empirica-hooks.js` | Mock hooks that read from MockEmpiricaContext |
| `daily-hooks.jsx` | Mock hooks that read from MockDailyContext |
| `MockPlayer.js` | Stateful player object |
| `MockGame.js` | Game object |
| `MockStage.js` | Stage object |
| `sentry-mock.js` | No-op Sentry functions |
| `index.js` | Exports all mocks |

## Usage in Tests

### Basic Test

```javascript
import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../client/src/call/VideoCall';

test('my test', async ({ mount }) => {
  const component = await mount(<VideoCall />, {
    hooksConfig: {
      empirica: {
        currentPlayerId: 'p0',
        players: [{ id: 'p0', attrs: { name: 'Test User', position: '0' } }],
        game: { attrs: { dailyUrl: 'https://test.daily.co/room' } },
        stage: { attrs: {} },
        stageTimer: { elapsed: 0 },
      },
      daily: {
        localSessionId: 'daily-123',
        participantIds: ['daily-123'],
        videoTracks: { 'daily-123': { isOff: false, subscribed: true } },
        audioTracks: { 'daily-123': { isOff: false, subscribed: true } },
      },
    },
  });

  await expect(component).toBeVisible();
});
```

### Using Shared Fixtures

```javascript
import { singlePlayerConnected } from '../shared/fixtures';

test('my test', async ({ mount }) => {
  const component = await mount(<VideoCall />, {
    hooksConfig: singlePlayerConnected,
  });

  await expect(component).toBeVisible();
});
```

## Shared vs Per-Player State

### Shared State
These objects are shared across all players (same reference):
- `game` - Game-level attributes
- `stage` - Stage-level attributes (NOT player.stage)
- `players` - Array of all player objects

### Per-Player State
- `currentPlayerId` - Which player's perspective
- `player` (via `usePlayer()`) - Returns current player from shared `players` array
- `player.stage` - Per-player stage data (different from shared `stage`)

### Multi-Player Example

```javascript
// Shared state objects
const sharedPlayers = [
  new MockPlayer('p0', { position: '0' }),
  new MockPlayer('p1', { position: '1' }),
];
const sharedGame = new MockGame({ dailyUrl: 'https://...' });

// Player 0's view
<MockEmpiricaProvider
  currentPlayerId="p0"
  players={sharedPlayers}
  game={sharedGame}
>
  <VideoCall />
</MockEmpiricaProvider>

// Player 1's view (same shared objects, different perspective)
<MockEmpiricaProvider
  currentPlayerId="p1"
  players={sharedPlayers}
  game={sharedGame}
>
  <VideoCall />
</MockEmpiricaProvider>
```

When player 0 calls `player.set('dailyId', 'abc')`, player 1 sees it via `usePlayers()`.

## Extending Mocks

### Adding New Empirica Hook

1. **Add to `empirica-hooks.js`**:
   ```javascript
   export function useNewHook() {
     const context = useContext(MockEmpiricaContext);
     return context.newData;
   }
   ```

2. **Add to `MockEmpiricaProvider.jsx`**:
   ```javascript
   export function MockEmpiricaProvider({ newData, ...props }) {
     return (
       <MockEmpiricaContext.Provider value={{ ...props, newData }}>
         {props.children}
       </MockEmpiricaContext.Provider>
     );
   }
   ```

3. **Use in tests**:
   ```javascript
   hooksConfig: {
     empirica: { newData: 'test value', ... },
   }
   ```

### Adding New Daily Hook

Same pattern, but in `daily-hooks.jsx` and `MockDailyProvider.jsx`.

## Troubleshooting

### "Cannot read properties of undefined" in hook
- Check that `hooksConfig` includes the required property
- Verify the hook is reading from the correct context
- Check that providers are wrapping the component (see `index.jsx`)

### Hook returns undefined
- Check spelling of property names in `hooksConfig`
- Verify provider is receiving the property
- Add console.log in mock hook to debug

### Changes not reflected
- Clear Playwright cache: `rm -rf playwright/.cache`
- Restart test runner
- Check that alias is in `playwright.config.mjs`

## Further Reading

- [../component-tests/README.md](../component-tests/README.md) - How to write tests
- [../README.md](../README.md) - Overall testing architecture
- [Vite Resolve Alias](https://vitejs.dev/config/shared-options.html#resolve-alias)
