import { defineConfig, devices } from '@playwright/experimental-ct-react';
import path from 'path';
import { fileURLToPath } from 'url';
import windi from 'vite-plugin-windicss';
import dotenv from 'dotenv';

// Load environment variables from .env (for DAILY_APIKEY)
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: './component-tests',

  // Test file matching - include .ct.jsx files, EXCLUDE integration tests
  testMatch: '**/*.ct.{js,jsx,ts,tsx}',
  testIgnore: '**/integration/**',  // Integration tests use separate config

  // Timeouts
  timeout: 30000,
  expect: {
    timeout: 10000,
  },

  // Test execution
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,  // VideoCall tests are heavy; limit to 2 workers locally

  // Reporting
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Grant media permissions by default
    permissions: ['camera', 'microphone'],

    // Template directory for component tests (relative to config file directory)
    ctTemplateDir: '.',

    // Vite config for component tests
    ctViteConfig: {
      resolve: {
        alias: [
          // Ensure single React instance - critical for hooks to work correctly
          { find: 'react', replacement: path.resolve(__dirname, '../node_modules/react') },
          { find: 'react-dom', replacement: path.resolve(__dirname, '../node_modules/react-dom') },

          // Mock Empirica hooks - read from MockEmpiricaProvider context
          { find: '@empirica/core/player/classic/react', replacement: path.resolve(__dirname, 'mocks/empirica-hooks.js') },

          // Mock Daily.co hooks - read from MockDailyProvider context
          { find: '@daily-co/daily-react', replacement: path.resolve(__dirname, 'mocks/daily-hooks.jsx') },

          // Keep real daily-js for when we want real Daily integration
          { find: '@daily-co/daily-js', replacement: path.resolve(__dirname, '../client/node_modules/@daily-co/daily-js') },

          // Mock Sentry - no-op functions
          { find: '@sentry/react', replacement: path.resolve(__dirname, 'mocks/sentry-mock.js') },

          // ProgressLabel hooks - redirect to empirica-hooks which exports them
          // Match relative imports to components/progressLabel (e.g., ../components/progressLabel, ../../components/progressLabel)
          { find: /^\.\.?\/.*components\/progressLabel$/, replacement: path.resolve(__dirname, 'mocks/empirica-hooks.js') },
        ],
      },
      // Handle JSX in mock files
      esbuild: {
        jsx: 'automatic',
      },
      // Include WindiCSS for Tailwind-like utility classes
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
    // Uncomment to test in other browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
});
