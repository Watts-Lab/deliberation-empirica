import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { buildManagerMock } from "./index.mjs";

// Build a JWT-shaped string with a custom claim payload. Header
// and signature are placeholders — the harness's default
// `jwtVerify: "decode-only"` doesn't verify signatures (matches
// what the runtime's own boot path does pre-manager#139).
function makeToken(claims) {
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${body}.sig`;
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

const validTickPayload = (overrides = {}) => ({
  sequence: 0,
  status: "running",
  state: { participants: { count: 0 } },
  ...overrides,
});

let mock;

beforeEach(async () => {
  mock = buildManagerMock({});
  await mock.start();
});

afterEach(async () => {
  await mock.stop();
});

async function postTick(token, payload, instanceId = "i-test") {
  return fetch(`${mock.url}/api/instances/${instanceId}/tick`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

describe("manager-mock — happy path", () => {
  test("default response is ack with ackedSequence echoing the sent sequence", async () => {
    const token = makeToken(validClaims());
    const res = await postTick(token, validTickPayload({ sequence: 7 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, ackedSequence: 7 });
  });

  test("records ticks in the order they arrive", async () => {
    const token = makeToken(validClaims());
    await postTick(token, validTickPayload({ sequence: 0 }));
    await postTick(token, validTickPayload({ sequence: 1 }));
    await postTick(token, validTickPayload({ sequence: 2 }));
    const ticks = mock.received();
    expect(ticks).toHaveLength(3);
    expect(ticks.map((t) => t.payload.sequence)).toEqual([0, 1, 2]);
  });

  test("scripted enqueueRetry returns retryable failure", async () => {
    mock.enqueueRetry({ code: "RATE_LIMITED" });
    const token = makeToken(validClaims());
    const res = await postTick(token, validTickPayload());
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      ok: false,
      retryable: true,
      code: "RATE_LIMITED",
    });
  });

  test("scripted enqueueDiscard returns non-retryable failure", async () => {
    mock.enqueueDiscard({ code: "RUNTIME_PROTOCOL_VIOLATION" });
    const token = makeToken(validClaims());
    const res = await postTick(token, validTickPayload());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      ok: false,
      retryable: false,
      code: "RUNTIME_PROTOCOL_VIOLATION",
    });
  });

  test("scripted responses replay in FIFO order; after exhausted, default kicks in", async () => {
    mock.enqueueRetry({ code: "FIRST" });
    mock.enqueueAck({ ackedSequence: 99, commitSha: "deadbeef" });
    const token = makeToken(validClaims());

    const r1 = await postTick(token, validTickPayload({ sequence: 0 }));
    expect((await r1.json()).code).toBe("FIRST");

    const r2 = await postTick(token, validTickPayload({ sequence: 1 }));
    expect(await r2.json()).toEqual({
      ok: true,
      ackedSequence: 99,
      commitSha: "deadbeef",
    });

    const r3 = await postTick(token, validTickPayload({ sequence: 2 }));
    expect(await r3.json()).toEqual({ ok: true, ackedSequence: 2 });
  });
});

describe("manager-mock — JWT validation", () => {
  test("401 when Authorization header is missing", async () => {
    const res = await fetch(`${mock.url}/api/instances/i-test/tick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validTickPayload()),
    });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("MISSING_AUTHORIZATION");
  });

  test("401 when JWT is malformed", async () => {
    const res = await postTick("not-a-jwt", validTickPayload());
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("INVALID_JWT");
  });

  test("401 when the JWT's instance_id doesn't match the path's :id", async () => {
    const token = makeToken(validClaims({ instance_id: "i-other" }));
    const res = await postTick(token, validTickPayload(), "i-test");
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("PATH_TOKEN_MISMATCH");
  });

  test("`jwtVerify: skip` accepts any non-empty token", async () => {
    await mock.stop();
    mock = buildManagerMock({ jwtVerify: "skip" });
    await mock.start();
    const res = await postTick("anything", validTickPayload());
    expect(res.status).toBe(200);
  });
});

