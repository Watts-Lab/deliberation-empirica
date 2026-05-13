import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { checkRequiredEnvironmentVariables } from "./preFlightChecks";

// Environment-variable validation has side effects on process.env, so we
// snapshot + restore it around each test.
const prodEnv = {
  DAILY_APIKEY: "k",
  QUALTRICS_API_TOKEN: "k",
  QUALTRICS_DATACENTER: "k",
  DELIBERATION_MACHINE_USER_TOKEN: "k",
  ETHERPAD_API_KEY: "k",
  ETHERPAD_BASE_URL: "k",
  DATA_DIR: "/tmp/data",
};

// Minimum env shape for `USE_MANAGER_SAVE=true` — every field
// `managerLaunchedEnv` requires. Used as the base for manager-mode
// tests; individual tests delete fields to trigger validation errors.
const managerEnv = {
  USE_MANAGER_SAVE: "true",
  // identity + correlation
  INSTANCE_ID: "i_1",
  BATCH_ID: "b_1",
  STUDY_ID: "s_1",
  WORKSPACE_ID: "w_1",
  SUBDOMAIN: "study-1",
  // channel
  MANAGER_URL: "https://manager.example",
  MANAGER_INSTANCE_TOKEN: "tok",
  JWT_VERIFY_SECRET: "secret-base64",
  // resource context
  INSTANCE_MEMORY_LIMIT_MB: "1024",
  INSTANCE_CPU_ALLOCATION: "0.5",
  INSTANCE_PARTICIPANT_CAP: "100",
  // empirica ops
  DATA_DIR: "/tmp/data",
  EMPIRICA_ADMIN_PW: "admin",
  // observability
  CONTAINER_IMAGE_VERSION_TAG: "v0.1.0",
  // Required in manager-launched mode 2026-05-13+. Image deliberately
  // doesn't bake this; manager spawn pipeline injects it.
  NODE_ENV: "production",
};

describe("checkRequiredEnvironmentVariables — solo-dev mode", () => {
  let snapshot;

  beforeEach(() => {
    snapshot = { ...process.env };
  });

  afterEach(() => {
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
    setEnv({ TEST_CONTROLS: "enabled", DATA_DIR: "/tmp/data" });
    expect(() => checkRequiredEnvironmentVariables()).not.toThrow();
  });

  test("throws with the variable name when a required prod var is missing", () => {
    const env = { ...prodEnv };
    delete env.DAILY_APIKEY;
    setEnv({ ...env, TEST_CONTROLS: "disabled" });
    expect(() => checkRequiredEnvironmentVariables()).toThrow(
      /Missing required environment variable DAILY_APIKEY/,
    );
  });

  test("treats a var with value 'none' as missing", () => {
    setEnv({
      ...prodEnv,
      TEST_CONTROLS: "disabled",
      QUALTRICS_API_TOKEN: "none",
    });
    expect(() => checkRequiredEnvironmentVariables()).toThrow(
      /Missing required environment variable QUALTRICS_API_TOKEN/,
    );
  });

  test("throws when DATA_DIR is missing even with TEST_CONTROLS enabled", () => {
    setEnv({ TEST_CONTROLS: "enabled" });
    expect(() => checkRequiredEnvironmentVariables()).toThrow(
      /Missing required environment variable DATA_DIR/,
    );
  });

  test("throws when DATA_DIR is missing in prod mode", () => {
    const env = { ...prodEnv };
    delete env.DATA_DIR;
    setEnv({ ...env, TEST_CONTROLS: "disabled" });
    expect(() => checkRequiredEnvironmentVariables()).toThrow(
      /Missing required environment variable DATA_DIR/,
    );
  });

  test("checks each prod var in turn (second missing one reported after first fixed)", () => {
    const env = { ...prodEnv };
    delete env.DAILY_APIKEY;
    delete env.ETHERPAD_API_KEY;
    setEnv({ ...env, TEST_CONTROLS: "disabled" });

    expect(() => checkRequiredEnvironmentVariables()).toThrow(/DAILY_APIKEY/);
    process.env.DAILY_APIKEY = "k";
    expect(() => checkRequiredEnvironmentVariables()).toThrow(
      /ETHERPAD_API_KEY/,
    );
  });

  test("USE_MANAGER_SAVE=false also goes through the solo-dev gate", () => {
    setEnv({
      ...prodEnv,
      TEST_CONTROLS: "disabled",
      USE_MANAGER_SAVE: "false",
    });
    expect(() => checkRequiredEnvironmentVariables()).not.toThrow();
  });
});

