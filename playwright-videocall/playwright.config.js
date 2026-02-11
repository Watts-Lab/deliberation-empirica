/**
 * Playwright configuration for video call tests
 *
 * This config is separate from main Cypress tests to allow gradual migration.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  // Run tests in parallel (one per browser)
  fullyParallel: true,

  // Fail fast on CI
  forbidOnly: !!process.env.CI,

  // Retry flaky tests
  retries: process.env.CI ? 2 : 0,

  // Increase timeout for video call tests (they take longer)
  timeout: 60000, // 60 seconds per test
  expect: {
    timeout: 10000, // 10 seconds per assertion
  },

  // Reporter
  reporter: process.env.CI
    ? [['html'], ['github']]
    : [['html'], ['list']],

  // Shared settings for all projects
  use: {
    // Base URL for your app
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // Collect trace for debugging failures
    trace: 'on-first-retry',

    // Screenshots on failure
    screenshot: 'only-on-failure',

    // Video on failure (useful for debugging video call issues)
    video: 'retain-on-failure',
  },

  // Test against multiple browsers
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Chromium-specific video/audio settings
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',      // Auto-grant permissions
            '--use-fake-device-for-media-stream',   // Use fake camera/mic
            '--disable-blink-features=AutomationControlled', // Avoid detection
          ],
        },
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'media.navigator.streams.fake': true,  // Use fake camera/mic
            'media.navigator.permission.disabled': true, // Auto-grant permissions
          },
        },
      },
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        // WebKit has more limited fake device support
        // May need real devices or skip some tests
      },
    },

    // Mobile browsers (optional - for responsive testing)
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Start local dev server before tests (optional)
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