describe("manager-mock — payload validation", () => {
  test("422 when payload fails the contract schema", async () => {
    const token = makeToken(validClaims());
    const res = await postTick(token, {
      sequence: -1, // negative — schema rejects
      status: "running",
    });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("INVALID_TICK_PAYLOAD");
  });

  test("422 on unknown status enum value", async () => {
    const token = makeToken(validClaims());
    const res = await postTick(token, {
      sequence: 0,
      status: "sealed", // not a runtime-reportable status
    });
    expect(res.status).toBe(422);
  });

  test("400 on non-JSON body", async () => {
    const token = makeToken(validClaims());
    const res = await fetch(`${mock.url}/api/instances/i-test/tick`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });
});

describe("manager-mock — control surface", () => {
  test("GET /control/received returns captured ticks", async () => {
    const token = makeToken(validClaims());
    await postTick(token, validTickPayload({ sequence: 5 }));
    const res = await fetch(`${mock.url}/control/received`);
    const body = await res.json();
    expect(body.ticks).toHaveLength(1);
    expect(body.ticks[0].payload.sequence).toBe(5);
  });

  test("POST /control/reset clears state", async () => {
    const token = makeToken(validClaims());
    await postTick(token, validTickPayload({ sequence: 0 }));
    await postTick(token, validTickPayload({ sequence: 1 }));
    expect(mock.received()).toHaveLength(2);
    await fetch(`${mock.url}/control/reset`, { method: "POST" });
    expect(mock.received()).toHaveLength(0);
  });

  test("POST /control/enqueueRetry queues a retry response", async () => {
    await fetch(`${mock.url}/control/enqueueRetry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "OVER_HTTP" }),
    });
    const token = makeToken(validClaims());
    const res = await postTick(token, validTickPayload());
    expect((await res.json()).code).toBe("OVER_HTTP");
  });
});

describe("manager-mock — control-endpoint strictness", () => {
  test("POST /control/enqueueAck rejects malformed JSON with 400", async () => {
    const res = await fetch(`${mock.url}/control/enqueueAck`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_JSON");
  });

  test("POST /control/enqueueAck rejects missing ackedSequence with 400", async () => {
    const res = await fetch(`${mock.url}/control/enqueueAck`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ commitSha: "abc" }), // no ackedSequence
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_ACK");
  });

  test("POST /control/enqueueRetry rejects malformed JSON with 400", async () => {
    const res = await fetch(`${mock.url}/control/enqueueRetry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ malformed",
    });
    expect(res.status).toBe(400);
  });
});

describe("manager-mock — decode-only mode validates claims", () => {
  test("rejects a token missing required claims (vs the prior decode-only-just-parses behavior)", async () => {
    // Header + signature placeholder; payload missing instance_id.
    const headerSeg = Buffer.from(
      JSON.stringify({ alg: "RS256", typ: "JWT" }),
    ).toString("base64url");
    const payloadSeg = Buffer.from(
      JSON.stringify({
        // no instance_id
        batch_id: "b",
        study_id: "s",
        workspace_id: "w",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: "manager",
        scope: "tick",
      }),
    ).toString("base64url");
    const token = `${headerSeg}.${payloadSeg}.sig`;
    const res = await postTick(token, validTickPayload());
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("INVALID_JWT");
  });

  test("rejects an expired token (decode-only enforces exp)", async () => {
    const expired = validClaims({
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    const token = makeToken(expired);
    const res = await postTick(token, validTickPayload());
    expect(res.status).toBe(401);
  });
});

describe("manager-mock — defensive copies", () => {
  test("mutating a returned tick doesn't corrupt the harness's log", async () => {
    const token = makeToken(validClaims());
    await postTick(token, validTickPayload({ sequence: 0 }));
    const a = mock.received();
    a[0].payload.sequence = 999;
    const b = mock.received();
    expect(b[0].payload.sequence).toBe(0);
  });
});

describe("manager-mock — 404 for unrecognized paths", () => {
  test("returns 404 for a path the harness doesn't handle", async () => {
    const res = await fetch(`${mock.url}/nonsense`);
    expect(res.status).toBe(404);
  });
});

// HS256 signature verification path — exercises the harness's
// `jwtVerify: "hs256"` mode end-to-end. Mirrors what the runtime
// will do once deliberation-lab#109 lands.
describe("manager-mock — JWT HS256 mode", () => {
  function mintHs256({ payload, secret }) {
    const headerSeg = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT", kid: "v1" }),
    ).toString("base64url");
    const payloadSeg = Buffer.from(JSON.stringify(payload)).toString(
      "base64url",
    );
    const sig = createHmac("sha256", secret)
      .update(`${headerSeg}.${payloadSeg}`)
      .digest("base64url");
    return `${headerSeg}.${payloadSeg}.${sig}`;
  }

  test("requires `secret` when jwtVerify is hs256", () => {
    expect(() => buildManagerMock({ jwtVerify: "hs256" })).toThrow(
      /requires `secret`/,
    );
  });

  test("verifies a token signed under the matching secret", async () => {
    await mock.stop();
    const secret = randomBytes(32);
    mock = buildManagerMock({ jwtVerify: "hs256", secret });
    await mock.start();
    const token = mintHs256({ payload: validClaims(), secret });
    const res = await postTick(token, validTickPayload());
    expect(res.status).toBe(200);
  });

  test("rejects a token signed under a different secret", async () => {
    await mock.stop();
    const harnessSecret = randomBytes(32);
    const attackerSecret = randomBytes(32);
    mock = buildManagerMock({ jwtVerify: "hs256", secret: harnessSecret });
    await mock.start();
    const token = mintHs256({ payload: validClaims(), secret: attackerSecret });
    const res = await postTick(token, validTickPayload());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("INVALID_JWT");
    expect(body.message).toMatch(/signature mismatch/);
  });

  test("rejects alg=none (algorithm confusion defense)", async () => {
    await mock.stop();
    const secret = randomBytes(32);
    mock = buildManagerMock({ jwtVerify: "hs256", secret });
    await mock.start();
    const headerSeg = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    const payloadSeg = Buffer.from(JSON.stringify(validClaims())).toString(
      "base64url",
    );
    const token = `${headerSeg}.${payloadSeg}.`;
    const res = await postTick(token, validTickPayload());
    expect(res.status).toBe(401);
    expect((await res.json()).message).toMatch(
      /alg "none" not supported|unsupported JWT alg/,
    );
  });
});
