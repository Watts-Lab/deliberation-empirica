import { describe, test, expect, vi } from "vitest";
import { TickClient } from "./tickClient.mjs";

const validPayload = () => ({
  sequence: 0,
  status: "running",
  state: { participants: { count: 0 } },
});

function fakeFetch({ status, body, contentType = "application/json" }) {
  return vi.fn(async () => ({
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    headers: new Map([["content-type", contentType]]),
  }));
}

describe("TickClient.constructor", () => {
  test("requires managerUrl, instanceId, instanceToken", () => {
    expect(
      () => new TickClient({ instanceId: "i", instanceToken: "t" }),
    ).toThrow(/managerUrl/);
    expect(
      () => new TickClient({ managerUrl: "u", instanceToken: "t" }),
    ).toThrow(/instanceId/);
    expect(() => new TickClient({ managerUrl: "u", instanceId: "i" })).toThrow(
      /instanceToken/,
    );
  });

  test("strips trailing slashes from managerUrl when building the endpoint", () => {
    const fetchImpl = fakeFetch({
      status: 200,
      body: { ok: true, ackedSequence: 0 },
    });
    const c = new TickClient({
      managerUrl: "https://m.example//",
      instanceId: "i-1",
      instanceToken: "t",
      fetchImpl,
    });
    return c.send(validPayload()).then(() => {
      expect(fetchImpl.mock.calls[0][0]).toBe(
        "https://m.example/api/instances/i-1/tick",
      );
    });
  });
});

describe("TickClient.send", () => {
  test("acked: ok=true response", async () => {
    const fetchImpl = fakeFetch({
      status: 200,
      body: { ok: true, ackedSequence: 5, commitSha: "abc123" },
    });
    const c = new TickClient({
      managerUrl: "https://m.example",
      instanceId: "i",
      instanceToken: "t",
      fetchImpl,
    });
    const result = await c.send({ ...validPayload(), sequence: 5 });
    expect(result).toMatchObject({
      outcome: "acked",
      ackedSequence: 5,
      commitSha: "abc123",
      sequence: 5,
      httpStatus: 200,
    });
  });

  test("retry: ok=false retryable=true", async () => {
    const fetchImpl = fakeFetch({
      status: 503,
      body: {
        ok: false,
        retryable: true,
        code: "RATE_LIMITED",
        message: "try later",
      },
    });
    const c = new TickClient({
      managerUrl: "https://m.example",
      instanceId: "i",
      instanceToken: "t",
      fetchImpl,
    });
    const result = await c.send(validPayload());
    expect(result).toMatchObject({
      outcome: "retry",
      code: "RATE_LIMITED",
      message: "try later",
      httpStatus: 503,
    });
  });

  test("discarded: ok=false retryable=false", async () => {
    const fetchImpl = fakeFetch({
      status: 400,
      body: {
        ok: false,
        retryable: false,
        code: "RUNTIME_PROTOCOL_VIOLATION_PREMATURE_COMPLETE",
      },
    });
    const c = new TickClient({
      managerUrl: "https://m.example",
      instanceId: "i",
      instanceToken: "t",
      fetchImpl,
    });
    const result = await c.send(validPayload());
    expect(result).toMatchObject({
      outcome: "discarded",
      code: "RUNTIME_PROTOCOL_VIOLATION_PREMATURE_COMPLETE",
      retryable: false,
      httpStatus: 400,
    });
  });

  test("fetch-failed: transport error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const c = new TickClient({
      managerUrl: "https://m.example",
      instanceId: "i",
      instanceToken: "t",
      fetchImpl,
    });
    const result = await c.send(validPayload());
    expect(result).toMatchObject({
      outcome: "fetch-failed",
      error: "ECONNREFUSED",
    });
  });

  test("fetch-failed: tolerates a non-Error throw (null/undefined/string)", async () => {
    const c = new TickClient({
      managerUrl: "https://m.example",
      instanceId: "i",
      instanceToken: "t",
      fetchImpl: vi.fn(async () => {
        // eslint-disable-next-line no-throw-literal
        throw null;
      }),
    });
    const result = await c.send(validPayload());
    expect(result.outcome).toBe("fetch-failed");
    // err.message is undefined on null; String(null) is "null".
    expect(result.error).toBe("null");
  });

  test("non-JSON response: discarded with synthetic code", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 502,
      text: async () => "<html>Bad Gateway</html>",
      headers: new Map([["content-type", "text/html"]]),
    }));
    const c = new TickClient({
      managerUrl: "https://m.example",
      instanceId: "i",
      instanceToken: "t",
      fetchImpl,
    });
    const result = await c.send(validPayload());
    expect(result).toMatchObject({
      outcome: "discarded",
      code: "http-502-non-json",
      retryable: false,
    });
  });

  test("response failing the contract schema is discarded with INVALID_TICK_RESPONSE", async () => {
    const fetchImpl = fakeFetch({
      status: 200,
      body: { ok: "yes" }, // wrong shape — discriminant must be boolean literal
    });
    const c = new TickClient({
      managerUrl: "https://m.example",
      instanceId: "i",
      instanceToken: "t",
      fetchImpl,
    });
    const result = await c.send(validPayload());
    expect(result).toMatchObject({
      outcome: "discarded",
      code: "INVALID_TICK_RESPONSE",
      retryable: false,
    });
    expect(result.validationIssues).toBeTruthy();
  });

  test("sends Authorization: Bearer header with the per-Instance token", async () => {
    const fetchImpl = fakeFetch({
      status: 200,
      body: { ok: true, ackedSequence: 0 },
    });
    const c = new TickClient({
      managerUrl: "https://m.example",
      instanceId: "i",
      instanceToken: "the-token",
      fetchImpl,
    });
    await c.send(validPayload());
    const opts = fetchImpl.mock.calls[0][1];
    expect(opts.headers.authorization).toBe("Bearer the-token");
    expect(opts.method).toBe("POST");
    expect(opts.headers["content-type"]).toBe("application/json");
  });
});
