import crypto from "node:crypto";
import { describe, test, expect, beforeEach } from "vitest";
import {
  isManagerLaunched,
  initManagerRuntime,
  buildTickPayload,
  pickEligibleSave,
  registerOutput,
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

describe("registerOutput (module-level export)", () => {
  test("module-level registerOutput is a no-op in solo-dev mode (no cached runtime)", () => {
    setEnv({}); // no USE_MANAGER_SAVE
    expect(() =>
      registerOutput({ runtimePath: "x.jsonl", diskPath: "/tmp/x.jsonl" }),
    ).not.toThrow();
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
