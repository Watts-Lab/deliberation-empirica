import crypto from "node:crypto";
import { describe, test, expect, beforeEach, vi } from "vitest";
import {
  isManagerLaunched,
  initManagerRuntime,
  buildTickPayload,
  pickEligibleSave,
  registerOutput,
  reportError,
  resetManagerRuntimeForTests,
} from "./index.mjs";
import { ContentHashStore } from "./contentHashStore.mjs";
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

  test("shedLevel=1 drops state.participants.details but keeps buckets + count", () => {
    // Cap-as-forcing-function shed (manager#261). The biggest
    // variable cost in tick.state is `details[]` — one entry per
    // participant. Level 1 drops it; manager retains the BL-4
    // aggregate via `buckets`.
    const status = new TickStatus("running");
    const ctx = {
      scopesByKind: () => [
        { id: "p1", get: (k) => ({ introDone: true, connected: true })[k] },
        { id: "p2", get: (k) => ({ connected: false })[k] },
      ],
    };
    const p = buildTickPayload({ sequence: 0, status, ctx, shedLevel: 1 });
    expect(p.state.participants.count).toBe(2);
    expect(p.state.participants.buckets).toBeDefined();
    expect(p.state.participants.details).toBeUndefined();
  });

  test("shedLevel=2 drops buckets too, keeping only the count", () => {
    // Floor of the shed budget — BL-4 still gets SOMETHING to render
    // ("N participants") even if it can't break out by phase.
    const status = new TickStatus("running");
    const ctx = {
      scopesByKind: () => [
        { id: "p1", get: (k) => ({ introDone: true, connected: true })[k] },
      ],
    };
    const p = buildTickPayload({ sequence: 0, status, ctx, shedLevel: 2 });
    expect(p.state.participants.count).toBe(1);
    expect(p.state.participants.buckets).toBeUndefined();
    expect(p.state.participants.details).toBeUndefined();
  });

  test("shedLevel never drops save or errors — those are load-bearing", () => {
    // Save = researcher's data, must reach GitHub. Errors = the
    // surface the manager renders for participant-actionable issues.
    // Shedding either is wrong; shed only ever trims `state`.
    const status = new TickStatus("running");
    const errors = [
      {
        id: "e1",
        kind: "validation",
        code: "T",
        message: "m",
        retryable: false,
      },
    ];
    const p = buildTickPayload({
      sequence: 0,
      status,
      ctx: null,
      save: {
        path: "data.jsonl",
        contentHash: "a".repeat(64),
        contentBase64: "aGVsbG8=",
      },
      errors,
      shedLevel: 2,
    });
    expect(p.save).toBeDefined();
    expect(p.errors).toHaveLength(1);
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

  test("PAYLOAD_TOO_LARGE triggers shed-and-retry: sequence stays put, shedLevel advances, Sentry warns", async () => {
    // Manager#261 cap-as-forcing-function. The runtime sheds the
    // heaviest optional state and re-emits the SAME sequence on the
    // next tick — the manager dedupes, so we don't risk
    // double-processing. Sentry captures each shed step as a
    // breadcrumb so operators see the loop before it becomes
    // PAYLOAD_TOO_LARGE_AFTER_SHED.
    setEnv(managerEnv());
    const sentBodies = [];
    const fetchImpl = (_url, opts) => {
      sentBodies.push(JSON.parse(opts.body));
      return Promise.resolve({
        status: 413,
        text: async () =>
          JSON.stringify({
            ok: false,
            retryable: false,
            code: "PAYLOAD_TOO_LARGE",
            message: "Request body is too large",
          }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    const captured = [];
    const sentryImpl = {
      captureMessage: (msg, opts) => captured.push({ msg, opts }),
    };
    // Use a setImmediate stub we control so the burst-retry doesn't
    // fire automatically inside `tickOnce`. We assert on the captured
    // bodies of the first tick alone.
    const setImmediateImpl = vi.fn();
    const rt = initManagerRuntime({
      getCtx: () => ({
        scopesByKind: () => [
          { id: "p1", get: (k) => ({ connected: true })[k] },
        ],
      }),
      fetchImpl,
      sentryImpl,
      setImmediateImpl,
    });
    await rt.scheduler.tickOnce();

    // First tick was full payload (shedLevel=0).
    expect(sentBodies).toHaveLength(1);
    expect(sentBodies[0].state.participants.details).toBeDefined();
    // Sequence didn't advance — we'll re-emit on next tick.
    expect(rt.getSequence()).toBe(0);
    // Sentry captured the shed event.
    expect(captured).toHaveLength(1);
    expect(captured[0].msg).toContain("PAYLOAD_TOO_LARGE");
    expect(captured[0].opts.tags.tick_outcome).toBe("shed-and-retry");
    expect(captured[0].opts.tags.shed_level).toBe("1");
    // A retry was scheduled (we didn't fire it — that would loop
    // infinitely against the mock that always returns 413).
    expect(setImmediateImpl).toHaveBeenCalledOnce();
  });

  test("exhausted shed budget → PAYLOAD_TOO_LARGE_AFTER_SHED + advance sequence (give up)", async () => {
    // After the runtime has shed to the floor (level 2), the manager
    // STILL rejects — that's a genuine runtime bug (probably a huge
    // save buffer the dl#187 gzip path should have shrunk). Advance
    // the cursor + tag distinctly so operators see this is the
    // "we exhausted everything we could shed" state, not yet another
    // generic overage.
    setEnv(managerEnv());
    const fetchImpl = () =>
      Promise.resolve({
        status: 413,
        text: async () =>
          JSON.stringify({
            ok: false,
            retryable: false,
            code: "PAYLOAD_TOO_LARGE",
            message: "still too large",
          }),
        headers: new Map([["content-type", "application/json"]]),
      });
    const captured = [];
    const sentryImpl = {
      captureMessage: (msg, opts) => captured.push({ msg, opts }),
    };
    // Capture-and-replay setImmediate: lets the test drain the
    // burst-retry chain serially, awaiting each one. A synchronous
    // `fn()` here would launch an un-awaited promise that the test
    // assertion races against.
    const pending = [];
    const setImmediateImpl = vi.fn((fn) => pending.push(fn));
    const rt = initManagerRuntime({
      getCtx: () => ({
        scopesByKind: () => [
          { id: "p1", get: (k) => ({ connected: true })[k] },
        ],
      }),
      fetchImpl,
      sentryImpl,
      setImmediateImpl,
    });
    await rt.scheduler.tickOnce();
    // Drain the burst chain: each shed schedules another tick.
    while (pending.length > 0) {
      const fn = pending.shift();
      // eslint-disable-next-line no-await-in-loop
      await fn();
    }
    // Three ticks fire: full (level 0), shed-1, shed-2, then the
    // floor still fails → discard branch with the rewritten code.
    // Sequence advances once at the end (the discard advance).
    expect(rt.getSequence()).toBe(1);
    // Last Sentry capture is the AFTER_SHED variant with
    // `tick_outcome: "discarded"`. The `shed_level` tag carries
    // the final shed level (2 = floor) so operators can pivot on
    // "how far did we get before giving up."
    const last = captured[captured.length - 1];
    expect(last.msg).toBe("manager rejected tick (non-retryable)");
    expect(last.opts.tags.tick_code).toBe("PAYLOAD_TOO_LARGE_AFTER_SHED");
    expect(last.opts.tags.tick_outcome).toBe("discarded");
    expect(last.opts.tags.shed_level).toBe("2");
  });

  test("focused level 0 → 1 → ack: one shed step, then recovery", async () => {
    // Isolates the single-shed transition without the give-up logic
    // muddying the assertion. Pinpoints "second setImmediate fires
    // a tick that acks" so a regression on burst-retry mechanics
    // can't hide behind the broader exhausted-budget test.
    setEnv(managerEnv());
    const sentBodies = [];
    let callCount = 0;
    const fetchImpl = (_url, opts) => {
      const sent = JSON.parse(opts.body);
      sentBodies.push(sent);
      callCount += 1;
      if (callCount === 1) {
        return Promise.resolve({
          status: 413,
          text: async () =>
            JSON.stringify({
              ok: false,
              retryable: false,
              code: "PAYLOAD_TOO_LARGE",
              message: "too big",
            }),
          headers: new Map([["content-type", "application/json"]]),
        });
      }
      return Promise.resolve({
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, ackedSequence: sent.sequence }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    const pending = [];
    const setImmediateImpl = vi.fn((fn) => pending.push(fn));
    const rt = initManagerRuntime({
      getCtx: () => ({
        scopesByKind: () => [
          { id: "p1", get: (k) => ({ connected: true })[k] },
        ],
      }),
      fetchImpl,
      setImmediateImpl,
    });
    await rt.scheduler.tickOnce();
    expect(sentBodies).toHaveLength(1);
    // First tick: full shape (level 0).
    expect(sentBodies[0].state.participants.details).toBeDefined();
    expect(rt.getSequence()).toBe(0); // sequence did NOT advance on shed
    // Burst-retry was scheduled.
    expect(setImmediateImpl).toHaveBeenCalledOnce();
    // Drain the burst.
    const fn = pending.shift();
    await fn();
    expect(sentBodies).toHaveLength(2);
    // Second tick: shed level 1 — details dropped, buckets kept.
    expect(sentBodies[1].state.participants.details).toBeUndefined();
    expect(sentBodies[1].state.participants.buckets).toBeDefined();
    expect(sentBodies[1].state.participants.count).toBe(1);
    // Acked → sequence advances + shedLevel resets.
    expect(rt.getSequence()).toBe(1);
  });

  test("retry outcome does NOT reset shed budget (only ack proves shape acceptance)", async () => {
    // The runtime intentionally holds shedLevel through retry /
    // fetch-failed outcomes because neither answers "is the full
    // shape accepted?" — only an ack does. A retry after a shed
    // attempts the same shed shape on the next tick, not the
    // pre-shed full shape.
    setEnv(managerEnv());
    const sentBodies = [];
    let callCount = 0;
    const fetchImpl = (_url, opts) => {
      const sent = JSON.parse(opts.body);
      sentBodies.push(sent);
      callCount += 1;
      if (callCount === 1) {
        // First: PAYLOAD_TOO_LARGE — shed to level 1.
        return Promise.resolve({
          status: 413,
          text: async () =>
            JSON.stringify({
              ok: false,
              retryable: false,
              code: "PAYLOAD_TOO_LARGE",
              message: "too big",
            }),
          headers: new Map([["content-type", "application/json"]]),
        });
      }
      if (callCount === 2) {
        // Second (burst-retry): manager says retryable
        // (RATE_LIMITED) — runtime should HOLD shedLevel at 1.
        return Promise.resolve({
          status: 503,
          text: async () =>
            JSON.stringify({
              ok: false,
              retryable: true,
              code: "RATE_LIMITED",
            }),
          headers: new Map([["content-type", "application/json"]]),
        });
      }
      // Third (next regular tick): ack. Sent shape should STILL be
      // at level 1 (no details).
      return Promise.resolve({
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, ackedSequence: sent.sequence }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    const pending = [];
    const setImmediateImpl = vi.fn((fn) => pending.push(fn));
    const rt = initManagerRuntime({
      getCtx: () => ({
        scopesByKind: () => [
          { id: "p1", get: (k) => ({ connected: true })[k] },
        ],
      }),
      fetchImpl,
      setImmediateImpl,
    });
    await rt.scheduler.tickOnce(); // call 1: PTL → shed to 1
    expect(sentBodies[0].state.participants.details).toBeDefined();

    // Drain the burst.
    const fn = pending.shift();
    await fn(); // call 2: retry (RATE_LIMITED) — hold shedLevel at 1
    expect(sentBodies[1].state.participants.details).toBeUndefined();
    // Sequence still didn't advance (retry means re-emit).
    expect(rt.getSequence()).toBe(0);

    // Next regular tick: should STILL be at shedLevel 1.
    await rt.scheduler.tickOnce(); // call 3: ack
    expect(sentBodies[2].state.participants.details).toBeUndefined();
    // Now sequence advances + shedLevel resets.
    expect(rt.getSequence()).toBe(1);
  });

  test("acked tick resets shed budget", async () => {
    // Recovery path: after a successful tick the next failure starts
    // shedding from level 1 again, not where we left off.
    setEnv(managerEnv());
    let callCount = 0;
    const fetchImpl = (_url, opts) => {
      const sent = JSON.parse(opts.body);
      callCount += 1;
      if (callCount === 1) {
        // First call: PAYLOAD_TOO_LARGE — runtime sheds to level 1.
        return Promise.resolve({
          status: 413,
          text: async () =>
            JSON.stringify({
              ok: false,
              retryable: false,
              code: "PAYLOAD_TOO_LARGE",
              message: "too big",
            }),
          headers: new Map([["content-type", "application/json"]]),
        });
      }
      // Subsequent: ack normally. Resets shedLevel to 0.
      return Promise.resolve({
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, ackedSequence: sent.sequence }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    const sentryImpl = { captureMessage: vi.fn() };
    const pending = [];
    const setImmediateImpl = vi.fn((fn) => pending.push(fn));
    const rt = initManagerRuntime({
      getCtx: () => ({
        scopesByKind: () => [
          { id: "p1", get: (k) => ({ connected: true })[k] },
        ],
      }),
      fetchImpl,
      sentryImpl,
      setImmediateImpl,
    });
    await rt.scheduler.tickOnce();
    while (pending.length > 0) {
      const fn = pending.shift();
      // eslint-disable-next-line no-await-in-loop
      await fn();
    }
    // After the burst retry acks, the runtime should be ready for
    // another regular tick at sequence 1. (sequence advanced on ack.)
    expect(rt.getSequence()).toBe(1);
  });
});

// In-memory fs stub matching the subset of node:fs that pickEligibleSave
// reads — `readFileSync` only. ENOENT is reported via err.code so the
// helper's "skip missing files" branch runs as it would in production.
function makeMockFs(initialFiles = {}) {
  const files = { ...initialFiles };
  return {
    readFileSync(diskPath) {
      if (Object.prototype.hasOwnProperty.call(files, diskPath)) {
        return Buffer.from(files[diskPath]);
      }
      const err = new Error(`ENOENT: no such file ${diskPath}`);
      err.code = "ENOENT";
      throw err;
    },
    // Test-only mutators for "the file changed between ticks" cases.
    setContent(diskPath, content) {
      files[diskPath] = content;
    },
    removeFile(diskPath) {
      delete files[diskPath];
    },
  };
}

describe("pickEligibleSave (unit)", () => {
  test("returns null when no outputs are registered", () => {
    const outputs = new Map();
    const hashStore = new ContentHashStore();
    const fsImpl = makeMockFs();
    expect(pickEligibleSave({ outputs, hashStore, fsImpl })).toBeNull();
  });

  test("returns the first dirty file (registration order) shaped for the tick payload", () => {
    const outputs = new Map([
      ["science.jsonl", { diskPath: "/data/science.jsonl" }],
      ["payment.jsonl", { diskPath: "/data/payment.jsonl" }],
    ]);
    const hashStore = new ContentHashStore();
    const fsImpl = makeMockFs({
      "/data/science.jsonl": '{"row":1}\n',
      "/data/payment.jsonl": '{"pay":1}\n',
    });
    const save = pickEligibleSave({ outputs, hashStore, fsImpl });
    expect(save.path).toBe("science.jsonl");
    expect(save.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(Buffer.from(save.contentBase64, "base64").toString()).toBe(
      '{"row":1}\n',
    );
  });

  test("small saves (<1 KB) use identity encoding", async () => {
    // Per dl#187, sub-1KB saves stay identity-encoded — gzip's
    // ~20-byte header would inflate the payload rather than
    // compressing it. Normalize via `?? "identity"` because the
    // contract treats absent and explicit "identity" as equivalent;
    // a future refactor that emits the field explicitly is still
    // semantically correct. The wire-byte-saving optimization (omit
    // when identity) is pinned separately below.
    const outputs = new Map([
      ["science.jsonl", { diskPath: "/data/science.jsonl" }],
    ]);
    const hashStore = new ContentHashStore();
    const fsImpl = makeMockFs({
      "/data/science.jsonl": '{"row":1}\n',
    });
    const save = pickEligibleSave({ outputs, hashStore, fsImpl });
    expect(save.encoding ?? "identity").toBe("identity");
    expect(Buffer.from(save.contentBase64, "base64").toString()).toBe(
      '{"row":1}\n',
    );
  });

  test("wire optimization: identity encoding omits the `encoding` field", () => {
    // Pinned separately from the semantic test above. The omission
    // saves ~15 bytes per tick — small but compounds at scale, and
    // intentionally relies on the contract's default-is-identity
    // behavior. A future refactor that wants to emit "identity"
    // explicitly should update this test deliberately.
    const outputs = new Map([["a.jsonl", { diskPath: "/data/a.jsonl" }]]);
    const hashStore = new ContentHashStore();
    const fsImpl = makeMockFs({ "/data/a.jsonl": "tiny\n" });
    const save = pickEligibleSave({ outputs, hashStore, fsImpl });
    expect(save.encoding).toBeUndefined();
  });

  test("saves at or above 1 KB are gzipped — wire shrinks, hash is over RAW bytes", async () => {
    // Build a realistic JSONL save with enough repetition to
    // compress well — JSONL is the friendliest input gzip ever
    // sees. 100 rows × ~30 bytes = ~3 KB raw; well above the
    // 1 KB threshold.
    const raw = Array.from(
      { length: 100 },
      (_, i) => `{"participant":"p${i}","trial":${i}}`,
    ).join("\n");
    expect(raw.length).toBeGreaterThan(1024);

    const outputs = new Map([
      ["science.jsonl", { diskPath: "/data/science.jsonl" }],
    ]);
    const hashStore = new ContentHashStore();
    const fsImpl = makeMockFs({ "/data/science.jsonl": raw });
    const save = pickEligibleSave({ outputs, hashStore, fsImpl });

    // Encoding field announces gzip.
    expect(save.encoding).toBe("gzip");

    // Wire bytes are smaller than raw bytes (we wouldn't bother
    // otherwise). For JSONL with this much repetition, expect
    // significant compression — pin a relaxed lower-bound so this
    // test doesn't flake on zlib parameter changes.
    const wireBytes = Buffer.from(save.contentBase64, "base64");
    expect(wireBytes.length).toBeLessThan(raw.length);

    // Hash is over the RAW (uncompressed) bytes — survives the
    // compression layer. This is the integrity contract: what
    // reaches GitHub + S3 (after the manager gunzips) is verifiable
    // against `contentHash` end-to-end.
    expect(save.contentHash).toBe(ContentHashStore.hashContent(raw));

    // Round-trip: gunzip the wire bytes, expect the original raw.
    const { gunzipSync } = await import("node:zlib");
    const decompressed = gunzipSync(wireBytes).toString("utf8");
    expect(decompressed).toBe(raw);
  });

  test("the gzip threshold boundary: exactly 1 KB IS gzipped, 1023 bytes is not", () => {
    // Floor of the threshold (>=) — exactly 1 KB gzips, just below
    // doesn't. Pins the boundary so a refactor doesn't drift it.
    const outputs = new Map([["a.jsonl", { diskPath: "/data/a.jsonl" }]]);
    const hashStore = new ContentHashStore();
    const fsImpl = makeMockFs({ "/data/a.jsonl": "x".repeat(1023) });
    const justBelow = pickEligibleSave({ outputs, hashStore, fsImpl });
    expect(justBelow.encoding).toBeUndefined();

    // Fresh state: new hash store so the next read also fires.
    const outputs2 = new Map([["b.jsonl", { diskPath: "/data/b.jsonl" }]]);
    const hashStore2 = new ContentHashStore();
    const fsImpl2 = makeMockFs({ "/data/b.jsonl": "x".repeat(1024) });
    const atFloor = pickEligibleSave({
      outputs: outputs2,
      hashStore: hashStore2,
      fsImpl: fsImpl2,
    });
    expect(atFloor.encoding).toBe("gzip");
  });

  test("contentHash is stable across encodings — replay safety", () => {
    // The manager dedupes saves on (instance_id, path, contentHash).
    // If the hash drifted across encodings — e.g., a small save
    // hashed `buf`, a larger version of the same content hashed
    // `gzip(buf)` — replays would re-emit duplicates and the
    // cursor-advance invariant would break. This test pins that
    // `contentHash` is over the RAW bytes regardless of which
    // encoding path the wire-side took.
    const sameRaw = "row\n".repeat(50); // ~200 bytes — identity-encoded
    const bigRaw = sameRaw.repeat(100); // ~20 KB — gzip-encoded
    expect(sameRaw.length).toBeLessThan(1024);
    expect(bigRaw.length).toBeGreaterThan(1024);

    const a = pickEligibleSave({
      outputs: new Map([["a.jsonl", { diskPath: "/data/a.jsonl" }]]),
      hashStore: new ContentHashStore(),
      fsImpl: makeMockFs({ "/data/a.jsonl": sameRaw }),
    });
    const b = pickEligibleSave({
      outputs: new Map([["b.jsonl", { diskPath: "/data/b.jsonl" }]]),
      hashStore: new ContentHashStore(),
      fsImpl: makeMockFs({ "/data/b.jsonl": sameRaw }), // same raw
    });
    expect(a.contentHash).toBe(b.contentHash);
    // And the big version (which goes through the gzip branch) hashes
    // its OWN raw bytes — not the gzipped wire bytes.
    const big = pickEligibleSave({
      outputs: new Map([["c.jsonl", { diskPath: "/data/c.jsonl" }]]),
      hashStore: new ContentHashStore(),
      fsImpl: makeMockFs({ "/data/c.jsonl": bigRaw }),
    });
    expect(big.encoding).toBe("gzip");
    expect(big.contentHash).toBe(ContentHashStore.hashContent(bigRaw));
  });

  test("zero-byte file emits an identity save with empty base64", () => {
    // Edge case: a registered output that was touch'd but not yet
    // written. Hash is sha256("") (= e3b0c4...); contentBase64 is "".
    // Manager's `tickSave` accepts empty base64; first write of
    // actual content will re-emit with a different hash. No
    // "skip-empty" optimization — that would break first-write
    // semantics by leaving the manager unable to record that the
    // path exists at all.
    const outputs = new Map([["a.jsonl", { diskPath: "/data/a.jsonl" }]]);
    const hashStore = new ContentHashStore();
    const fsImpl = makeMockFs({ "/data/a.jsonl": "" });
    const save = pickEligibleSave({ outputs, hashStore, fsImpl });
    expect(save).not.toBeNull();
    expect(save.contentBase64).toBe("");
    expect(save.encoding).toBeUndefined();
    expect(save.contentHash).toBe(ContentHashStore.hashContent(""));
  });

  test("incompressible super-threshold input falls back to identity (compressibility guard)", () => {
    // A super-threshold payload of random-ish bytes won't compress —
    // gzip's header overhead inflates the wire. The compressibility
    // guard catches this and falls back to identity so we never ship
    // a payload that's bigger than the raw.
    //
    // crypto.randomBytes(2048) reliably produces a near-incompressible
    // buffer; gzip output is buf.length + ~20 bytes. The fallback
    // means the wire is the raw bytes, encoding is identity.
    const random = crypto.randomBytes(2048);
    const outputs = new Map([["r.jsonl", { diskPath: "/data/r.jsonl" }]]);
    const hashStore = new ContentHashStore();
    const fsImpl = {
      readFileSync(p) {
        if (p === "/data/r.jsonl") return random;
        const err = new Error(`ENOENT: ${p}`);
        err.code = "ENOENT";
        throw err;
      },
    };
    const save = pickEligibleSave({ outputs, hashStore, fsImpl });
    expect(save.encoding ?? "identity").toBe("identity");
    // Wire bytes == raw bytes (no inflation).
    const wireBytes = Buffer.from(save.contentBase64, "base64");
    expect(wireBytes.length).toBe(random.length);
    expect(wireBytes.equals(random)).toBe(true);
  });

  test("raw saves > 10 MB skip emit + Sentry-capture (oversize guard)", async () => {
    // Cap-as-forcing-function on the runtime side. Mirrors the
    // manager's 10 MB decompression cap; we don't waste CPU
    // gzipping a payload the manager would reject post-decode, and
    // we don't block the event loop on a giant gzipSync call. On
    // overflow: Sentry breadcrumb + skip — next tick retries the
    // same path, so the failure stays visible until investigated.
    const Sentry = await import("@sentry/node");
    const captureMessage = vi
      .spyOn(Sentry, "captureMessage")
      .mockImplementation(() => "evt-id");
    const oversize = Buffer.alloc(11 * 1024 * 1024, "x"); // 11 MB > 10 MB cap
    const outputs = new Map([["big.jsonl", { diskPath: "/data/big.jsonl" }]]);
    const hashStore = new ContentHashStore();
    const fsImpl = {
      readFileSync() {
        return oversize;
      },
    };
    const save = pickEligibleSave({ outputs, hashStore, fsImpl });
    expect(save).toBeNull();
    expect(captureMessage).toHaveBeenCalledOnce();
    const [msg, ctx] = captureMessage.mock.calls[0];
    expect(msg).toContain("exceeds runtime cap");
    expect(ctx.level).toBe("warning");
    expect(ctx.tags?.runtimePath).toBe("big.jsonl");
    captureMessage.mockRestore();
  });

  test("skips a file whose content matches the last-acked hash for that path", () => {
    const outputs = new Map([
      ["science.jsonl", { diskPath: "/data/science.jsonl" }],
    ]);
    const hashStore = new ContentHashStore();
    const fsImpl = makeMockFs({ "/data/science.jsonl": '{"row":1}\n' });
    const ackedHash = ContentHashStore.hashContent('{"row":1}\n');
    hashStore.recordAck("science.jsonl", ackedHash);
    expect(pickEligibleSave({ outputs, hashStore, fsImpl })).toBeNull();
  });

  test("re-emits a file whose content has changed since the last ack", () => {
    const outputs = new Map([
      ["science.jsonl", { diskPath: "/data/science.jsonl" }],
    ]);
    const hashStore = new ContentHashStore();
    const fsImpl = makeMockFs({ "/data/science.jsonl": '{"row":1}\n' });
    const ackedHash = ContentHashStore.hashContent('{"row":1}\n');
    hashStore.recordAck("science.jsonl", ackedHash);
    fsImpl.setContent("/data/science.jsonl", '{"row":1}\n{"row":2}\n');
    const save = pickEligibleSave({ outputs, hashStore, fsImpl });
    expect(save.path).toBe("science.jsonl");
    expect(save.contentHash).toBe(
      ContentHashStore.hashContent('{"row":1}\n{"row":2}\n'),
    );
  });

  test("silently skips ENOENT (file not yet written)", () => {
    // postFlightReport.jsonl is registered at batch init but doesn't
    // exist on disk until post-flight runs. Until then, the tick
    // scheduler should treat it as "nothing to save", not as an error.
    const outputs = new Map([
      ["postFlightReport.jsonl", { diskPath: "/data/postFlightReport.jsonl" }],
    ]);
    const hashStore = new ContentHashStore();
    const fsImpl = makeMockFs({}); // no files
    expect(pickEligibleSave({ outputs, hashStore, fsImpl })).toBeNull();
  });

  test("rethrows non-ENOENT filesystem errors (real I/O failures shouldn't be swallowed)", () => {
    // EACCES / EIO / EBUSY etc. signal a real problem — surfacing
    // them lets the runtime fail loudly rather than silently
    // dropping ticks under a corrupt disk.
    const outputs = new Map([
      ["science.jsonl", { diskPath: "/data/science.jsonl" }],
    ]);
    const hashStore = new ContentHashStore();
    const fsImpl = {
      readFileSync() {
        const err = new Error("EACCES: permission denied");
        err.code = "EACCES";
        throw err;
      },
    };
    expect(() => pickEligibleSave({ outputs, hashStore, fsImpl })).toThrow(
      /EACCES/,
    );
  });

  test("walks past a clean file to find a downstream dirty one", () => {
    const outputs = new Map([
      ["science.jsonl", { diskPath: "/data/science.jsonl" }],
      ["payment.jsonl", { diskPath: "/data/payment.jsonl" }],
    ]);
    const hashStore = new ContentHashStore();
    const fsImpl = makeMockFs({
      "/data/science.jsonl": '{"row":1}\n',
      "/data/payment.jsonl": '{"pay":1}\n',
    });
    // science already ack'd; payment is dirty.
    hashStore.recordAck(
      "science.jsonl",
      ContentHashStore.hashContent('{"row":1}\n'),
    );
    const save = pickEligibleSave({ outputs, hashStore, fsImpl });
    expect(save.path).toBe("payment.jsonl");
  });
});

describe("save lifecycle through onTick", () => {
  test("a registered dirty file rides the next tick; ack records the hash; second tick is empty", async () => {
    setEnv(managerEnv());
    const fsImpl = makeMockFs({ "/data/science.jsonl": '{"row":1}\n' });
    const sent = [];
    const fetchImpl = (_url, opts) => {
      const payload = JSON.parse(opts.body);
      sent.push(payload);
      return Promise.resolve({
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            ackedSequence: payload.sequence,
            commitSha: "deadbeef",
          }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    const rt = initManagerRuntime({ fetchImpl, fsImpl });
    rt.registerOutput({
      runtimePath: "science.jsonl",
      diskPath: "/data/science.jsonl",
    });

    await rt.scheduler.tickOnce();
    expect(sent[0].save).toBeDefined();
    expect(sent[0].save.path).toBe("science.jsonl");
    expect(Buffer.from(sent[0].save.contentBase64, "base64").toString()).toBe(
      '{"row":1}\n',
    );
    expect(rt.hashStore.lastAcked("science.jsonl")).toBe(
      sent[0].save.contentHash,
    );

    await rt.scheduler.tickOnce();
    expect(sent[1].save).toBeUndefined();
  });

  test("a retryable failure leaves lastAcked unchanged so the next tick retries the same content", async () => {
    setEnv(managerEnv());
    const fsImpl = makeMockFs({ "/data/science.jsonl": '{"row":1}\n' });
    let firstCall = true;
    const fetchImpl = (_url, opts) => {
      const payload = JSON.parse(opts.body);
      if (firstCall) {
        firstCall = false;
        return Promise.resolve({
          status: 503,
          text: async () =>
            JSON.stringify({
              ok: false,
              retryable: true,
              code: "RATE_LIMITED",
            }),
          headers: new Map([["content-type", "application/json"]]),
        });
      }
      return Promise.resolve({
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            ackedSequence: payload.sequence,
          }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    const rt = initManagerRuntime({ fetchImpl, fsImpl });
    rt.registerOutput({
      runtimePath: "science.jsonl",
      diskPath: "/data/science.jsonl",
    });

    await rt.scheduler.tickOnce();
    // 503 → no ack; lastAcked still unset.
    expect(rt.hashStore.lastAcked("science.jsonl")).toBeUndefined();

    await rt.scheduler.tickOnce();
    // Second tick succeeds; hash now recorded.
    expect(rt.hashStore.lastAcked("science.jsonl")).toMatch(/^[a-f0-9]{64}$/);
  });

  test("after an ack, mutating the file forces a re-emit on the next tick", async () => {
    setEnv(managerEnv());
    const fsImpl = makeMockFs({ "/data/science.jsonl": '{"row":1}\n' });
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
    const rt = initManagerRuntime({ fetchImpl, fsImpl });
    rt.registerOutput({
      runtimePath: "science.jsonl",
      diskPath: "/data/science.jsonl",
    });

    await rt.scheduler.tickOnce();
    expect(sent[0].save.path).toBe("science.jsonl");
    const firstHash = sent[0].save.contentHash;

    fsImpl.setContent("/data/science.jsonl", '{"row":1}\n{"row":2}\n');
    await rt.scheduler.tickOnce();
    expect(sent[1].save).toBeDefined();
    expect(sent[1].save.contentHash).not.toBe(firstHash);
  });

  test("ackedSequence-mismatch resync still records the save's hash", async () => {
    // Both code paths under `result.outcome === "acked"` should record
    // the hash; a sequence-mismatch resync forward shouldn't drop the
    // ack on the floor.
    setEnv(managerEnv());
    const fsImpl = makeMockFs({ "/data/science.jsonl": '{"row":1}\n' });
    const fetchImpl = () =>
      Promise.resolve({
        status: 200,
        text: async () => JSON.stringify({ ok: true, ackedSequence: 42 }),
        headers: new Map([["content-type", "application/json"]]),
      });
    const rt = initManagerRuntime({ fetchImpl, fsImpl });
    rt.registerOutput({
      runtimePath: "science.jsonl",
      diskPath: "/data/science.jsonl",
    });

    await rt.scheduler.tickOnce();
    expect(rt.hashStore.lastAcked("science.jsonl")).toMatch(/^[a-f0-9]{64}$/);
    expect(rt.getSequence()).toBe(43); // resynced past 42
  });
});

describe("draining → complete advance after saves-acked (#160)", () => {
  // Closes the early-close → full-teardown chain. dl#159 advanced
  // TickStatus from `running` to `draining` when the manager flips
  // batch.status to terminated; without the advance below, the runtime
  // sat in draining forever, the manager never observed `complete`, and
  // an operator had to manually delete the Railway service.
  //
  // Contract (manager ADR 0005 §"Batch close"):
  //   - all dirty saves ride out tick-by-tick on `draining` ticks
  //   - once every save has been ack'd, runtime advances to `complete`
  //   - the next tick carries `status: "complete"` with NO save
  //   - manager acks → scheduler stops; manager's state machine
  //     advances Instance Draining → AwaitingTeardown → Complete →
  //     auto-`serviceDelete`.
  //
  // Implementation seam: `onTick`'s `acked` branch, after
  // `hashStore.recordAck`. That ordering matters — if we picked
  // before recording the ack, the just-acked save would still look
  // dirty and we'd never advance.

  test("draining + 1 dirty file: tick acks save → status advances to complete", async () => {
    setEnv(managerEnv());
    const fsImpl = makeMockFs({ "/data/science.jsonl": '{"row":1}\n' });
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
    const rt = initManagerRuntime({ fetchImpl, fsImpl });
    rt.registerOutput({
      runtimePath: "science.jsonl",
      diskPath: "/data/science.jsonl",
    });
    rt.status.set("draining");

    await rt.scheduler.tickOnce();
    // The tick we just sent was a draining-with-save tick.
    expect(sent[0].status).toBe("draining");
    expect(sent[0].save).toBeDefined();
    // After ack, no more dirty files → runtime advances to complete.
    expect(rt.status.current()).toBe("complete");
  });

  test("draining + 2 dirty files: stays draining after first ack, advances after the second", async () => {
    setEnv(managerEnv());
    const fsImpl = makeMockFs({
      "/data/science.jsonl": '{"row":1}\n',
      "/data/payment.jsonl": '{"row":1}\n',
    });
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
    const rt = initManagerRuntime({ fetchImpl, fsImpl });
    rt.registerOutput({
      runtimePath: "science.jsonl",
      diskPath: "/data/science.jsonl",
    });
    rt.registerOutput({
      runtimePath: "payment.jsonl",
      diskPath: "/data/payment.jsonl",
    });
    rt.status.set("draining");

    await rt.scheduler.tickOnce();
    expect(sent[0].save.path).toBe("science.jsonl");
    // One of two files acked; the other is still dirty. Stay draining.
    expect(rt.status.current()).toBe("draining");

    await rt.scheduler.tickOnce();
    expect(sent[1].save.path).toBe("payment.jsonl");
    // Both files acked now → advance.
    expect(rt.status.current()).toBe("complete");
  });

  test("draining + 0 dirty files (no-save heartbeat): advances on the heartbeat ack", async () => {
    // Edge: closeBatch may have already drained everything before the
    // first draining tick. The runtime should still complete the chain
    // — a draining heartbeat (no save) with nothing dirty should
    // advance to complete on ack rather than hang.
    setEnv(managerEnv());
    const fsImpl = makeMockFs();
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
    const rt = initManagerRuntime({ fetchImpl, fsImpl });
    rt.status.set("draining");

    await rt.scheduler.tickOnce();
    expect(sent[0].status).toBe("draining");
    expect(sent[0].save).toBeUndefined();
    expect(rt.status.current()).toBe("complete");
  });

  test("running + dirty file: stays running after ack (no spurious advance)", async () => {
    // Defensive: the advance is gated on currentStatus === "draining".
    // A running runtime should never accidentally jump to complete.
    setEnv(managerEnv());
    const fsImpl = makeMockFs({ "/data/science.jsonl": '{"row":1}\n' });
    const fetchImpl = (_url, opts) => {
      const payload = JSON.parse(opts.body);
      return Promise.resolve({
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, ackedSequence: payload.sequence }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    const rt = initManagerRuntime({ fetchImpl, fsImpl });
    rt.registerOutput({
      runtimePath: "science.jsonl",
      diskPath: "/data/science.jsonl",
    });

    await rt.scheduler.tickOnce();
    expect(rt.status.current()).toBe("running");
  });

  test("running + 0 dirty files (heartbeat): stays running", async () => {
    setEnv(managerEnv());
    const fetchImpl = (_url, opts) => {
      const payload = JSON.parse(opts.body);
      return Promise.resolve({
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, ackedSequence: payload.sequence }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    const rt = initManagerRuntime({ fetchImpl });

    await rt.scheduler.tickOnce();
    expect(rt.status.current()).toBe("running");
  });

  test("re-ticking after complete is a no-op: status stays complete, scheduler stops", async () => {
    // After the runtime advances to complete and the manager acks the
    // complete tick, scheduler.stop() fires (existing logic). This
    // test guards against a regression where a residual call into the
    // tick path tries to advance state again — `complete` is terminal
    // in TickStatus.TRANSITIONS, so any further status.set would throw.
    setEnv(managerEnv());
    const fsImpl = makeMockFs();
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
    const rt = initManagerRuntime({ fetchImpl, fsImpl });
    rt.status.set("draining");

    // Tick 1: advances draining → complete.
    await rt.scheduler.tickOnce();
    expect(rt.status.current()).toBe("complete");

    // Tick 2: emits status=complete, scheduler stops on ack.
    await rt.scheduler.tickOnce();
    expect(sent[1].status).toBe("complete");
    expect(rt.status.current()).toBe("complete");
    expect(rt.scheduler.stopped).toBe(true);
  });

  test("complete tick fired by the post-advance burst lands within a macrotask (not 60s)", async () => {
    // dl#160 advances status mid-`acked`-branch BEFORE the post-flight
    // burst-scheduling check. So when there were dirty saves on the
    // last draining tick, the burst already fires (because payload.save
    // was set) and now sends the complete tick within a macrotask.
    // When there were NO dirty saves (heartbeat → advance), the burst
    // would otherwise be skipped (`payload.save` is null); we extend
    // the burst trigger to also fire on a status advance so the
    // manager learns about complete promptly.
    setEnv(managerEnv());
    const fsImpl = makeMockFs();
    const sent = [];
    const burstQueue = [];
    const setImmediateImpl = (cb) => {
      burstQueue.push(cb);
    };
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
    const rt = initManagerRuntime({ fetchImpl, fsImpl, setImmediateImpl });
    rt.status.set("draining");

    await rt.scheduler.tickOnce();
    // First tick: draining heartbeat (no save) → advances to complete
    // → burst scheduled even though payload.save was undefined.
    expect(sent[0].status).toBe("draining");
    expect(sent[0].save).toBeUndefined();
    expect(burstQueue).toHaveLength(1);
    expect(rt.status.current()).toBe("complete");

    // Drain the burst — second tick carries `complete` with no save.
    await burstQueue.shift()();
    expect(sent.length).toBe(2);
    expect(sent[1].status).toBe("complete");
    expect(sent[1].save).toBeUndefined();
    // Acked complete tick stops the scheduler (existing behavior).
    expect(rt.scheduler.stopped).toBe(true);
  });

  test("saves-acked probe throws (non-ENOENT fs error): does NOT advance + ack handling continues normally", async () => {
    // Copilot review on #161: `pickEligibleSave` rethrows non-ENOENT
    // filesystem errors (EACCES, etc.). We're inside the `acked`
    // branch — the manager already ack'd — so an uncaught throw would
    // skip sequence advance + stop-on-complete and leave the runtime
    // in a weird state. The try/catch downgrades to a warn-log, treats
    // the result as "more dirty work pending" (skip advance), and lets
    // the rest of the ack handling proceed.
    setEnv(managerEnv());
    let probeCallCount = 0;
    const fsImpl = {
      // Top-of-tick pickEligibleSave (call 1) returns null → heartbeat.
      // Saves-acked probe (call 2) throws EACCES.
      readFileSync() {
        probeCallCount += 1;
        if (probeCallCount === 2) {
          const err = new Error("EACCES: permission denied");
          err.code = "EACCES";
          throw err;
        }
        // First call: file exists; surface a benign content so the
        // top-of-tick save-pickup proceeds.
        return Buffer.from('{"row":1}\n');
      },
    };
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
    const warned = [];
    const logger = {
      warn: (obj, msg) => warned.push({ obj, msg }),
      info: () => {},
    };
    const rt = initManagerRuntime({ fetchImpl, fsImpl, logger });
    rt.registerOutput({
      runtimePath: "science.jsonl",
      diskPath: "/data/science.jsonl",
    });
    rt.status.set("draining");

    await rt.scheduler.tickOnce();

    // Sequence advanced normally despite the probe throw.
    expect(rt.getSequence()).toBe(1);
    // Status stays draining: the probe threw, so we treat it as
    // "more dirty work" and don't advance.
    expect(rt.status.current()).toBe("draining");
    // The throw was logged.
    const matched = warned.find((w) =>
      w.msg?.includes?.("saves-acked probe threw"),
    );
    expect(matched).toBeDefined();
    expect(matched.obj.errCode).toBe("EACCES");
  });

  test("status flipped to failed mid-tick: do NOT advance to complete (failed is terminal)", async () => {
    // reportTerminalError can flip TickStatus to `failed` between when
    // the tick captures `currentStatus` and when the ack lands. If we
    // blindly trusted the captured `currentStatus === "draining"` and
    // called status.set("complete"), tickStatus.mjs would throw
    // "Invalid transition: failed → complete". Defend with a live
    // status.current() === "draining" re-check.
    setEnv(managerEnv());
    const fsImpl = makeMockFs();
    const runtimeRef = {};
    let firstCall = true;
    const fetchImpl = (_url, opts) => {
      const payload = JSON.parse(opts.body);
      // Simulate a terminal-error firing while the in-flight HTTP is
      // pending: flip to failed before the ack-handling runs.
      if (firstCall) {
        firstCall = false;
        runtimeRef.status.set("failed");
      }
      return Promise.resolve({
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, ackedSequence: payload.sequence }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    const rt = initManagerRuntime({ fetchImpl, fsImpl });
    runtimeRef.status = rt.status;
    rt.status.set("draining");

    await expect(rt.scheduler.tickOnce()).resolves.toBeDefined();
    // Status stays `failed` (terminal); no thrown transition.
    expect(rt.status.current()).toBe("failed");
  });
});

describe("registerOutput (module-level export)", () => {
  test("module-level registerOutput is a no-op in solo-dev mode (no cached runtime)", () => {
    setEnv({}); // no USE_MANAGER_SAVE
    expect(() =>
      registerOutput({ runtimePath: "x.jsonl", diskPath: "/tmp/x.jsonl" }),
    ).not.toThrow();
  });

  test("module-level registerOutput throws when USE_MANAGER_SAVE=true but runtime wasn't initialized (bootstrap order bug)", () => {
    // The cutover (callbacks.js batch init) calls registerOutput
    // under manager mode; if `initManagerRuntime` was never called,
    // the call would silently no-op and the runtime would tick with
    // no save payloads — manager BL-14 verification would never
    // fire. Surface the bug loudly at the call site.
    setEnv({ USE_MANAGER_SAVE: "true" });
    // Note: do NOT call initManagerRuntime here — that's the bug
    // we're testing for.
    expect(() =>
      registerOutput({ runtimePath: "x.jsonl", diskPath: "/tmp/x.jsonl" }),
    ).toThrow(/manager runtime hasn't been initialized/);
  });

  test("module-level registerOutput delegates to the cached runtime under manager mode", () => {
    setEnv(managerEnv());
    const rt = initManagerRuntime({ fetchImpl: () => Promise.reject() });
    registerOutput({
      runtimePath: "science.jsonl",
      diskPath: "/data/science.jsonl",
    });
    expect(rt.outputs.has("science.jsonl")).toBe(true);
    expect(rt.outputs.get("science.jsonl").diskPath).toBe(
      "/data/science.jsonl",
    );
  });

  test("rejects a registration without runtimePath or diskPath", () => {
    setEnv(managerEnv());
    const rt = initManagerRuntime({ fetchImpl: () => Promise.reject() });
    expect(() => rt.registerOutput({ runtimePath: "x.jsonl" })).toThrow(
      /runtimePath and diskPath are required/,
    );
    expect(() => rt.registerOutput({ diskPath: "/tmp/x.jsonl" })).toThrow(
      /runtimePath and diskPath are required/,
    );
  });

  test("rejects an unsafe-relative runtimePath at registration time (mirrors tickSave schema)", () => {
    setEnv(managerEnv());
    const rt = initManagerRuntime({ fetchImpl: () => Promise.reject() });
    const unsafePaths = [
      "/leading-slash.jsonl",
      "../escaping.jsonl",
      "./current.jsonl",
      "foo/../bar.jsonl",
      "double//slash.jsonl",
    ];
    unsafePaths.forEach((p) => {
      expect(() =>
        rt.registerOutput({ runtimePath: p, diskPath: "/tmp/x.jsonl" }),
      ).toThrow(/safe-relative/);
    });
  });

  test("rejects a duplicate runtimePath registration", () => {
    setEnv(managerEnv());
    const rt = initManagerRuntime({ fetchImpl: () => Promise.reject() });
    rt.registerOutput({
      runtimePath: "science.jsonl",
      diskPath: "/data/a.jsonl",
    });
    expect(() =>
      rt.registerOutput({
        runtimePath: "science.jsonl",
        diskPath: "/data/b.jsonl",
      }),
    ).toThrow(/already registered/);
  });
});

describe("save lifecycle through onTick — discarded outcome", () => {
  test("a save accompanying a `discarded` tick does NOT record its hash", async () => {
    // The tick-response contract is "hashes advance only on ok:true"
    // (per ContentHashStore.recordAck JSDoc + manager ADR 0005).
    // Some `discarded` causes are transient (manager mid-deploy
    // returns non-JSON; a contract-version skew that gets fixed by
    // a redeploy); silently advancing the hash on `discarded` would
    // drop those saves on the floor.
    //
    // The trade-off: a *persistently* rejected save will re-emit
    // every tick until manual intervention. Sentry's per-tick
    // capture surfaces the loop for triage. A separate "rejected
    // hashes" mechanism for specific permanent-rejection codes is
    // the cleaner answer if this becomes a real problem.
    setEnv(managerEnv());
    const fsImpl = makeMockFs({ "/data/science.jsonl": '{"row":1}\n' });
    const fetchImpl = () =>
      Promise.resolve({
        status: 400,
        text: async () =>
          JSON.stringify({
            ok: false,
            retryable: false,
            code: "RUNTIME_PROTOCOL_VIOLATION",
            message: "save too large",
          }),
        headers: new Map([["content-type", "application/json"]]),
      });
    const captured = [];
    const sentryImpl = {
      captureMessage: (msg, opts) => captured.push({ msg, opts }),
    };
    const rt = initManagerRuntime({ fetchImpl, fsImpl, sentryImpl });
    rt.registerOutput({
      runtimePath: "science.jsonl",
      diskPath: "/data/science.jsonl",
    });

    await rt.scheduler.tickOnce();
    // Sentry captured the rejection (caller-actionable diagnostic).
    expect(captured).toHaveLength(1);
    // Hash NOT recorded — only `ok:true` advances per the contract.
    expect(rt.hashStore.lastAcked("science.jsonl")).toBeUndefined();
    // Sequence advances (manager treats discarded as terminal for
    // *this* tick; the runtime moves on).
    expect(rt.getSequence()).toBe(1);

    // Next tick: same content still dirty (no ack), so the save
    // re-rides under a fresh sequence. Manager rejects again,
    // Sentry captures again. The runtime keeps trying until the
    // file content changes (new participant data) OR manual
    // intervention fixes the misconfig.
    await rt.scheduler.tickOnce();
    expect(captured).toHaveLength(2);
    expect(rt.hashStore.lastAcked("science.jsonl")).toBeUndefined();
  });
});

// Sample tickError shape (mirrors `contracts/tick.mjs` `tickError`).
function sampleError(overrides = {}) {
  return {
    id: "err_001",
    kind: "platform-error",
    code: "EXAMPLE_FAILURE",
    message: "something went wrong",
    retryable: false,
    ...overrides,
  };
}

describe("reportError (module-level export)", () => {
  test("solo-dev mode: no-op (no cached runtime)", () => {
    setEnv({});
    expect(() => reportError(sampleError())).not.toThrow();
  });

  test("manager mode without initManagerRuntime: throws (bootstrap order bug)", () => {
    setEnv({ USE_MANAGER_SAVE: "true" });
    expect(() => reportError(sampleError())).toThrow(
      /manager runtime hasn't been initialized/,
    );
  });

  test("manager mode with cached runtime: pushes onto the queue", () => {
    setEnv(managerEnv());
    const rt = initManagerRuntime({ fetchImpl: () => Promise.reject() });
    reportError(sampleError({ id: "a" }));
    reportError(sampleError({ id: "b" }));
    expect(rt.getErrorQueue()).toEqual([
      sampleError({ id: "a" }),
      sampleError({ id: "b" }),
    ]);
  });
});

describe("error queue lifecycle through onTick", () => {
  test("errors are attached to the next tick's payload, then cleared on acked", async () => {
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
    rt.reportError(sampleError({ id: "err_a" }));
    rt.reportError(sampleError({ id: "err_b" }));

    await rt.scheduler.tickOnce();
    expect(sent[0].errors).toEqual([
      sampleError({ id: "err_a" }),
      sampleError({ id: "err_b" }),
    ]);
    // Acked: queue drained, second tick has no errors.
    expect(rt.getErrorQueue()).toEqual([]);

    await rt.scheduler.tickOnce();
    expect(sent[1].errors).toBeUndefined();
  });

  test("errors stay queued on retry (next tick re-emits)", async () => {
    setEnv(managerEnv());
    let firstCall = true;
    const fetchImpl = (_url, opts) => {
      const payload = JSON.parse(opts.body);
      if (firstCall) {
        firstCall = false;
        return Promise.resolve({
          status: 503,
          text: async () =>
            JSON.stringify({
              ok: false,
              retryable: true,
              code: "RATE_LIMITED",
            }),
          headers: new Map([["content-type", "application/json"]]),
        });
      }
      return Promise.resolve({
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, ackedSequence: payload.sequence }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    const rt = initManagerRuntime({ fetchImpl });
    rt.reportError(sampleError({ id: "err_x" }));

    await rt.scheduler.tickOnce();
    // Retry: queue stays.
    expect(rt.getErrorQueue()).toEqual([sampleError({ id: "err_x" })]);

    await rt.scheduler.tickOnce();
    // Acked: queue drained.
    expect(rt.getErrorQueue()).toEqual([]);
  });

  test("only the snapshot-set is cleared on acked (errors pushed mid-tick stay queued)", async () => {
    // If reportError is called between buildTickPayload and the
    // ack arriving, that new error didn't ride this tick — it must
    // stay queued for the next one. The implementation snapshots
    // by length and `splice(0, snapshotLen)` on ack, so mid-tick
    // pushes (which append after the snapshot) survive.
    setEnv(managerEnv());
    let inFlightResolved = false;
    const rt = initManagerRuntime({
      fetchImpl: async (_url, opts) => {
        const payload = JSON.parse(opts.body);
        // Mid-tick: push a new error before the ack lands.
        if (!inFlightResolved) {
          rt.reportError(sampleError({ id: "mid_tick" }));
          inFlightResolved = true;
        }
        return {
          status: 200,
          text: async () =>
            JSON.stringify({ ok: true, ackedSequence: payload.sequence }),
          headers: new Map([["content-type", "application/json"]]),
        };
      },
    });
    rt.reportError(sampleError({ id: "before_tick" }));

    await rt.scheduler.tickOnce();
    // before_tick rode the tick and was cleared; mid_tick was pushed
    // after the snapshot, so it survives.
    expect(rt.getErrorQueue()).toEqual([sampleError({ id: "mid_tick" })]);
  });

  test("rejects an invalid error shape at push time (vs at tick time)", async () => {
    // Validating at push time instead of inside tickPayload.parse
    // means a malformed entry never enters the queue — so a single
    // bad reportError call can't wedge every subsequent tick. The
    // call site that produced the bad shape gets the throw
    // immediately; ticking continues healthily.
    setEnv(managerEnv());
    const rt = initManagerRuntime({ fetchImpl: () => Promise.reject() });
    // Missing required fields (kind, code, message, retryable).
    expect(() => rt.reportError({ id: "bad" })).toThrow(
      /invalid tickError shape.*kind.*Required/,
    );
    // Bad entry never reached the queue.
    expect(rt.getErrorQueue()).toHaveLength(0);
  });

  test("a healthy reportError still works after a bad one was rejected", async () => {
    // Confirms the bad-entry rejection didn't poison the runtime —
    // a subsequent valid reportError + tick should succeed normally.
    setEnv(managerEnv());
    const fetchImpl = (_url, opts) => {
      const payload = JSON.parse(opts.body);
      return Promise.resolve({
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, ackedSequence: payload.sequence }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    const rt = initManagerRuntime({ fetchImpl });
    expect(() => rt.reportError({ id: "bad" })).toThrow();
    rt.reportError(sampleError({ id: "ok" }));
    await rt.scheduler.tickOnce();
    expect(rt.getErrorQueue()).toEqual([]);
  });

  test("duplicate-id entries: mid-tick push with a snapshot id survives the ack-clear", async () => {
    // The snapshot-by-length design (vs an id-Set filter) handles
    // this correctly: only the first N entries get cleared on ack;
    // an entry pushed mid-tick with the same id as a snapshot entry
    // stays in position N (the new tail) and survives.
    setEnv(managerEnv());
    let firstFetch = true;
    const rt = initManagerRuntime({
      fetchImpl: async (_url, opts) => {
        const payload = JSON.parse(opts.body);
        if (firstFetch) {
          firstFetch = false;
          // Mid-tick: push another error with the SAME id.
          rt.reportError(sampleError({ id: "shared_id", message: "mid-tick" }));
        }
        return {
          status: 200,
          text: async () =>
            JSON.stringify({ ok: true, ackedSequence: payload.sequence }),
          headers: new Map([["content-type", "application/json"]]),
        };
      },
    });
    rt.reportError(sampleError({ id: "shared_id", message: "before-tick" }));

    await rt.scheduler.tickOnce();
    // Snapshot drained (1 entry sent + 1 acked → cleared); mid-tick
    // push with the same id is still in the queue.
    expect(rt.getErrorQueue()).toHaveLength(1);
    expect(rt.getErrorQueue()[0].message).toBe("mid-tick");
  });

  test("queue growth cap: drops oldest at the cap and reports once via Sentry", async () => {
    setEnv(managerEnv());
    const captured = [];
    const sentryImpl = {
      captureMessage: (msg, opts) => captured.push({ msg, opts }),
    };
    const rt = initManagerRuntime({
      fetchImpl: () => Promise.reject(),
      sentryImpl,
    });
    // Push exactly cap (1000) errors — within cap, no shift.
    for (let i = 0; i < 1000; i += 1) {
      rt.reportError(sampleError({ id: `e_${i}` }));
    }
    expect(rt.getErrorQueue()).toHaveLength(1000);
    expect(captured).toHaveLength(0);

    // Push one more — drops oldest, reports once.
    rt.reportError(sampleError({ id: "e_overflow_1" }));
    expect(rt.getErrorQueue()).toHaveLength(1000);
    expect(rt.getErrorQueue()[0].id).toBe("e_1"); // e_0 was shifted
    expect(rt.getErrorQueue()[999].id).toBe("e_overflow_1");
    expect(captured).toHaveLength(1);
    expect(captured[0].msg).toMatch(/error queue exceeded cap/);

    // Push another over-cap — still drops oldest, but no second
    // Sentry capture (one-shot reporter).
    rt.reportError(sampleError({ id: "e_overflow_2" }));
    expect(rt.getErrorQueue()).toHaveLength(1000);
    expect(captured).toHaveLength(1);
  });
});

describe("post-flight burst (auto-tick after acked save)", () => {
  test("acked save schedules another tick on the next macrotask", async () => {
    setEnv(managerEnv());
    const fsImpl = makeMockFs({
      "/data/science.jsonl": '{"row":1}\n',
      "/data/payment.jsonl": '{"pay":1}\n',
    });
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
    // Synchronous setImmediate stub so the burst tick runs before
    // the test moves on. Tracks calls so we can assert exactly one
    // burst was scheduled per acked save.
    const burstQueue = [];
    const setImmediateImpl = (cb) => {
      burstQueue.push(cb);
    };
    const rt = initManagerRuntime({ fetchImpl, fsImpl, setImmediateImpl });
    rt.registerOutput({
      runtimePath: "scienceData.jsonl",
      diskPath: "/data/science.jsonl",
    });
    rt.registerOutput({
      runtimePath: "payment.jsonl",
      diskPath: "/data/payment.jsonl",
    });

    await rt.scheduler.tickOnce();
    // First tick acked science.jsonl → burst scheduled.
    expect(burstQueue).toHaveLength(1);
    expect(sent[0].save.path).toBe("scienceData.jsonl");

    // Run the burst — second tick picks up payment.jsonl.
    await burstQueue.shift()();
    expect(sent[1].save.path).toBe("payment.jsonl");
    // Second acked save → another burst scheduled.
    expect(burstQueue).toHaveLength(1);

    // Run the third tick — nothing dirty, no save, no burst.
    await burstQueue.shift()();
    expect(sent[2].save).toBeUndefined();
    expect(burstQueue).toHaveLength(0);
  });

  test("does not schedule a burst when no save was attached (heartbeat-only tick)", async () => {
    setEnv(managerEnv());
    const fetchImpl = (_url, opts) => {
      const payload = JSON.parse(opts.body);
      return Promise.resolve({
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, ackedSequence: payload.sequence }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    const burstQueue = [];
    const rt = initManagerRuntime({
      fetchImpl,
      setImmediateImpl: (cb) => burstQueue.push(cb),
    });
    // No registerOutput calls — payload has no save.

    await rt.scheduler.tickOnce();
    expect(burstQueue).toHaveLength(0);
  });

  test("burst callback bails out if scheduler.stop() ran between schedule and fire", async () => {
    // Race: an acked save schedules a burst on next macrotask, then
    // shutdown calls scheduler.stop(). Without the guard, the burst
    // would still fire `tickOnce()` and emit a POST during teardown.
    setEnv(managerEnv());
    const fsImpl = makeMockFs({ "/data/science.jsonl": '{"row":1}\n' });
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
    const burstQueue = [];
    const rt = initManagerRuntime({
      fetchImpl,
      fsImpl,
      setImmediateImpl: (cb) => burstQueue.push(cb),
    });
    rt.registerOutput({
      runtimePath: "scienceData.jsonl",
      diskPath: "/data/science.jsonl",
    });

    await rt.scheduler.tickOnce();
    expect(sent).toHaveLength(1);
    expect(burstQueue).toHaveLength(1);

    // Simulate shutdown between schedule and fire.
    rt.scheduler.stop();

    // Burst fires now — should be a no-op, no second POST.
    await burstQueue.shift()();
    expect(sent).toHaveLength(1);
  });

  test("does not schedule a burst if status flips to `failed` mid-tick", async () => {
    // The save-pickup decision uses a tick-construction snapshot for
    // self-consistency, but the burst-trigger is an event-after-the-
    // fact and respects the runtime's *current* intent. So a status
    // flip to `failed` during the in-flight HTTP roundtrip prevents
    // the post-flight burst even though the tick itself was sent
    // under the prior status.
    setEnv(managerEnv());
    const fsImpl = makeMockFs({ "/data/science.jsonl": '{"row":1}\n' });
    const burstQueue = [];
    let inFlightFlipped = false;
    const fetchImpl = async (_url, opts) => {
      const payload = JSON.parse(opts.body);
      if (!inFlightFlipped) {
        inFlightFlipped = true;
        // Mid-tick: caller transitions to failed.
        // eslint-disable-next-line no-use-before-define
        rt.status.set("failed");
      }
      return {
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, ackedSequence: payload.sequence }),
        headers: new Map([["content-type", "application/json"]]),
      };
    };
    const rt = initManagerRuntime({
      fetchImpl,
      fsImpl,
      setImmediateImpl: (cb) => burstQueue.push(cb),
    });
    rt.registerOutput({
      runtimePath: "scienceData.jsonl",
      diskPath: "/data/science.jsonl",
    });

    await rt.scheduler.tickOnce();
    // Tick was sent with the captured `running` status, save attached.
    // But by ack-time, status was `failed` — burst should NOT fire.
    expect(burstQueue).toHaveLength(0);
  });

  test("does not schedule a burst when status is `failed` (runtime shutting down)", async () => {
    setEnv(managerEnv());
    const fsImpl = makeMockFs({ "/data/science.jsonl": '{"row":1}\n' });
    const fetchImpl = (_url, opts) => {
      const payload = JSON.parse(opts.body);
      return Promise.resolve({
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, ackedSequence: payload.sequence }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    const burstQueue = [];
    const rt = initManagerRuntime({
      fetchImpl,
      fsImpl,
      setImmediateImpl: (cb) => burstQueue.push(cb),
    });
    rt.registerOutput({
      runtimePath: "scienceData.jsonl",
      diskPath: "/data/science.jsonl",
    });
    rt.status.set("failed");

    await rt.scheduler.tickOnce();
    expect(burstQueue).toHaveLength(0);
  });
});

describe("status: complete re-emit semantics", () => {
  test("acked complete tick stops the scheduler (terminal)", async () => {
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
    rt.status.set("complete");

    expect(rt.scheduler.stopped).toBe(false);
    await rt.scheduler.tickOnce();
    expect(sent[0].status).toBe("complete");
    expect(rt.scheduler.stopped).toBe(true);
  });

  test("retried complete tick keeps the scheduler running until acked", async () => {
    setEnv(managerEnv());
    const sent = [];
    let firstCall = true;
    const fetchImpl = (_url, opts) => {
      const payload = JSON.parse(opts.body);
      sent.push(payload);
      if (firstCall) {
        firstCall = false;
        return Promise.resolve({
          status: 503,
          text: async () =>
            JSON.stringify({
              ok: false,
              retryable: true,
              code: "RATE_LIMITED",
            }),
          headers: new Map([["content-type", "application/json"]]),
        });
      }
      return Promise.resolve({
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, ackedSequence: payload.sequence }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    const rt = initManagerRuntime({ fetchImpl });
    rt.status.set("complete");

    await rt.scheduler.tickOnce();
    // First attempt 503'd; scheduler still running so the next
    // cadence re-emits.
    expect(sent[0].status).toBe("complete");
    expect(rt.scheduler.stopped).toBe(false);

    await rt.scheduler.tickOnce();
    // Second attempt acked — terminal.
    expect(sent[1].status).toBe("complete");
    expect(rt.scheduler.stopped).toBe(true);
  });

  test("complete tick carries no save (drops + Sentry-warns if a file is dirty)", async () => {
    setEnv(managerEnv());
    // Simulate a contract violation: the caller transitioned to
    // 'complete' while a file was still dirty. The runtime drops
    // the save (rather than emitting complete-with-save and getting
    // rejected by the manager forever) and captures via Sentry so
    // the bug is surfaced.
    const fsImpl = makeMockFs({ "/data/science.jsonl": '{"row":1}\n' });
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
    const captured = [];
    const sentryImpl = {
      captureMessage: (msg, opts) => captured.push({ msg, opts }),
    };
    const rt = initManagerRuntime({ fetchImpl, fsImpl, sentryImpl });
    rt.registerOutput({
      runtimePath: "scienceData.jsonl",
      diskPath: "/data/science.jsonl",
    });
    // File is dirty (never acked); caller incorrectly marks complete.
    rt.status.set("complete");

    await rt.scheduler.tickOnce();
    expect(sent[0].status).toBe("complete");
    expect(sent[0].save).toBeUndefined();
    // Sentry captured the contract violation.
    expect(captured).toHaveLength(1);
    expect(captured[0].msg).toMatch(/pending save dropped on 'complete' tick/);
  });

  test("complete tick with all files clean carries no save and no Sentry warning", async () => {
    // Happy path: caller drained all saves before transitioning to
    // complete. The runtime emits a clean complete tick.
    setEnv(managerEnv());
    const fsImpl = makeMockFs({ "/data/science.jsonl": '{"row":1}\n' });
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
    const captured = [];
    const sentryImpl = {
      captureMessage: (msg, opts) => captured.push({ msg, opts }),
    };
    const rt = initManagerRuntime({ fetchImpl, fsImpl, sentryImpl });
    rt.registerOutput({
      runtimePath: "scienceData.jsonl",
      diskPath: "/data/science.jsonl",
    });
    // Pre-mark the file as already-acked so it's not dirty.
    rt.hashStore.recordAck(
      "scienceData.jsonl",
      ContentHashStore.hashContent('{"row":1}\n'),
    );
    rt.status.set("complete");

    await rt.scheduler.tickOnce();
    expect(sent[0].status).toBe("complete");
    expect(sent[0].save).toBeUndefined();
    expect(captured).toHaveLength(0);
    expect(rt.scheduler.stopped).toBe(true);
  });

  test("Sentry capture is one-shot across retries: dirty-on-complete warns once even on repeated NACK", async () => {
    // Direct test of the one-shot semantics: NACK the first complete
    // tick (retryable) so the scheduler keeps running, then ack the
    // second. Both ticks see a dirty file but we should only Sentry-
    // warn once.
    setEnv(managerEnv());
    const fsImpl = makeMockFs({ "/data/science.jsonl": '{"row":1}\n' });
    let firstCall = true;
    const fetchImpl = (_url, opts) => {
      const payload = JSON.parse(opts.body);
      if (firstCall) {
        firstCall = false;
        return Promise.resolve({
          status: 503,
          text: async () =>
            JSON.stringify({
              ok: false,
              retryable: true,
              code: "RATE_LIMITED",
            }),
          headers: new Map([["content-type", "application/json"]]),
        });
      }
      return Promise.resolve({
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, ackedSequence: payload.sequence }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    const captured = [];
    const sentryImpl = {
      captureMessage: (msg, opts) => captured.push({ msg, opts }),
    };
    const rt = initManagerRuntime({ fetchImpl, fsImpl, sentryImpl });
    rt.registerOutput({
      runtimePath: "scienceData.jsonl",
      diskPath: "/data/science.jsonl",
    });
    rt.status.set("complete");

    await rt.scheduler.tickOnce();
    expect(captured).toHaveLength(1);
    // Second attempt, same dirty state — should NOT warn again.
    await rt.scheduler.tickOnce();
    expect(captured).toHaveLength(1);
  });

  test("status flips from running to complete mid-tick: in-flight tick keeps running status, next tick emits complete", async () => {
    // The currentStatus snapshot at the top of onTick guarantees the
    // tick that's currently being constructed agrees with itself.
    // A status transition firing during the in-flight HTTP roundtrip
    // doesn't retroactively turn it into a complete tick.
    setEnv(managerEnv());
    const sent = [];
    let inFlightFlipped = false;
    const fetchImpl = async (_url, opts) => {
      const payload = JSON.parse(opts.body);
      sent.push(payload);
      if (!inFlightFlipped) {
        inFlightFlipped = true;
        // Mid-tick: caller transitions to complete.
        // (Reference is captured via a closure-mutated variable below.)
        // eslint-disable-next-line no-use-before-define
        rt.status.set("complete");
      }
      return {
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, ackedSequence: payload.sequence }),
        headers: new Map([["content-type", "application/json"]]),
      };
    };
    const rt = initManagerRuntime({ fetchImpl });

    await rt.scheduler.tickOnce();
    // First tick captured `running` at construction; the mid-tick
    // flip to complete didn't retroactively change payload.status.
    expect(sent[0].status).toBe("running");
    // Acked running → scheduler still running.
    expect(rt.scheduler.stopped).toBe(false);

    // Next tick now sees complete.
    await rt.scheduler.tickOnce();
    expect(sent[1].status).toBe("complete");
    expect(rt.scheduler.stopped).toBe(true);
  });

  test("does not stop on a non-complete acked tick (running, draining, failed don't terminate)", async () => {
    setEnv(managerEnv());
    // Register dirty files before the draining tick so dl#160's
    // saves-acked → complete advance doesn't fire and prematurely
    // turn this test's draining tick into a complete tick. Three
    // dirty files in registration order: tick 1 (running) acks a;
    // tick 2 (draining) acks b but c stays dirty → stay draining;
    // tick 3 (failed, manually flipped below) sails past — failed
    // can co-exist with dirty files.
    const fsImpl = makeMockFs({
      "/data/a.jsonl": '{"a":1}\n',
      "/data/b.jsonl": '{"b":1}\n',
      "/data/c.jsonl": '{"c":1}\n',
    });
    const fetchImpl = (_url, opts) => {
      const payload = JSON.parse(opts.body);
      return Promise.resolve({
        status: 200,
        text: async () =>
          JSON.stringify({ ok: true, ackedSequence: payload.sequence }),
        headers: new Map([["content-type", "application/json"]]),
      });
    };
    // Suppress the post-flight burst so this test only drives ticks
    // explicitly via tickOnce() — the burst would synchronously fire
    // another tick and could re-enter the `acked` branch under a
    // different status than the assertion expects.
    const rt = initManagerRuntime({
      fetchImpl,
      fsImpl,
      setImmediateImpl: () => {},
    });
    rt.registerOutput({ runtimePath: "a.jsonl", diskPath: "/data/a.jsonl" });
    rt.registerOutput({ runtimePath: "b.jsonl", diskPath: "/data/b.jsonl" });
    rt.registerOutput({ runtimePath: "c.jsonl", diskPath: "/data/c.jsonl" });

    // status starts at 'running'; ack shouldn't stop the scheduler.
    await rt.scheduler.tickOnce();
    expect(rt.scheduler.stopped).toBe(false);

    rt.status.set("draining");
    await rt.scheduler.tickOnce();
    expect(rt.scheduler.stopped).toBe(false);
    // Still draining: b.jsonl is dirty, so the saves-acked check
    // returns non-null and we do not advance.
    expect(rt.status.current()).toBe("draining");

    rt.status.set("failed");
    await rt.scheduler.tickOnce();
    expect(rt.scheduler.stopped).toBe(false);
  });
});
