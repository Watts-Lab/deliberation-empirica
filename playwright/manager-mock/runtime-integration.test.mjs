// End-to-end integration test: real manager runtime →
// real manager-mock server. No fetch mocking — exercises the full
// HTTP roundtrip (JWT signature, payload schema, tick-response
// shape) so contract drift between the two sides surfaces here
// before it bites a real deploy.
//
// The unit tests under server/src/manager/ mock fetchImpl entirely
// and validate runtime logic in isolation. This test plugs the
// runtime into the same harness the manager-mock-vitest workflow
// already uses for its server.test.mjs round-trip checks, just
// from the other end.

import crypto from "node:crypto";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { buildManagerMock } from "./index.mjs";

// Stub `@sentry/node` so the cross-package import from
// server/src/manager/index.mjs resolves without requiring this
// (test-only) package to declare a transitive dep on the real
// Sentry SDK. The runtime calls `Sentry.captureMessage` for
// platform-developer-actionable errors; in this test we don't
// care about the captures, just that they don't throw.
vi.mock("@sentry/node", () => ({
  init: vi.fn(),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

// eslint-disable-next-line import/first
import {
  initManagerRuntime,
  resetManagerRuntimeForTests,
} from "../../server/src/manager/index.mjs";
// eslint-disable-next-line import/first
import { resetJwtSecretCacheForTests } from "../../server/src/manager/jwtVerifier.mjs";

const SECRET = crypto.randomBytes(32);
const SECRET_B64 = SECRET.toString("base64");

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
  instance_id: "i-test",
  batch_id: "b-test",
  study_id: "s-test",
  workspace_id: "w-test",
  iat: Math.floor(Date.now() / 1000) - 60,
  exp: Math.floor(Date.now() / 1000) + 24 * 3600,
  aud: "manager",
  scope: "tick",
  kid: "v1",
  ...overrides,
});

describe("runtime ↔ manager-mock end-to-end", () => {
  let mock;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(async () => {
    // Start mock with full HS256 verification — same code path the
    // real manager will run. Catches token-shape regressions on the
    // runtime side that decode-only mode would mask.
    mock = buildManagerMock({ jwtVerify: "hs256", secret: SECRET });
    await mock.start();
    resetManagerRuntimeForTests();
    resetJwtSecretCacheForTests();
    Object.keys(process.env).forEach((k) => delete process.env[k]);
  });

  afterEach(async () => {
    resetManagerRuntimeForTests();
    if (mock) await mock.stop();
    Object.keys(process.env).forEach((k) => delete process.env[k]);
    Object.assign(process.env, ORIGINAL_ENV);
  });

  function setEnv() {
    Object.assign(process.env, {
      USE_MANAGER_SAVE: "true",
      MANAGER_URL: mock.url,
      INSTANCE_ID: "i-test",
      JWT_VERIFY_SECRET: SECRET_B64,
      MANAGER_INSTANCE_TOKEN: makeToken(validClaims()),
    });
  }

  test("initManagerRuntime + tickOnce: heartbeat tick roundtrips successfully", async () => {
    setEnv();
    const rt = initManagerRuntime();
    expect(rt).toBeTruthy();
    expect(rt.instanceId).toBe("i-test");

    await rt.scheduler.tickOnce();

    const received = mock.received();
    expect(received).toHaveLength(1);
    expect(received[0].payload.sequence).toBe(0);
    expect(received[0].payload.status).toBe("running");
    // Sequence advanced — runtime treated the response as `acked`.
    expect(rt.getSequence()).toBe(1);
  });

  test("registered output rides a tick + hash recorded on ack", async () => {
    setEnv();
    // In-memory fs stub for the registered file. Production reads
    // from disk; the runtime API takes injectable fsImpl for this.
    const fsImpl = {
      readFileSync(diskPath) {
        if (diskPath === "/data/science.jsonl") {
          return Buffer.from('{"row":1}\n');
        }
        const err = new Error(`ENOENT: ${diskPath}`);
        err.code = "ENOENT";
        throw err;
      },
    };
    const rt = initManagerRuntime({ fsImpl });
    rt.registerOutput({
      runtimePath: "scienceData.jsonl",
      diskPath: "/data/science.jsonl",
    });

    await rt.scheduler.tickOnce();

    const received = mock.received();
    expect(received).toHaveLength(1);
    expect(received[0].payload.save).toBeDefined();
    expect(received[0].payload.save.path).toBe("scienceData.jsonl");
    expect(received[0].payload.save.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      Buffer.from(received[0].payload.save.contentBase64, "base64").toString(),
    ).toBe('{"row":1}\n');
    // Mock acked → hash recorded on the runtime side.
    expect(rt.hashStore.lastAcked("scienceData.jsonl")).toBe(
      received[0].payload.save.contentHash,
    );
  });

  test("reportError → next tick → manager dedupes by (instance, error.id)", async () => {
    setEnv();
    const rt = initManagerRuntime();
    rt.reportError({
      id: "err_001",
      kind: "platform-error",
      code: "EXAMPLE_FAILURE",
      message: "test error from integration",
      retryable: false,
    });

    await rt.scheduler.tickOnce();

    const received = mock.received();
    expect(received[0].payload.errors).toHaveLength(1);
    expect(received[0].payload.errors[0].id).toBe("err_001");
    // Acked → queue cleared on the runtime side.
    expect(rt.getErrorQueue()).toEqual([]);
  });

  test("complete tick stops the scheduler after ack (terminal)", async () => {
    setEnv();
    const rt = initManagerRuntime();
    rt.status.set("complete");

    await rt.scheduler.tickOnce();

    const received = mock.received();
    expect(received[0].payload.status).toBe("complete");
    expect(received[0].payload.save).toBeUndefined();
    expect(rt.scheduler.stopped).toBe(true);
  });

  test("rejects a token signed with a different secret (mock + runtime agree)", async () => {
    // Both sides verify against the same secret; a token signed
    // under an attacker key fails on either side. Pin: the runtime
    // verifier rejects at boot before a single byte goes on the
    // wire (chunk #109 fail-fast preflight).
    const attackerSecret = crypto.randomBytes(32);
    Object.assign(process.env, {
      USE_MANAGER_SAVE: "true",
      MANAGER_URL: mock.url,
      INSTANCE_ID: "i-test",
      JWT_VERIFY_SECRET: SECRET_B64,
      MANAGER_INSTANCE_TOKEN: (() => {
        const h = Buffer.from(
          JSON.stringify({ alg: "HS256", typ: "JWT" }),
        ).toString("base64url");
        const b = Buffer.from(JSON.stringify(validClaims())).toString(
          "base64url",
        );
        const s = crypto
          .createHmac("sha256", attackerSecret)
          .update(`${h}.${b}`)
          .digest("base64url");
        return `${h}.${b}.${s}`;
      })(),
    });
    expect(() => initManagerRuntime()).toThrow(/signature mismatch/);
  });
});
