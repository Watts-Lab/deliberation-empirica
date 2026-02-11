# Playwright Component Tests

Component-level tests for VideoCall and related components using real Daily.co rooms with mocked Empirica state.

## Structure

```
playwright/
├── component-tests/     # Test files
│   └── VideoCall.ct.jsx
├── mocks/              # Reusable mock classes (can be used in any test type)
│   ├── MockPlayer.js   # Stateful player mock
│   ├── MockGame.js     # Game mock
│   ├── MockStage.js    # Stage mock
│   └── index.js        # Exports + createMockEmpiricaContext()
├── helpers/            # Test-specific utilities
│   ├── scenarios.js    # Multi-player/breakout scenario builders
│   └── daily.js        # Daily.co room setup/teardown (uses server code)
└── playwright.config.js
```

## Running Tests

```bash
# Install dependencies (if not already installed)
npm install --save-dev @playwright/experimental-ct-react

# Run tests
npx playwright test -c playwright/playwright.config.js

# Run with UI
npx playwright test -c playwright/playwright.config.js --ui

# Run specific test file
npx playwright test -c playwright/playwright.config.js component-tests/VideoCall.ct.jsx
```

## Environment Setup

Make sure you have `DAILY_APIKEY` set in your environment:

```bash
export DAILY_APIKEY=your_api_key_here
```

## Writing Tests

### Basic Component Test

```javascript
import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../client/src/call/VideoCall';
import { EmpiricaContext } from '@empirica/core/player/react';
import { createMockEmpiricaContext } from '../mocks/index.js';
import { createTestRoom, cleanupTestRoom } from '../helpers/daily.js';

test('my test', async ({ mount }) => {
  const room = await createTestRoom();

  const mockContext = createMockEmpiricaContext({
    roomUrl: room.url,
  });

  const component = await mount(
    <EmpiricaContext.Provider value={mockContext}>
      <VideoCall showSelfView={true} />
    </EmpiricaContext.Provider>
  );

  await expect(component.locator('[data-test="callTile"]')).toBeVisible();

  await cleanupTestRoom(room.name);
});
```

### Multi-Player Scenario

```javascript
import { createMultiPlayerScenario, simulatePlayerJoin } from '../helpers/scenarios.js';

test('multi-player test', async ({ mount }) => {
  const room = await createTestRoom();

  const mockContext = createMultiPlayerScenario({
    numPlayers: 3,
    currentPlayerIndex: 0,
    roomUrl: room.url,
  });

  // Simulate other players having joined
  simulatePlayerJoin(mockContext.players[1], 'participant-1');
  simulatePlayerJoin(mockContext.players[2], 'participant-2');

  // ... mount and test
});
```

## Key Features

- ✅ **Real Daily.co rooms** - Uses production server code via `helpers/daily.js`
- ✅ **Mocked Empirica state** - Uses reusable mocks from `mocks/`
- ✅ **Stateful player tracking** - Mocks track `set()` and `append()` calls
- ✅ **Multi-player scenarios** - Easy setup with `scenarios.js` helpers
- ✅ **Breakout room support** - Built-in scenario builder
- ✅ **Real browser testing** - WebRTC works with fake media devices

## Reusing Mocks

The `mocks/` directory contains pure mock classes that can be reused in:
- Component tests (Playwright)
- E2E tests (Playwright or Cypress)
- Unit tests (Vitest)
- Integration tests

Just import what you need:

```javascript
import { MockPlayer, MockGame, createMockEmpiricaContext } from '../mocks/index.js';
```
