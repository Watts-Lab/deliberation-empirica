import crypto from "node:crypto";
import { describe, test, expect, beforeEach } from "vitest";
import {
  isManagerLaunched,
  initManagerRuntime,
  buildTickPayload,
  resetManagerRuntimeForTests,
} from "./index.mjs";
import { resetJwtSecretCacheForTests } from "./jwtVerifier.mjs";
import { TickStatus } from "./tickStatus.mjs";

const ORIGINAL_ENV = { ...process.env };

// Per-Instance HS256 secret; mirrors what the manager's spawn pipeline
// injects via JWT_VERIFY_SECRET (base64-encoded).
const SECRET = crypto.randomBytes(32);
const SECRET_B64 = SECRET.toString("base64");

function setEnv(env) {
  Object.keys(process.env).forEach((k) => delete process.env[k]);
  Object.assign(process.env, env);
}

function makeToken(claims, { signWith = SECRET } = {}) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", signWith)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

const validClaims = (overrides = {}) => ({
  instance_id: "i-1",
  batch_id: "b-1",
  study_id: "s-1",
  workspace_id: "w-1",
  iat: Math.floor(Date.now() / 1000) - 60,
  exp: Math.floor(Date.now() / 1000) + 24 * 3600,
  aud: "manager",
  scope: "tick",
  kid: "v1",
  ...overrides,
});

const managerEnv = (overrides = {}) => ({
  USE_MANAGER_SAVE: "true",
  MANAGER_URL: "https://m.example",
  INSTANCE_ID: "i-1",
  JWT_VERIFY_SECRET: SECRET_B64,
  MANAGER_INSTANCE_TOKEN: makeToken(validClaims()),
  ...overrides,
});

beforeEach(() => {
  resetManagerRuntimeForTests();
  resetJwtSecretCacheForTests();
  setEnv(ORIGINAL_ENV);
});

describe("isManagerLaunched", () => {
  test("true only when USE_MANAGER_SAVE === 'true' (string)", () => {
    setEnv({ USE_MANAGER_SAVE: "true" });
    expect(isManagerLaunched()).toBe(true);
    setEnv({ USE_MANAGER_SAVE: "false" });
    expect(isManagerLaunched()).toBe(false);
    setEnv({});
    expect(isManagerLaunched()).toBe(false);
  });
});

describe("initManagerRuntime", () => {
  test("returns null in solo-dev mode (USE_MANAGER_SAVE != 'true')", () => {
    setEnv({});
    expect(initManagerRuntime()).toBeNull();
  });

  test("requires MANAGER_INSTANCE_TOKEN", () => {
    setEnv({ ...managerEnv(), MANAGER_INSTANCE_TOKEN: "" });
    expect(() => initManagerRuntime()).toThrow(/MANAGER_INSTANCE_TOKEN/);
  });

  test("requires INSTANCE_ID", () => {
    setEnv({ ...managerEnv(), INSTANCE_ID: "" });
    expect(() => initManagerRuntime()).toThrow(/INSTANCE_ID/);
  });

  test("requires MANAGER_URL", () => {
    setEnv({ ...managerEnv(), MANAGER_URL: "" });
    expect(() => initManagerRuntime()).toThrow(/MANAGER_URL/);
  });

  test("requires JWT_VERIFY_SECRET (manager spawn pipeline injects it)", () => {
    setEnv({ ...managerEnv(), JWT_VERIFY_SECRET: "" });
    expect(() => initManagerRuntime()).toThrow(/JWT_VERIFY_SECRET/);
  });

  test("rejects a token signed with a different JWT_VERIFY_SECRET", () => {
    const otherSecret = crypto.randomBytes(32);
    setEnv({
      ...managerEnv({
        MANAGER_INSTANCE_TOKEN: makeToken(validClaims(), {
          signWith: otherSecret,
        }),
      }),
    });
    expect(() => initManagerRuntime()).toThrow(/signature mismatch/);
  });

  test("rejects an INSTANCE_ID that doesn't match the JWT's instance_id", () => {
    setEnv({
      ...managerEnv({
        MANAGER_INSTANCE_TOKEN: makeToken(
          validClaims({ instance_id: "different-id" }),
        ),
      }),
    });
    expect(() => initManagerRuntime()).toThrow(/instance_id mismatch/);
  });

  test("returns a runtime handle on success", () => {
    setEnv(managerEnv());
    const rt = initManagerRuntime();
    expect(rt).toBeTruthy();
    expect(rt.instanceId).toBe("i-1");
    expect(rt.status.current()).toBe("running");
    expect(rt.claims.instance_id).toBe("i-1");
  });

  test("is idempotent — second call returns the same runtime", () => {
    setEnv(managerEnv());
    const a = initManagerRuntime();
    const b = initManagerRuntime();
    expect(b).toBe(a);
  });
});

describe("buildTickPayload", () => {
  test("produces a contract-valid payload without ctx (no state)", () => {
    const status = new TickStatus("running");
    const p = buildTickPayload({ sequence: 0, status, ctx: null });
    expect(p).toEqual({ sequence: 0, status: "running" });
  });

  test("includes derived participant counts when ctx is provided", () => {
    const status = new TickStatus("running");
    const ctx = {
      scopesByKind: () => [
        { id: "p1", get: (k) => ({ introDone: true, connected: true })[k] },
        { id: "p2", get: (k) => ({ connected: false })[k] },
      ],
    };
    const p = buildTickPayload({ sequence: 7, status, ctx });
    expect(p.sequence).toBe(7);
    expect(p.state.participants.count).toBe(2);
    expect(p.state.participants.buckets.inLobby).toBe(1);
    expect(p.state.participants.buckets.disconnected).toBe(1);
  });

  test("propagates draining status", () => {
    const status = new TickStatus("running");
    status.set("draining");
    const p = buildTickPayload({ sequence: 0, status, ctx: null });
    expect(p.status).toBe("draining");
  });
});

