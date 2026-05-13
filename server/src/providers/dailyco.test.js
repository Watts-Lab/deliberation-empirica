import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Mock axios *before* importing the SUT so the import binding sees the mock.
// `dailyCheck` reads `process.env.DAILY_APIKEY` at call time, so we set that
// in beforeEach instead of at module-eval time.
vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

// eslint-disable-next-line import/first
import axios from "axios";
// eslint-disable-next-line import/first
import { dailyCheck, createRoom } from "./dailyco";

// Snapshot/restore env via key-level mutation rather than reassigning
// `process.env` (matches the repo pattern in preFlightChecks.test.js:25-35).
// Reassigning the object can drop libraries' references to the original
// and behave inconsistently across Node versions.
let envSnapshot;

beforeEach(() => {
  vi.resetAllMocks();
  envSnapshot = { ...process.env };
  process.env.DAILY_APIKEY = "test-key";
});

afterEach(() => {
  Object.keys(process.env).forEach((key) => {
    delete process.env[key];
  });
  Object.assign(process.env, envSnapshot);
});

describe("dailyCheck — invalid videoStorage propagates as a rejection", () => {
  test("nonexistent bucket: Daily's 'unable to upload test file to bucket' surfaces as a thrown Error", async () => {
    // Daily.co's actual response shape when a recording bucket is
    // misconfigured. Reproduces the cypress 08 case where a batch with
    // bad `videoStorage.bucket` should bubble up to batch.failed.
    axios.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: {
          info: "unable to upload test file to bucket nonExistentBucket",
        },
      },
    });

    await expect(
      dailyCheck("test-room", {
        bucket: "nonExistentBucket",
        region: "us-east-1",
      }),
    ).rejects.toThrow(/unable to upload test file to bucket/);
  });

  test("createRoom forwards videoStorage.assumeRoleArn into recordings_bucket", async () => {
    // Per dl#167: the runtime now reads assumeRoleArn from the batch
    // config instead of hardcoding the platform ARN, so researcher-
    // owned buckets can point at their own IAM role. Pin the wiring.
    axios.post.mockResolvedValueOnce({ status: 200, data: { name: "r" } });

    await createRoom("r", {
      bucket: "researcher-bucket",
      region: "us-west-2",
      assumeRoleArn: "arn:aws:iam::123456789012:role/custom-role",
    });

    const [, body] = axios.post.mock.calls[0];
    expect(body.properties.recordings_bucket).toEqual({
      bucket_name: "researcher-bucket",
      bucket_region: "us-west-2",
      assume_role_arn: "arn:aws:iam::123456789012:role/custom-role",
      allow_api_access: false,
    });
  });

  test("does NOT swallow the error — DAILY_APIKEY=none is the only allowed escape", async () => {
    // Regression guard: with a real DAILY_APIKEY, a Daily failure
    // must propagate so the batch handler can mark the batch failed.
    // `dailyCheck` has a special-case warn-and-continue branch only
    // when DAILY_APIKEY === "none" (test-mode). Pin both halves.
    axios.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { info: "unable to upload test file to bucket bad-bucket" },
      },
    });
    await expect(
      dailyCheck("r", { bucket: "bad-bucket", region: "us-east-1" }),
    ).rejects.toThrow();

    // With DAILY_APIKEY="none", the same error is suppressed.
    axios.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { info: "unable to upload test file to bucket bad-bucket" },
      },
    });
    process.env.DAILY_APIKEY = "none";
    await expect(
      dailyCheck("r", { bucket: "bad-bucket", region: "us-east-1" }),
    ).resolves.toBeUndefined();
  });
});
