import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { checkRequiredEnvironmentVariables } from "./preFlightChecks";

// Environment-variable validation has side effects on process.env, so we
// snapshot + restore it around each test.
const prodEnv = {
  DAILY_APIKEY: "k",
  QUALTRICS_API_TOKEN: "k",
  QUALTRICS_DATACENTER: "k",
  DELIBERATION_MACHINE_USER_TOKEN: "k",
  GITHUB_PRIVATE_DATA_OWNER: "k",
  GITHUB_PRIVATE_DATA_REPO: "k",
  GITHUB_PRIVATE_DATA_BRANCH: "k",
  GITHUB_PUBLIC_DATA_OWNER: "k",
  GITHUB_PUBLIC_DATA_REPO: "k",
  GITHUB_PUBLIC_DATA_BRANCH: "k",
  ETHERPAD_API_KEY: "k",
  ETHERPAD_BASE_URL: "k",
  DATA_DIR: "/tmp/data",
};

describe("checkRequiredEnvironmentVariables", () => {
  let snapshot;

  beforeEach(() => {
    snapshot = { ...process.env };
  });

  afterEach(() => {
    // Wipe anything the test set and restore the snapshot.
    Object.keys(process.env).forEach((key) => {
      delete process.env[key];
    });
    Object.assign(process.env, snapshot);
  });

  function setEnv(vars) {
    Object.keys(process.env).forEach((key) => {
      delete process.env[key];
    });
    Object.assign(process.env, vars);
  }

  test("passes when all production env vars are set", () => {
    setEnv({ ...prodEnv, TEST_CONTROLS: "disabled" });
    expect(() => checkRequiredEnvironmentVariables()).not.toThrow();
  });

  test("bypasses production checks when TEST_CONTROLS === 'enabled'", () => {
    // Only DATA_DIR is set; all the prod vars are missing — but TEST_CONTROLS
    // is enabled so the prod gate is skipped.
    setEnv({ TEST_CONTROLS: "enabled", DATA_DIR: "/tmp/data" });
    expect(() => checkRequiredEnvironmentVariables()).not.toThrow();
  });

  test("throws with the variable name when a required prod var is missing", () => {
    const env = { ...prodEnv };
    delete env.DAILY_APIKEY;
    setEnv({ ...env, TEST_CONTROLS: "disabled" });
    expect(() => checkRequiredEnvironmentVariables()).toThrow(
      /Missing required environment variable DAILY_APIKEY/
    );
  });

  test("treats a var with value 'none' as missing", () => {
    setEnv({
      ...prodEnv,
      TEST_CONTROLS: "disabled",
      QUALTRICS_API_TOKEN: "none",
    });
    expect(() => checkRequiredEnvironmentVariables()).toThrow(
      /Missing required environment variable QUALTRICS_API_TOKEN/
    );
  });

  test("throws when DATA_DIR is missing even with TEST_CONTROLS enabled", () => {
    setEnv({ TEST_CONTROLS: "enabled" });
    expect(() => checkRequiredEnvironmentVariables()).toThrow(
      /Missing required environment variable DATA_DIR/
    );
  });

  test("throws when DATA_DIR is missing in prod mode", () => {
    const env = { ...prodEnv };
    delete env.DATA_DIR;
    setEnv({ ...env, TEST_CONTROLS: "disabled" });
    expect(() => checkRequiredEnvironmentVariables()).toThrow(
      /Missing required environment variable DATA_DIR/
    );
  });

  test("checks each prod var in turn (second missing one reported after first fixed)", () => {
    // Remove two: once we add DAILY_APIKEY back, we should surface the next one.
    const env = { ...prodEnv };
    delete env.DAILY_APIKEY;
    delete env.ETHERPAD_API_KEY;
    setEnv({ ...env, TEST_CONTROLS: "disabled" });

    expect(() => checkRequiredEnvironmentVariables()).toThrow(
      /DAILY_APIKEY/
    );
    process.env.DAILY_APIKEY = "k";
    expect(() => checkRequiredEnvironmentVariables()).toThrow(
      /ETHERPAD_API_KEY/
    );
  });
});
