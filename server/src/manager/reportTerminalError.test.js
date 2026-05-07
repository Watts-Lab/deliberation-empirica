import crypto from "node:crypto";
import { describe, test, expect, beforeEach } from "vitest";
import { initManagerRuntime, resetManagerRuntimeForTests } from "./index.mjs";
import { resetJwtSecretCacheForTests } from "./jwtVerifier.mjs";
import { reportTerminalError } from "./reportTerminalError.mjs";

const SECRET = crypto.randomBytes(32);

function makeToken(claims) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SECRET)
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

const ORIGINAL_ENV = { ...process.env };

function setEnv(env) {
  Object.keys(process.env).forEach((k) => delete process.env[k]);
  Object.assign(process.env, env);
}

const managerEnv = (overrides = {}) => ({
  USE_MANAGER_SAVE: "true",
  MANAGER_URL: "https://m.example",
  INSTANCE_ID: "i-1",
  JWT_VERIFY_SECRET: SECRET.toString("base64"),
  MANAGER_INSTANCE_TOKEN: makeToken(validClaims()),
  ...overrides,
});

beforeEach(() => {
  resetManagerRuntimeForTests();
  resetJwtSecretCacheForTests();
  setEnv(ORIGINAL_ENV);
});

describe("reportTerminalError — argument validation", () => {
  test("throws if `code` is missing", async () => {
    setEnv({});
    await expect(reportTerminalError({ message: "x" })).rejects.toThrow(
      /code is required/,
    );
  });

  test("throws if `message` is missing", async () => {
    setEnv({});
    await expect(reportTerminalError({ code: "X" })).rejects.toThrow(
      /message is required/,
    );
  });
});

