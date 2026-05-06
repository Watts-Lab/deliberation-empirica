import { describe, expect, it } from "vitest";
import { managerLaunchedEnv, soloDevEnv } from "../env.mjs";

const baseManagerEnv = {
  USE_MANAGER_SAVE: "true",
  INSTANCE_ID: "i-1",
  BATCH_ID: "b-1",
  STUDY_ID: "s-1",
  WORKSPACE_ID: "w-1",
  SUBDOMAIN: "demo",
  MANAGER_URL: "https://manager.example",
  MANAGER_INSTANCE_TOKEN: "eyJhbGc.token.value",
  JWT_VERIFY_SECRET: "base64-secret-bytes-here",
  INSTANCE_MEMORY_LIMIT_MB: "2048",
  INSTANCE_CPU_ALLOCATION: "1vCPU",
  INSTANCE_PARTICIPANT_CAP: "150",
  DATA_DIR: "/data",
  EMPIRICA_ADMIN_PW: "hunter2",
  EMPIRICA_SRTOKEN: "srt-1",
  CONTAINER_IMAGE_VERSION_TAG: "v1.2.3",
};

describe("managerLaunchedEnv", () => {
  it("accepts a complete manager-launched env", () => {
    const e = managerLaunchedEnv.parse(baseManagerEnv);
    expect(e.MANAGER_URL).toBe("https://manager.example");
  });

  it("rejects when a legacy GitHub var is also set", () => {
    expect(() =>
      managerLaunchedEnv.parse({
        ...baseManagerEnv,
        DELIBERATION_MACHINE_USER_TOKEN: "leaked",
      }),
    ).toThrow();
  });

  it("rejects a non-URL MANAGER_URL", () => {
    expect(() =>
      managerLaunchedEnv.parse({
        ...baseManagerEnv,
        MANAGER_URL: "not-a-url",
      }),
    ).toThrow();
  });

  it("rejects non-numeric INSTANCE_MEMORY_LIMIT_MB", () => {
    expect(() =>
      managerLaunchedEnv.parse({
        ...baseManagerEnv,
        INSTANCE_MEMORY_LIMIT_MB: "two-gigs",
      }),
    ).toThrow();
  });

  it("requires DATA_DIR (Tajriba state + export staging)", () => {
    const { DATA_DIR: _omit, ...rest } = baseManagerEnv;
    expect(() => managerLaunchedEnv.parse(rest)).toThrow();
  });
});

describe("soloDevEnv", () => {
  const baseSoloEnv = {
    DELIBERATION_MACHINE_USER_TOKEN: "ghp_xxx",
    DATA_DIR: "/tmp/data",
    EMPIRICA_ADMIN_PW: "localpwd",
    CONTAINER_IMAGE_VERSION_TAG: "dev",
  };

  it("accepts a solo-dev env with the legacy GitHub token", () => {
    const e = soloDevEnv.parse({
      USE_MANAGER_SAVE: "false",
      ...baseSoloEnv,
    });
    expect(e.DELIBERATION_MACHINE_USER_TOKEN).toBe("ghp_xxx");
  });

  it("accepts USE_MANAGER_SAVE absent (defaults to solo-dev)", () => {
    const e = soloDevEnv.parse(baseSoloEnv);
    expect(e.USE_MANAGER_SAVE).toBeUndefined();
  });

  it("requires DATA_DIR in solo-dev too", () => {
    const { DATA_DIR: _omit, ...rest } = baseSoloEnv;
    expect(() => soloDevEnv.parse(rest)).toThrow();
  });
});
