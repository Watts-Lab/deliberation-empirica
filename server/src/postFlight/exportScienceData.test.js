import { describe, test, expect, vi, beforeEach } from "vitest";

// vi.hoisted lets us declare mocks that are available in the hoisted
// vi.mock factories below. Without this, const-before-mock wouldn't work.
const { appendFileSyncMock, pushDataToGithubMock } = vi.hoisted(() => ({
  appendFileSyncMock: vi.fn(),
  pushDataToGithubMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("fs", async () => {
  const actual = await vi.importActual("fs");
  return { ...actual, appendFileSync: appendFileSyncMock };
});
vi.mock("../providers/github", () => ({
  pushDataToGithub: pushDataToGithubMock,
}));

// eslint-disable-next-line import/first
import { exportScienceData } from "./exportScienceData";

// ---------- Fixture helpers (Empirica-shaped mocks) ----------

function makePlayer(attrs = {}) {
  return {
    id: attrs.id ?? "p1",
    get: vi.fn((key) => attrs[key]),
    attributes: {
      attrs: new Map([["scope", new Map(Object.entries(attrs))]]),
    },
  };
}
function makeBatch(id, attrs = {}) {
  return { id, get: vi.fn((key) => attrs[key]) };
}
function makeGame(id, attrs = {}, stages = []) {
  return {
    id,
    get: vi.fn((key) => attrs[key]),
    stages,
  };
}

// ---------- Tests ----------

describe("exportScienceData orchestrator", () => {
  beforeEach(() => {
    appendFileSyncMock.mockReset();
    pushDataToGithubMock.mockReset().mockResolvedValue(undefined);
  });

  test("appends a JSONL row to the batch's scienceDataFilename", async () => {
    const player = makePlayer({
      batchId: "b1",
      gameId: "g1",
      participantData: { deliberationId: "delib-1" },
      prompt_q1: { value: "yes" },
    });
    const batch = makeBatch("b1", {
      scienceDataFilename: "/tmp/science.jsonl",
      validatedConfig: { name: "b", knockdowns: "none" },
    });
    const game = makeGame("g1", {}, []);

    await exportScienceData({ player, batch, game });

    expect(appendFileSyncMock).toHaveBeenCalledTimes(1);
    const [filename, payload] = appendFileSyncMock.mock.calls[0];
    expect(filename).toBe("/tmp/science.jsonl");
    // Contract: a trailing newline so each row is a distinct JSONL line
    expect(payload.endsWith("\n")).toBe(true);
    // The payload must be a parseable JSON line with expected fields
    const row = JSON.parse(payload);
    expect(row.batchId).toBe("b1");
    expect(row.gameId).toBe("g1");
    expect(row.prompts).toHaveProperty("prompt_q1");
  });

  test("pushes the data to GitHub after writing", async () => {
    const player = makePlayer({
      batchId: "b1",
      gameId: "g1",
      participantData: {},
    });
    const batch = makeBatch("b1", {
      scienceDataFilename: "/tmp/science.jsonl",
    });
    const game = makeGame("g1");

    await exportScienceData({ player, batch, game });

    expect(pushDataToGithubMock).toHaveBeenCalledTimes(1);
    expect(pushDataToGithubMock).toHaveBeenCalledWith({ batch });
  });

  test("surfaces batch/game-ID mismatches on the exported row", async () => {
    const player = makePlayer({
      batchId: "different",
      gameId: "other",
      participantData: {},
    });
    const batch = makeBatch("b1", {
      scienceDataFilename: "/tmp/science.jsonl",
    });
    const game = makeGame("g1");

    await exportScienceData({ player, batch, game });

    const [, payload] = appendFileSyncMock.mock.calls[0];
    const row = JSON.parse(payload);
    expect(row.exportErrors).toHaveLength(2);
    expect(row.exportErrors[0]).toMatch(/Batch ID/);
    expect(row.exportErrors[1]).toMatch(/Game ID/);
  });

  test("still pushes to GitHub when fs.appendFileSync throws", async () => {
    appendFileSyncMock.mockImplementationOnce(() => {
      throw new Error("disk full");
    });
    const player = makePlayer({
      batchId: "b1",
      gameId: "g1",
      participantData: {},
    });
    const batch = makeBatch("b1", {
      scienceDataFilename: "/tmp/science.jsonl",
    });
    const game = makeGame("g1");

    // Must not throw — the orchestrator catches and logs write failures
    // but continues to attempt the GitHub push (so a local-disk issue
    // doesn't also block the remote mirror).
    await expect(
      exportScienceData({ player, batch, game }),
    ).resolves.not.toThrow();
    expect(pushDataToGithubMock).toHaveBeenCalled();
  });

  test("swallows exceptions from pushDataToGithub (doesn't crash the server)", async () => {
    pushDataToGithubMock.mockRejectedValueOnce(new Error("network down"));
    const player = makePlayer({
      batchId: "b1",
      gameId: "g1",
      participantData: {},
    });
    const batch = makeBatch("b1", {
      scienceDataFilename: "/tmp/science.jsonl",
    });
    const game = makeGame("g1");

    await expect(
      exportScienceData({ player, batch, game }),
    ).resolves.not.toThrow();
    // Write still happened even though the push failed
    expect(appendFileSyncMock).toHaveBeenCalled();
  });

  test("writes only one JSONL line per export (idempotency of call)", async () => {
    const player = makePlayer({
      batchId: "b1",
      gameId: "g1",
      participantData: {},
    });
    const batch = makeBatch("b1", {
      scienceDataFilename: "/tmp/science.jsonl",
    });
    const game = makeGame("g1");

    await exportScienceData({ player, batch, game });
    expect(appendFileSyncMock).toHaveBeenCalledTimes(1);
    const payload = appendFileSyncMock.mock.calls[0][1];
    // Exactly one trailing newline, not multiple
    expect(payload.match(/\n/g)).toHaveLength(1);
  });
});
