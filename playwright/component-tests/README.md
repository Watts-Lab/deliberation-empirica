# Component Tests

Playwright Component Tests for the Deliberation-Empirica project.

## Overview

Component tests use `@playwright/experimental-ct-react` to test React components in isolation with mocked dependencies. Tests run in a real browser environment, allowing verification of rendering, layout, and interactive behavior without requiring a full Empirica backend.

## Directory Structure

```
component-tests/
├── README.md (this file)
├── shared/
│   └── fixtures.js          # Reusable test configurations
├── video-call/
│   ├── README.md            # VideoCall-specific test documentation
│   ├── VideoCall.basic.ct.jsx    # Smoke tests
│   ├── VideoCall.states.ct.jsx   # Tile state tests
│   └── VideoCall.layout.ct.jsx   # Multi-player layout tests
└── (future component folders)
```

## Organization Principles

### 1. One Folder Per Component
Each component under test gets its own folder (e.g., `video-call/`, `chat/`, `survey/`).

### 2. Tests Split By Concern
Within each component folder, tests are organized into files by concern:
- **`.basic.ct.jsx`** - Smoke tests, basic rendering
- **`.states.ct.jsx`** - Different component states (loading, error, success, etc.)
- **`.layout.ct.jsx`** - Layout and responsive behavior
- **`.interactions.ct.jsx`** - User interactions (clicks, typing, drag-and-drop)
- **`.accessibility.ct.jsx`** - A11y tests (ARIA, keyboard navigation)

Not every component needs all files—create only what makes sense.

### 3. Shared Fixtures
Common test configurations live in `shared/fixtures.js` to avoid duplication across tests.

```javascript
// Import fixtures
import { singlePlayerConnected, threePlayersConnected } from '../shared/fixtures';

// Use in test
const component = await mount(<VideoCall />, {
  hooksConfig: singlePlayerConnected,
});
```

### 4. Component README
Each component folder includes a `README.md` documenting:
- What the component does
- What tests exist and what they verify
- When to add new tests to each file
- Future test ideas

## Running Tests

```bash
# All component tests
npm run test:component

# Headed mode (see browser)
npm run test:component:headed

# Interactive UI mode
npm run test:component:ui

# Specific component folder
npm run test:component -- video-call

# Specific test file
npm run test:component -- VideoCall.states
```

## Mock Architecture

Component tests use mocked providers to simulate Empirica and Daily.co:

### MockEmpiricaProvider
Mocks Empirica's React hooks (`usePlayer`, `usePlayers`, `useGame`, `useStage`).

**Configuration via `hooksConfig.empirica`**:
```javascript
empirica: {
  currentPlayerId: 'p0',
  players: [{ id: 'p0', attrs: { name: 'Player 0', position: '0' } }],
  game: { attrs: { dailyUrl: 'https://...' } },
  stage: { attrs: {} },
  stageTimer: { elapsed: 0 },
}
```

### MockDailyProvider
Mocks Daily.co's React hooks (`useVideoTrack`, `useAudioTrack`, `useLocalSessionId`).

**Configuration via `hooksConfig.daily`**:
```javascript
daily: {
  localSessionId: 'daily-123',
  participantIds: ['daily-123'],
  videoTracks: { 'daily-123': { isOff: false, subscribed: true } },
  audioTracks: { 'daily-123': { isOff: false, subscribed: true } },
}
```

See [../mocks/README.md](../mocks/README.md) for detailed mock documentation.

## Writing Tests

### Basic Test Template

```javascript
import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { YourComponent } from '../../client/src/path/to/YourComponent';
import { yourFixture } from '../shared/fixtures';

test.describe('YourComponent - Category', () => {
  test('descriptive test name', async ({ mount }) => {
    const component = await mount(<YourComponent />, {
      hooksConfig: yourFixture,
    });

    await expect(component.locator('[data-test="something"]')).toBeVisible();
  });
});
```

### Using Fixtures

1. **Reuse existing fixtures** from `shared/fixtures.js` when possible
2. **Create new fixtures** in `shared/fixtures.js` for reusable configurations
3. **Inline configs** only for one-off test scenarios

### Data Test Attributes

Components should include `data-test` attributes for stable test selectors:

```jsx
// In component code
<div data-test="callTile" data-position={position}>
  {/* ... */}
</div>

// In test
await expect(component.locator('[data-test="callTile"]')).toBeVisible();
```

## Adding New Component Tests

1. **Create component folder**: `mkdir component-tests/your-component/`
2. **Create test files**: Start with `.basic.ct.jsx`, add others as needed
3. **Add fixtures**: Add reusable configs to `shared/fixtures.js`
4. **Document**: Create `README.md` in component folder
5. **Run tests**: `npm run test:component -- your-component`

## Best Practices

### DO:
- ✅ Use shared fixtures to avoid duplication
- ✅ Split tests by concern (basic, states, layout, etc.)
- ✅ Use `data-test` attributes for stable selectors
- ✅ Document what each test verifies
- ✅ Test visual states and browser-specific behavior
- ✅ Keep tests focused and independent

### DON'T:
- ❌ Duplicate test configurations across files
- ❌ Put all tests in one giant file
- ❌ Test business logic that belongs in unit tests
- ❌ Make tests depend on each other
- ❌ Use brittle selectors (CSS classes, DOM structure)

## When to Use Component Tests vs Unit Tests

**Component Tests (Playwright CT)** - Test visual rendering and browser behavior:
- Layout calculations that depend on ResizeObserver
- CSS rendering (flexbox, grid, responsive design)
- Interactive behaviors (click, type, drag)
- Visual states (loading spinners, error messages, tile states)

**Unit Tests (Vitest)** - Test pure logic:
- Data transformations
- Utility functions
- Algorithms
- Business logic

See [../../client/src/README.md](../../client/src/README.md) for unit testing guide (if it exists).

## Troubleshooting

### Tests fail with "Cannot find element"
- Increase timeout: `{ timeout: 10000 }`
- Check that component actually renders the element
- Verify `data-test` attribute exists in component code

### CSS not rendering correctly
- Check that WindiCSS is imported in `playwright/index.jsx`
- Verify `vite-plugin-windicss` is in config
- Clear cache: `rm -rf playwright/.cache`

### "Multiple instances of React" error
- Check that React aliases are in `playwright.config.mjs`
- Clear cache: `rm -rf playwright/.cache`

## Further Reading

- [Playwright Component Testing Docs](https://playwright.dev/docs/test-components)
- [video-call/README.md](video-call/README.md) - Example component test documentation
- [../mocks/README.md](../mocks/README.md) - Mock architecture details
