import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Mock axios *before* importing the SUT so the import binding sees the mock.
// `createEtherpad` / `getEtherpadText` read process.env at call time, so we
// mutate keys in beforeEach rather than at module-eval time. Mirrors the
// dailyco / qualtrics provider tests.
vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

// Stub @empirica/core/console so the SUT's info / warn / error calls don't
// pollute test output and so we can assert on the warn / error branches.
vi.mock("@empirica/core/console", () => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

// eslint-disable-next-line import/first
import axios from "axios";
// eslint-disable-next-line import/first
import { error, warn, info } from "@empirica/core/console";
// eslint-disable-next-line import/first
import { createEtherpad, getEtherpadText } from "./etherpad";

// `etherpad.js` keeps a module-level `etherpadList` Map that persists for the
// life of the test process. Each test below uses a unique `padId` so that
// previously-cached pads from earlier tests don't silently short-circuit a
// fresh call. Don't reuse padIds across tests in this file.
//
// Snapshot/restore env via key-level mutation rather than reassigning
// `process.env` (matches the repo pattern in qualtrics.test.js / dailyco.test.js).
let envSnapshot;

beforeEach(() => {
  vi.resetAllMocks();
  envSnapshot = { ...process.env };
  process.env.ETHERPAD_BASE_URL = "http://127.0.0.1:9091/etherpad";
  process.env.ETHERPAD_API_KEY = "test-key";
});

afterEach(() => {
  Object.keys(process.env).forEach((key) => {
    delete process.env[key];
  });
  Object.assign(process.env, envSnapshot);
});

// Etherpad's HTTP API envelope: { code, message, data } — code 0 = ok,
// code 1 = wrong parameters (used for both "already exists" and
// "does not exist", differentiated by `message`). Mirrors the canned
// response shapes used by playwright/e2e/_helpers/mockExternalServer.mjs
// (ETHERPAD_PATH_PATTERNS, added in #69).
const okCreateResponse = { data: { code: 0, message: "ok", data: null } };
const alreadyExistsResponse = {
  data: { code: 1, message: "padID does already exist", data: null },
};

describe("createEtherpad — success path", () => {
  test("returns the pad URL and caches it for subsequent calls", async () => {
    axios.get.mockResolvedValueOnce(okCreateResponse);

    const padUrl = await createEtherpad({
      padId: "pad-success-1",
      defaultText: "Hello world",
    });

    expect(padUrl).toBe("http://127.0.0.1:9091/etherpad/p/pad-success-1");
    expect(axios.get).toHaveBeenCalledTimes(1);
    const createUrl = axios.get.mock.calls[0][0];
    expect(createUrl).toContain("/api/1/createPad");
    expect(createUrl).toContain("apikey=test-key");
    expect(createUrl).toContain("padID=pad-success-1");
    // URLSearchParams encodes spaces as `+`, not `%20`.
    expect(createUrl).toContain("text=Hello+world");
    // `info` fires only on the success-and-cache branch (etherpad.js line 28),
    // so this asserts we actually populated the etherpadList Map.
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toContain("Created new etherpad");
  });
});

describe("createEtherpad — idempotency", () => {
  test("second call with the same padId short-circuits via the in-memory cache", async () => {
    axios.get.mockResolvedValueOnce(okCreateResponse);

    const first = await createEtherpad({
      padId: "pad-idem-1",
      defaultText: "first",
    });
    const second = await createEtherpad({
      padId: "pad-idem-1",
      defaultText: "second-ignored",
    });

    expect(first).toBe(second);
    expect(first).toBe("http://127.0.0.1:9091/etherpad/p/pad-idem-1");
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});

describe("createEtherpad — 'padID does already exist'", () => {
  test("warns and returns the pad URL anyway (does not cache)", async () => {
    axios.get.mockResolvedValueOnce(alreadyExistsResponse);

    const padUrl = await createEtherpad({
      padId: "pad-exists-1",
      defaultText: "anything",
    });

    expect(padUrl).toBe("http://127.0.0.1:9091/etherpad/p/pad-exists-1");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("pad-exists-1");
    expect(warn.mock.calls[0][0]).toContain("already exists");
  });
});

describe("createEtherpad — axios rejection", () => {
  test("logs an error and returns undefined", async () => {
    const boom = new Error("ECONNREFUSED");
    axios.get.mockRejectedValueOnce(boom);

    const padUrl = await createEtherpad({
      padId: "pad-error-1",
      defaultText: "x",
    });

    expect(padUrl).toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toMatch(/Error creating pad pad-error-1/);
    expect(error.mock.calls[0][1]).toBe(boom);
  });
});

describe("getEtherpadText — success", () => {
  test("returns the pad text from response.data.data.text", async () => {
    axios.get.mockResolvedValueOnce({
      data: { code: 0, message: "ok", data: { text: "current pad text" } },
    });

    const text = await getEtherpadText({ padId: "pad-read-1" });

    expect(text).toBe("current pad text");
    expect(axios.get).toHaveBeenCalledTimes(1);
    const calledURL = axios.get.mock.calls[0][0];
    expect(calledURL).toContain("/api/1/getText");
    expect(calledURL).toContain("apikey=test-key");
    expect(calledURL).toContain("padID=pad-read-1");
  });
});

describe("getEtherpadText — non-zero status code", () => {
  test("logs an error with the response payload", async () => {
    // Real Etherpad behavior for code 1 is `data: null`. The SUT's `.then`
    // logs the explicit "Status code error" branch then dereferences
    // `response.data.data.text`, which throws on null and is swallowed by
    // the `.catch` (returning undefined). We pin the explicit code-check
    // branch — that's the path this test names.
    axios.get.mockResolvedValueOnce({
      data: { code: 1, message: "padID does not exist", data: null },
    });

    const text = await getEtherpadText({ padId: "pad-missing-1" });

    expect(text).toBeUndefined();
    expect(error).toHaveBeenCalled();
    expect(error.mock.calls[0][0]).toMatch(
      /Status code error getting etherpad text at pad-missing-1/,
    );
    expect(error.mock.calls[0][1]).toEqual({
      code: 1,
      message: "padID does not exist",
      data: null,
    });
  });
});

describe("env-var resolution — per call", () => {
  test("ETHERPAD_BASE_URL and ETHERPAD_API_KEY are read on each invocation", async () => {
    axios.get.mockResolvedValueOnce(okCreateResponse);
    axios.get.mockResolvedValueOnce(okCreateResponse);

    process.env.ETHERPAD_BASE_URL = "http://first.example.com";
    process.env.ETHERPAD_API_KEY = "first-key";
    await createEtherpad({ padId: "pad-env-1", defaultText: "" });

    process.env.ETHERPAD_BASE_URL = "http://second.example.com";
    process.env.ETHERPAD_API_KEY = "second-key";
    await createEtherpad({ padId: "pad-env-2", defaultText: "" });

    const firstCall = axios.get.mock.calls[0][0];
    const secondCall = axios.get.mock.calls[1][0];

    expect(firstCall).toMatch(/^http:\/\/first\.example\.com\//);
    expect(firstCall).toContain("apikey=first-key");
    expect(secondCall).toMatch(/^http:\/\/second\.example\.com\//);
    expect(secondCall).toContain("apikey=second-key");
  });
});
