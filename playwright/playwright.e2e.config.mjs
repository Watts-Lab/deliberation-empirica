import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.{js,ts,mjs}",
  // Helpers directory holds shared utilities, not tests.
  testIgnore: ["**/_helpers/**", "**/fixtures/**"],

  timeout: 120_000,
  expect: { timeout: 15_000 },

  // Each test file owns its empirica stack via beforeAll/afterAll.
  // Within a file, run tests serially against that shared stack.
  // Across files, run in parallel up to `workers`.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 2,

  globalSetup: path.resolve(__dirname, "./e2e/_helpers/globalSetup.mjs"),

  reporter: [
    ["html", { outputFolder: "playwright-report-e2e" }],
    ["list"],
  ],

  use: {
    trace: process.env.CI ? "on-first-retry" : "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
