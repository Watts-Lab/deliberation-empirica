# Playwright Testing Infrastructure

Playwright Component Testing setup for the Deliberation-Empirica project.

## Quick Start

```bash
# Run all component tests
npm run test:component

# Run in headed mode (see browser)
npm run test:component:headed

# Run with Playwright UI (interactive debugging)
npm run test:component:ui
```

## What's Here

```
playwright/
├── README.md (this file)
├── playwright.config.mjs    # Playwright configuration
├── index.jsx                # Test entry point, wraps components
├── component-tests/         # Component test files
│   ├── README.md           # Component testing guide
│   ├── shared/
│   │   └── fixtures.js     # Reusable test configurations
│   └── video-call/         # VideoCall component tests
│       ├── README.md
│       ├── VideoCall.basic.ct.jsx
│       ├── VideoCall.states.ct.jsx
│       └── VideoCall.layout.ct.jsx
└── mocks/                   # Mock providers and helpers
    ├── README.md           # Mocking architecture docs
    ├── MockEmpiricaProvider.jsx
    ├── MockDailyProvider.jsx
    ├── empirica-hooks.js
    ├── daily-hooks.jsx
    └── (other mocks)
```

## Architecture

### Component Testing Flow

1. **Test file** imports component and fixtures
2. **mount()** renders component in isolated browser context
3. **beforeMount hook** (in `index.jsx`) wraps component in mock providers
4. **Mock hooks** (aliased via Vite) return test data instead of real Empirica/Daily
5. **Component renders** with mocked state
6. **Assertions** verify rendering, layout, and behavior

### Mock Layers

Component tests use two mock provider layers:

1. **MockEmpiricaProvider** - Mocks Empirica hooks (`usePlayer`, `usePlayers`, `useGame`, `useStage`)
2. **MockDailyProvider** - Mocks Daily.co hooks (`useVideoTrack`, `useAudioTrack`, `DailyVideo`)

Configuration is passed via `hooksConfig` parameter to `mount()`:

```javascript
const component = await mount(<VideoCall />, {
  hooksConfig: {
    empirica: { /* player data, game state */ },
    daily: { /* connection state, tracks */ },
  },
});
```

See [mocks/README.md](mocks/README.md) for detailed mock architecture.

## Key Files

### playwright.config.mjs
Playwright configuration with critical settings:

- **ctViteConfig** - Vite config for component tests
  - WindiCSS plugin (required for Tailwind-like utility classes)
  - React aliases (prevents multiple React instances)
  - Module aliases for mocks (`@empirica/core` → `./mocks/empirica-hooks.js`)

- **ctTemplateDir** - Points to `index.jsx` for component wrapping

### index.jsx
Entry point that wraps all mounted components:

- Imports WindiCSS (`import 'virtual:windi.css'`)
- Provides `beforeMount` hook
- Wraps components in explicit-size container (fixes ResizeObserver)
- Wraps components in mock providers based on `hooksConfig`

### component-tests/
Component test files organized by component and concern.

See [component-tests/README.md](component-tests/README.md) for organization principles.

### mocks/
Mock implementations of Empirica and Daily.co providers and hooks.

See [mocks/README.md](mocks/README.md) for architecture details.

## Configuration Details

### WindiCSS (Critical!)
WindiCSS must be loaded in test environment, otherwise Tailwind-like utility classes (`flex`, `h-full`, etc.) won't work.

**Setup** (already done):
1. Installed `vite-plugin-windicss`
2. Added to `playwright.config.mjs`:
   ```javascript
   import windi from 'vite-plugin-windicss';

   ctViteConfig: {
     plugins: [
       windi({
         root: path.resolve(__dirname, '../client'),
         config: path.resolve(__dirname, '../client/windi.config.cjs'),
       }),
     ],
   }
   ```
3. Imported in `index.jsx`: `import 'virtual:windi.css';`

### React Aliases (Critical!)
Prevents "multiple instances of React" errors that break hooks.

**Setup** (already done):
```javascript
ctViteConfig: {
  resolve: {
    alias: [
      { find: 'react', replacement: path.resolve(__dirname, '../node_modules/react') },
      { find: 'react-dom', replacement: path.resolve(__dirname, '../node_modules/react-dom') },
    ],
  },
}
```

### Mock Aliases
Redirects Empirica and Daily imports to mock implementations:

```javascript
'@empirica/core/player/classic/react': './mocks/empirica-hooks.js',
'@daily-co/daily-react': './mocks/daily-hooks.jsx',
'@sentry/react': './mocks/sentry-mock.js',
```

## Running Tests

### All Tests
```bash
npm run test:component
```

### Headed Mode (See Browser)
```bash
npm run test:component:headed
```

### Interactive UI Mode
```bash
npm run test:component:ui
```

### Specific Component
```bash
npm run test:component -- video-call
```

### Specific Test File
```bash
npm run test:component -- VideoCall.states
```

### Watch Mode
```bash
npm run test:component -- --watch
```

## Adding New Tests

1. **Choose component folder**: `component-tests/your-component/`
2. **Choose concern file**: `.basic.ct.jsx`, `.states.ct.jsx`, etc.
3. **Import fixtures**: `import { yourFixture } from '../shared/fixtures'`
4. **Write test**: Use `mount()` with `hooksConfig`
5. **Document**: Update component's `README.md`

See [component-tests/README.md](component-tests/README.md) for detailed guide.

## Troubleshooting

### Cache Issues
After config changes, clear Playwright's cache:
```bash
rm -rf playwright/.cache
```

### CSS Not Rendering
- Verify WindiCSS is imported in `index.jsx`
- Check `vite-plugin-windicss` in config
- Clear cache

### Multiple React Instances
- Check React aliases in `playwright.config.mjs`
- Clear cache
- Verify only one React version in `package.json`

### Tests Timeout
- Increase timeout: `{ timeout: 10000 }`
- Check that component actually renders
- Use `--headed` mode to debug visually

### Element Not Found
- Verify `data-test` attribute exists
- Check component actually renders the element
- Use `--headed` or `--ui` mode to inspect

## Memory from Previous Sessions

The `memory/` folder in `.claude/projects/` contains lessons learned:

- **MEMORY.md** - Key configuration points and common issues
  - WindiCSS requirement
  - Single React instance requirement
  - ctViteConfig placement
  - CSS height chain issues

If you encounter bugs, check memory first for solutions.

## Further Reading

- [Playwright Component Testing Docs](https://playwright.dev/docs/test-components)
- [component-tests/README.md](component-tests/README.md) - Component testing guide
- [mocks/README.md](mocks/README.md) - Mock architecture details
- [Playwright API Reference](https://playwright.dev/docs/api/class-test)