describe("checkRequiredEnvironmentVariables — manager-launched mode", () => {
  let snapshot;

  beforeEach(() => {
    snapshot = { ...process.env };
  });

  afterEach(() => {
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

  test("passes when the full manager env shape is present", () => {
    setEnv(managerEnv);
    expect(() => checkRequiredEnvironmentVariables()).not.toThrow();
  });

  test("ignores TEST_CONTROLS — manager mode is always strict", () => {
    // TEST_CONTROLS=enabled is a solo-dev escape hatch for local dev.
    // Manager mode runs in a real container with real injected env;
    // a missing field is real config drift, not "running locally".
    const env = { ...managerEnv, TEST_CONTROLS: "enabled" };
    delete env.MANAGER_URL;
    setEnv(env);
    expect(() => checkRequiredEnvironmentVariables()).toThrow(
      /Manager-launched env validation failed.*MANAGER_URL/,
    );
  });

  test("rejects when DELIBERATION_MACHINE_USER_TOKEN is present (config drift)", () => {
    // The legacy direct-Octokit token must NOT be set under manager
    // mode — its presence indicates the spawn pipeline is mixing
    // manager vars with the old solo-dev save path.
    setEnv({ ...managerEnv, DELIBERATION_MACHINE_USER_TOKEN: "leaked" });
    expect(() => checkRequiredEnvironmentVariables()).toThrow(
      /DELIBERATION_MACHINE_USER_TOKEN.*configuration drift/,
    );
  });

  // Parameterized coverage — every field the manager-launched schema
  // marks required must trip preflight when omitted. The list mirrors
  // `managerLaunchedEnv`'s required keys in `contracts/env.mjs`; if
  // the schema gains a new required field this test will need to
  // grow with it (intentional — that's the failure mode we want to
  // catch). EMPIRICA_SRTOKEN is excluded because the schema marks it
  // `.optional()` (see #124 for the schema-vs-entrypoint tension).
  const requiredManagerFields = [
    "INSTANCE_ID",
    "BATCH_ID",
    "STUDY_ID",
    "WORKSPACE_ID",
    "SUBDOMAIN",
    "MANAGER_URL",
    "MANAGER_INSTANCE_TOKEN",
    "JWT_VERIFY_SECRET",
    "INSTANCE_MEMORY_LIMIT_MB",
    "INSTANCE_CPU_ALLOCATION",
    "INSTANCE_PARTICIPANT_CAP",
    "DATA_DIR",
    "EMPIRICA_ADMIN_PW",
    "CONTAINER_IMAGE_VERSION_TAG",
  ];

  test.each(requiredManagerFields)(
    "rejects when required manager field %s is missing",
    (field) => {
      const env = { ...managerEnv };
      delete env[field];
      setEnv(env);
      expect(() => checkRequiredEnvironmentVariables()).toThrow(
        new RegExp(`Manager-launched env validation failed.*${field}`),
      );
    },
  );

  test("rejects when MANAGER_URL isn't a URL (validates shape, not just presence)", () => {
    setEnv({ ...managerEnv, MANAGER_URL: "not-a-url" });
    expect(() => checkRequiredEnvironmentVariables()).toThrow(
      /Manager-launched env validation failed.*MANAGER_URL/,
    );
  });

  test("rejects when INSTANCE_PARTICIPANT_CAP isn't a stringified non-negative integer", () => {
    setEnv({ ...managerEnv, INSTANCE_PARTICIPANT_CAP: "many" });
    // Match both the field name AND the regex error message so a
    // future schema rewrite that surfaces the field but with a
    // different validation error trips this test.
    expect(() => checkRequiredEnvironmentVariables()).toThrow(
      /INSTANCE_PARTICIPANT_CAP.*non-negative integer/,
    );
  });

  test("error message lists every failing field, not just the first", () => {
    const env = { ...managerEnv };
    delete env.MANAGER_URL;
    delete env.INSTANCE_ID;
    setEnv(env);
    const run = () => checkRequiredEnvironmentVariables();
    expect(run).toThrow(/MANAGER_URL/);
    expect(run).toThrow(/INSTANCE_ID/);
  });
});
