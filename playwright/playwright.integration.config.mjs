import { defineConfig, devices } from '@playwright/experimental-ct-react';
import path from 'path';
import { fileURLToPath } from 'url';
import windi from 'vite-plugin-windicss';
import dotenv from 'dotenv';

// Load environment variables from .env (for DAILY_APIKEY)
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Playwright Component Test Config for INTEGRATION TESTS
 *
 * This config is for testing with REAL Daily.co WebRTC connections.
 *
 * Key differences from playwright.config.mjs:
 * - NO @daily-co/daily-react alias (uses real Daily hooks)
 * - ONLY runs tests in integration/ directories
 * - Requires DAILY_APIKEY environment variable
 *
 * Run with: npm run test:component:integration
 *
 * Use for:
 * - Real WebRTC connection testing
 * - Real browser behavior (Safari audio context, device switching)
 * - Connection recovery scenarios
 * - Multi-participant interactions
 */
export default defineConfig({
  testDir: './component-tests',

  // ONLY run integration tests
  testMatch: '**/integration/**/*.ct.{js,jsx,ts,tsx}',

  // Timeouts (longer for real WebRTC connections)
  timeout: 60000,  // 60s for real connections
  expect: {
    timeout: 15000,  // 15s for assertions
  },

  // Test execution
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporting
  reporter: [
    ['html', { outputFolder: 'playwright-report-integration' }],
    ['list'],
  ],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Grant media permissions by default
    permissions: ['camera', 'microphone'],

    // Template directory for component tests
    ctTemplateDir: '.',

    // Vite config for component tests
    ctViteConfig: {
      resolve: {
        alias: [
          // Ensure single React instance
          { find: 'react', replacement: path.resolve(__dirname, '../node_modules/react') },
          { find: 'react-dom', replacement: path.resolve(__dirname, '../node_modules/react-dom') },

          // Mock Empirica hooks (still mocked - no backend needed)
          { find: '@empirica/core/player/classic/react', replacement: path.resolve(__dirname, 'mocks/empirica-hooks.js') },

          // NO @daily-co/daily-react alias - use REAL Daily hooks!
          // Integration tests import directly from node_modules paths to bypass any aliasing

          // Mock Sentry - no-op functions
          { find: '@sentry/react', replacement: path.resolve(__dirname, 'mocks/sentry-mock.js') },

          // ProgressLabel hooks - redirect to empirica-hooks
          { find: /^\.\.?\/.*components\/progressLabel$/, replacement: path.resolve(__dirname, 'mocks/empirica-hooks.js') },
        ],
      },
      // Handle JSX
      esbuild: {
        jsx: 'automatic',
      },
      // Include WindiCSS
      plugins: [
        windi({
          root: path.resolve(__dirname, '../client'),
          config: path.resolve(__dirname, '../client/windi.config.cjs'),
        }),
      ],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            // Use fake media devices for testing
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
          ],
        },
      },
    },
    // Safari is particularly important for integration tests (audio context issues)
    // Uncomment to test Safari-specific behavior:
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
});