describe("initManagerRuntime ctx-supplier shape", () => {
  test("calls getCtx fresh each tick (so ctx supplied later is picked up)", async () => {
    setEnv(managerEnv());
    let currentCtx = null;
    // Mock manager: echoes the sequence it received in ackedSequence
    // so the runtime's mismatch-detect resync logic doesn't fire on
    // the steady state.
    const fetchImpl = (_url, opts) => {
      const sent = JSON.parse(opts.body);
      return Promise.resolve({
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, ackedSequence: sent.sequence }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    const rt = initManagerRuntime({
      getCtx: () => currentCtx,
      fetchImpl,
    });
    expect(rt).toBeTruthy();
    // First tick: getCtx returns null, payload has no `state`.
    await rt.scheduler.tickOnce();
    // Now supply a real-ish ctx and tick again — buildTickPayload
    // should now see it.
    currentCtx = {
      scopesByKind: () => [{ id: "p1", get: (k) => ({ connected: true })[k] }],
    };
    await rt.scheduler.tickOnce();
    // Sanity: the runtime advanced through two acks.
    expect(rt.getSequence()).toBe(2);
  });

  test("setCtx() pushes a new ctx that the next tick reads", async () => {
    setEnv(managerEnv());
    // Mock manager: echoes the sequence it received in ackedSequence
    // so the runtime's mismatch-detect resync logic doesn't fire on
    // the steady state.
    const fetchImpl = (_url, opts) => {
      const sent = JSON.parse(opts.body);
      return Promise.resolve({
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, ackedSequence: sent.sequence }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    const rt = initManagerRuntime({ fetchImpl });
    await rt.scheduler.tickOnce();
    rt.setCtx({
      scopesByKind: () => [{ id: "p1", get: (k) => ({ connected: true })[k] }],
    });
    await rt.scheduler.tickOnce();
    expect(rt.getSequence()).toBe(2);
  });

  test("ackedSequence mismatch triggers resync to ackedSequence + 1", async () => {
    setEnv(managerEnv());
    let firstCall = true;
    const fetchImpl = () => {
      const ack = firstCall ? 42 : 0; // first reply claims to ack seq 42
      firstCall = false;
      return Promise.resolve({
        status: 200,
        text: async () => JSON.stringify({ ok: true, ackedSequence: ack }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    const rt = initManagerRuntime({ fetchImpl });
    // Sent seq 0. Manager replied with ackedSequence=42 → mismatch.
    // Runtime resyncs nextSequence = 42 + 1 = 43.
    await rt.scheduler.tickOnce();
    expect(rt.getSequence()).toBe(43);
  });

  test("non-retryable rejection captures to Sentry and advances the sequence", async () => {
    setEnv(managerEnv());
    const fetchImpl = () =>
      Promise.resolve({
        status: 400,
        text: async () =>
          JSON.stringify({
            ok: false,
            retryable: false,
            code: "RUNTIME_PROTOCOL_VIOLATION_PREMATURE_COMPLETE",
            message: "complete sent before all saves ack'd",
          }),
        headers: new Map([["content-type", "application/json"]]),
      });
    const captured = [];
    const sentryImpl = {
      captureMessage: (msg, opts) => captured.push({ msg, opts }),
    };
    const rt = initManagerRuntime({ fetchImpl, sentryImpl });
    await rt.scheduler.tickOnce();

    // Sequence advances even on discard so the runtime doesn't loop.
    expect(rt.getSequence()).toBe(1);
    // One Sentry capture with the contract-shaped tags + extras.
    expect(captured).toHaveLength(1);
    expect(captured[0].msg).toBe("manager rejected tick (non-retryable)");
    expect(captured[0].opts.level).toBe("error");
    expect(captured[0].opts.tags).toMatchObject({
      instance_id: "i-1",
      batch_id: "b-1",
      study_id: "s-1",
      workspace_id: "w-1",
      tick_outcome: "discarded",
      tick_code: "RUNTIME_PROTOCOL_VIOLATION_PREMATURE_COMPLETE",
    });
    expect(captured[0].opts.extra).toMatchObject({
      sentSequence: 0,
      sentStatus: "running",
      code: "RUNTIME_PROTOCOL_VIOLATION_PREMATURE_COMPLETE",
      message: "complete sent before all saves ack'd",
      httpStatus: 400,
    });
  });

  test("retryable rejection does NOT capture to Sentry (next tick will retry)", async () => {
    setEnv(managerEnv());
    const fetchImpl = () =>
      Promise.resolve({
        status: 503,
        text: async () =>
          JSON.stringify({
            ok: false,
            retryable: true,
            code: "RATE_LIMITED",
          }),
        headers: new Map([["content-type", "application/json"]]),
      });
    const captured = [];
    const sentryImpl = {
      captureMessage: (msg, opts) => captured.push({ msg, opts }),
    };
    const rt = initManagerRuntime({ fetchImpl, sentryImpl });
    await rt.scheduler.tickOnce();

    // Retryable: sequence stays put, no Sentry capture.
    expect(rt.getSequence()).toBe(0);
    expect(captured).toHaveLength(0);
  });
});
