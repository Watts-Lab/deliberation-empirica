import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the Octokit class so validateRepoAccess never hits the real GitHub
// API. `vi.hoisted` is required because vi.mock is hoisted above the
// const declaration; the mock factory needs the captured fn to exist at
// hoist-time, not at runtime.
const { mockGetRef } = vi.hoisted(() => ({ mockGetRef: vi.fn() }));
vi.mock("octokit", () => ({
  Octokit: class {
    constructor() {
      this.rest = {
        git: { getRef: mockGetRef },
        rateLimit: { get: vi.fn().mockResolvedValue({ data: {} }) },
      };
    }
  },
}));

// eslint-disable-next-line import/first
import { validateRepoAccess, validateConfigReposAccess } from "./github";

// Snapshot/restore env via key-level mutation rather than reassigning
// `process.env` (matches the repo pattern in preFlightChecks.test.js:25-35).
// Reassigning the object can drop libraries' references to the original
// and behave inconsistently across Node versions.
let envSnapshot;

beforeEach(() => {
  // resetAllMocks (not clearAllMocks) wipes mock implementations too —
  // important here because some tests use mockResolvedValueOnce / queue
  // multiple values, and a leaked default would cross-couple tests.
  vi.resetAllMocks();
  envSnapshot = { ...process.env };
  process.env.TEST_CONTROLS = "enabled";
});

afterEach(() => {
  Object.keys(process.env).forEach((key) => {
    delete process.env[key];
  });
  Object.assign(process.env, envSnapshot);
});

describe("validateRepoAccess — bad repo / branch surfaces as a thrown Error", () => {
  test("404 on nonexistent branch throws with the requested ref in the message", async () => {
    // Reproduces the cypress 08 case: dataRepos points at a branch that
    // doesn't exist (`branch: "dummy_nonexistent"`). validateRepoAccess
    // must reject so the batch handler can mark the batch failed.
    mockGetRef.mockRejectedValueOnce({
      status: 404,
      message: "Not Found",
    });

    await expect(
      validateRepoAccess({
        owner: "Watts-Lab",
        repo: "deliberation-data-test",
        branch: "dummy_nonexistent",
      }),
    ).rejects.toThrow(
      /Cannot access repository Watts-Lab\/deliberation-data-test\/dummy_nonexistent/,
    );
  });

  test("403 (access denied) also throws", async () => {
    // Same propagation contract as 404 — both must surface so the
    // batch handler's catch block runs.
    mockGetRef.mockRejectedValueOnce({
      status: 403,
      message: "Forbidden",
    });

    await expect(
      validateRepoAccess({
        owner: "Watts-Lab",
        repo: "private-repo",
        branch: "main",
      }),
    ).rejects.toThrow(/Cannot access repository/);
  });

  test("returns true on success (200 OK from getRef)", async () => {
    mockGetRef.mockResolvedValueOnce({ data: { ref: "refs/heads/main" } });

    const result = await validateRepoAccess({
      owner: "Watts-Lab",
      repo: "deliberation-data-test",
      branch: "main",
    });
    expect(result).toBe(true);
  });
});

describe("validateConfigReposAccess — Promise.all rejection surface", () => {
  test("rejects when ANY dataRepo fails validation", async () => {
    // Two dataRepos: first OK, second 404. Promise.all should reject
    // with the second's error and the function should re-throw.
    mockGetRef
      .mockResolvedValueOnce({ data: { ref: "refs/heads/main" } })
      .mockRejectedValueOnce({ status: 404, message: "Not Found" });

    await expect(
      validateConfigReposAccess({
        config: {
          preregRepos: [],
          dataRepos: [
            { owner: "ok", repo: "ok", branch: "main" },
            { owner: "Watts-Lab", repo: "x", branch: "dummy_nonexistent" },
          ],
        },
      }),
    ).rejects.toThrow(/Cannot access repository/);
  });

  test("rejects when a preregRepo fails validation", async () => {
    mockGetRef.mockRejectedValueOnce({ status: 404, message: "Not Found" });

    await expect(
      validateConfigReposAccess({
        config: {
          dataRepos: [],
          preregRepos: [{ owner: "x", repo: "y", branch: "missing" }],
        },
      }),
    ).rejects.toThrow();
  });

  test("returns true when all repos validate", async () => {
    // Two repos in the config below; queue exactly two successful
    // responses so the mock has no persistent default that could leak
    // into a later test.
    mockGetRef
      .mockResolvedValueOnce({ data: { ref: "refs/heads/main" } })
      .mockResolvedValueOnce({ data: { ref: "refs/heads/main" } });

    const result = await validateConfigReposAccess({
      config: {
        dataRepos: [{ owner: "a", repo: "b", branch: "main" }],
        preregRepos: [{ owner: "c", repo: "d", branch: "main" }],
      },
    });
    expect(result).toBe(true);
  });
});