describe("reportTerminalError — solo-dev mode is a no-op", () => {
  test("doesn't throw and doesn't try to access the runtime", async () => {
    setEnv({}); // no USE_MANAGER_SAVE
    const err = await reportTerminalError({
      code: "EXAMPLE_FAILURE",
      message: "test message",
    });
    expect(err.code).toBe("EXAMPLE_FAILURE");
    expect(err.message).toBe("test message");
    expect(err.kind).toBe("platform-error");
    expect(err.retryable).toBe(false);
    expect(err.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});

describe("reportTerminalError — manager mode wires reportError + setStatus + fireTickNow", () => {
  test("rides the next tick: error pushed, status set to failed, immediate emit", async () => {
    setEnv(managerEnv());
    const sent = [];
    const fetchImpl = (_url, opts) => {
      const payload = JSON.parse(opts.body);
      sent.push(payload);
      return Promise.resolve({
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, ackedSequence: payload.sequence }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    const rt = initManagerRuntime({ fetchImpl });
    expect(rt.status.current()).toBe("running");

    const reported = await reportTerminalError({
      code: "BATCH_INIT_FAILED",
      message: "treatment validation failed",
      batchId: "b-test",
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].status).toBe("failed");
    expect(sent[0].errors).toHaveLength(1);
    expect(sent[0].errors[0]).toEqual({
      id: reported.id,
      kind: "platform-error",
      code: "BATCH_INIT_FAILED",
      message: "treatment validation failed",
      retryable: false,
      details: { batchId: "b-test" },
    });
    // Status persists after the tick.
    expect(rt.status.current()).toBe("failed");
  });

  test("includes optional path + details fields when provided", async () => {
    setEnv(managerEnv());
    const sent = [];
    const rt = initManagerRuntime({
      fetchImpl: (_url, opts) => {
        const payload = JSON.parse(opts.body);
        sent.push(payload);
        return Promise.resolve({
          status: 200,
          text: async () =>
            JSON.stringify({ ok: true, ackedSequence: payload.sequence }),
          headers: new Map([["content-type", "application/json"]]),
        });
      },
    });

    await reportTerminalError({
      code: "INVALID_TREATMENT",
      kind: "validation",
      message: "playerCount missing",
      batchId: "b-1",
      path: "/treatments/0/playerCount",
      details: { stack: "...", treatmentName: "t1" },
    });

    expect(sent[0].errors[0].path).toBe("/treatments/0/playerCount");
    expect(sent[0].errors[0].details).toEqual({
      batchId: "b-1",
      stack: "...",
      treatmentName: "t1",
    });
    expect(sent[0].errors[0].kind).toBe("validation");
    // Sanity: rt is initialized, no leak.
    expect(rt.status.current()).toBe("failed");
  });

  test("filters undefined-valued fields out of details (avoids empty-on-wire payload)", async () => {
    // A caller passing { stack: err?.stack?.slice(...) } against an
    // error with no stack ends up with `details: { stack: undefined }`.
    // Without filtering, Object.keys(...).length === 2 and we'd set
    // `tickError.details = { batchId, stack: undefined }`, which
    // JSON.stringify serializes to `{ "batchId": "..." }` on the wire
    // — still has the batchId, but if batchId were also undefined we'd
    // get an empty `{}` body. Pin: filter undefineds first.
    setEnv(managerEnv());
    const sent = [];
    initManagerRuntime({
      fetchImpl: (_url, opts) => {
        const payload = JSON.parse(opts.body);
        sent.push(payload);
        return Promise.resolve({
          status: 200,
          text: async () =>
            JSON.stringify({ ok: true, ackedSequence: payload.sequence }),
          headers: new Map([["content-type", "application/json"]]),
        });
      },
    });

    // No batchId, undefined stack → details should be omitted entirely.
    await reportTerminalError({
      code: "EXAMPLE",
      message: "all undefined",
      details: { stack: undefined, otherField: undefined },
    });
    expect(sent[0].errors[0].details).toBeUndefined();

    // batchId present, undefined stack → details has only batchId.
    sent.length = 0;
    await reportTerminalError({
      code: "EXAMPLE",
      message: "stack undefined but batchId present",
      batchId: "b-1",
      details: { stack: undefined },
    });
    expect(sent[0].errors[0].details).toEqual({ batchId: "b-1" });
    expect("stack" in sent[0].errors[0].details).toBe(false);
  });

  test("omits details entirely when no batchId/details provided", async () => {
    setEnv(managerEnv());
    const sent = [];
    initManagerRuntime({
      fetchImpl: (_url, opts) => {
        const payload = JSON.parse(opts.body);
        sent.push(payload);
        return Promise.resolve({
          status: 200,
          text: async () =>
            JSON.stringify({ ok: true, ackedSequence: payload.sequence }),
          headers: new Map([["content-type", "application/json"]]),
        });
      },
    });

    await reportTerminalError({
      code: "EXAMPLE",
      message: "no details given",
    });

    expect(sent[0].errors[0].details).toBeUndefined();
    expect(sent[0].errors[0].path).toBeUndefined();
  });

  test("each call gets a unique id", async () => {
    setEnv(managerEnv());
    initManagerRuntime({
      fetchImpl: (_url, opts) => {
        const payload = JSON.parse(opts.body);
        return Promise.resolve({
          status: 200,
          text: async () =>
            JSON.stringify({ ok: true, ackedSequence: payload.sequence }),
          headers: new Map([["content-type", "application/json"]]),
        });
      },
    });

    const a = await reportTerminalError({ code: "X", message: "1" });
    const b = await reportTerminalError({ code: "X", message: "2" });
    expect(a.id).not.toBe(b.id);
  });

  test("returns the constructed tickError + status flips + error stays queued when the tick fetch fails", async () => {
    setEnv(managerEnv());
    const rt = initManagerRuntime({
      fetchImpl: () => Promise.reject(new Error("manager down")),
    });
    // Fetch fails; the helper still returns the tickError, status
    // is flipped to failed, and the error stays queued for the
    // next tick to retry (matches the contract: status advances
    // immediately; the manager catches up when it's reachable).
    const reported = await reportTerminalError({
      code: "EXAMPLE",
      message: "test",
    });
    expect(reported.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(rt.status.current()).toBe("failed");
    expect(rt.getErrorQueue()).toHaveLength(1);
    expect(rt.getErrorQueue()[0].id).toBe(reported.id);
  });
});

describe("reportTerminalError — bootstrap-order safety", () => {
  test("throws under USE_MANAGER_SAVE=true if runtime not initialized (mirrors reportError)", async () => {
    setEnv({ USE_MANAGER_SAVE: "true" });
    // Don't call initManagerRuntime — simulate the bootstrap order
    // bug. The underlying `reportError` throws; reportTerminalError
    // surfaces the throw to the caller.
    await expect(
      reportTerminalError({ code: "X", message: "y" }),
    ).rejects.toThrow(/manager runtime hasn't been initialized/);
  });

  test("a sync caller using `.catch(...)` (no await) catches the rejection cleanly", async () => {
    // The setCurrentlyRecruitingBatch wiring in callbacks.js is a
    // sync function that calls `reportTerminalError(...).catch(...)`
    // rather than awaiting (no async-fn promotion). Pin that the
    // `.catch` handler actually runs on the bootstrap-order
    // rejection path.
    setEnv({ USE_MANAGER_SAVE: "true" });
    let caught = null;
    reportTerminalError({ code: "X", message: "y" }).catch((e) => {
      caught = e;
    });
    // Wait one microtask for the catch to land.
    await Promise.resolve();
    expect(caught).toBeTruthy();
    expect(String(caught.message)).toMatch(
      /manager runtime hasn't been initialized/,
    );
  });
});
