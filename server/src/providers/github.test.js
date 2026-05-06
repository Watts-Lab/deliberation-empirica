import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the Octokit class so validateRepoAccess never hits the real GitHub
// API. `vi.hoisted` is required because vi.mock is hoisted above the
// const declaration; the mock factory needs the captured fn to exist at
// hoist-time, not at runtime.
const { mockGetRef, mockGetContent, mockCreateOrUpdate } = vi.hoisted(() => ({
  mockGetRef: vi.fn(),
  mockGetContent: vi.fn(),
  mockCreateOrUpdate: vi.fn(),
}));
vi.mock("octokit", () => ({
  Octokit: class {
    constructor() {
      this.rest = {
        git: { getRef: mockGetRef },
        repos: {
          getContent: mockGetContent,
          createOrUpdateFileContents: mockCreateOrUpdate,
        },
        rateLimit: { get: vi.fn().mockResolvedValue({ data: {} }) },
      };
    }
  },
}));

// eslint-disable-next-line import/first
import {
  validateRepoAccess,
  validateConfigReposAccess,
  pushDataToGithub,
  pushPreregToGithub,
  pushPostFlightReportToGithub,
} from "./github";

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

describe("push functions short-circuit under USE_MANAGER_SAVE=true", () => {
  // Manager-launched mode owns the data destination via the tick
  // channel — the runtime registers output files at batch init
  // (callbacks.js → manager/index.mjs::registerOutput) and the tick
  // scheduler picks up changes from disk on its 60s cadence. The
  // direct-Octokit push path is solo-dev only.
  function fakeBatch(overrides = {}) {
    const data = {
      validatedConfig: {
        dataRepos: [{ owner: "a", repo: "b", branch: "main", directory: "d" }],
        preregRepos: [
          { owner: "c", repo: "d", branch: "main", directory: "p" },
        ],
      },
      scienceDataFilename: "/tmp/science.jsonl",
      preregistrationDataFilename: "/tmp/prereg.jsonl",
      postFlightReportFilename: "/tmp/postflight.jsonl",
      ...overrides,
    };
    return { get: (k) => data[k] };
  }

  test("pushDataToGithub is a no-op (commitFile not called)", async () => {
    process.env.USE_MANAGER_SAVE = "true";
    await pushDataToGithub({
      batch: fakeBatch(),
      delaySeconds: 0,
      throwErrors: true,
    });
    expect(mockCreateOrUpdate).not.toHaveBeenCalled();
    expect(mockGetContent).not.toHaveBeenCalled();
  });

  test("pushPreregToGithub is a no-op", async () => {
    process.env.USE_MANAGER_SAVE = "true";
    await pushPreregToGithub({ batch: fakeBatch(), delaySeconds: 0 });
    expect(mockCreateOrUpdate).not.toHaveBeenCalled();
    expect(mockGetContent).not.toHaveBeenCalled();
  });

  test("pushPostFlightReportToGithub is a no-op", async () => {
    process.env.USE_MANAGER_SAVE = "true";
    await pushPostFlightReportToGithub({ batch: fakeBatch() });
    expect(mockCreateOrUpdate).not.toHaveBeenCalled();
    expect(mockGetContent).not.toHaveBeenCalled();
  });

  test("solo-dev mode (USE_MANAGER_SAVE unset) reaches commitFile and pushes (legacy path preserved)", async () => {
    // Confirms the gate is purely on `USE_MANAGER_SAVE` — flipping
    // it off restores the legacy direct-Octokit path end-to-end.
    // We use a real temp file so `loadFileToBase64` succeeds, and
    // mock both octokit calls so commitFile completes cleanly
    // without the ENOENT-retry log spam Copilot flagged.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "github-test-"));
    const scienceFile = path.join(tmpDir, "science.jsonl");
    fs.writeFileSync(scienceFile, '{"row":1}\n');
    try {
      delete process.env.USE_MANAGER_SAVE;
      mockGetContent.mockResolvedValue({
        status: 200,
        data: { sha: "abc" },
      });
      mockCreateOrUpdate.mockResolvedValue({
        status: 200,
        data: { commit: { sha: "def" } },
      });
      await pushDataToGithub({
        batch: fakeBatch({ scienceDataFilename: scienceFile }),
        delaySeconds: 0,
      });
      // Both legs of commitFile reached: first getContent (for the
      // existing-file SHA), then createOrUpdate (the actual push).
      // The contrast with the manager-mode tests above (which assert
      // ZERO octokit calls) is the load-bearing pin.
      expect(mockGetContent).toHaveBeenCalled();
      expect(mockCreateOrUpdate).toHaveBeenCalled();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
