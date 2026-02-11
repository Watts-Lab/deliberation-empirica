import { defineConfig, devices } from '@playwright/experimental-ct-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: './component-tests',

  // Timeouts
  timeout: 30000,
  expect: {
    timeout: 10000,
  },

  // Test execution
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

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

  // Vite config for component tests
  viteConfig: {
    resolve: {
      alias: {
        '@empirica/core': path.resolve(__dirname, '../client/node_modules/@empirica/core'),
        '@daily-co/daily-react': path.resolve(__dirname, '../client/node_modules/@daily-co/daily-react'),
        '@daily-co/daily-js': path.resolve(__dirname, '../client/node_modules/@daily-co/daily-js'),
      },
    },
  },
});
