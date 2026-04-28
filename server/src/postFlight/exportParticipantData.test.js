import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  readFileSync,
  readdirSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";

import {
  createNewParticipant,
  getParticipantData,
} from "./exportParticipantData";

// Stub the @empirica/core/console import so the module's `info` / `error`
// calls don't pollute test output. The fs side-effects are what we
// actually care about asserting on.
vi.mock("@empirica/core/console", () => ({
  info: () => {},
  error: () => {},
}));

/**
 * Tests for the orchestrator branches of exportParticipantData.js.
 *
 * Pure line-format helpers live in participantDataHelpers.test.js.
 * This file focuses on the I/O orchestration `getParticipantData`
 * exposes:
 *
 *   - file exists + parses → returns the persisted record
 *   - ENOENT → falls back to createNewParticipant (returns + writes
 *     a fresh JSONL)
 *   - any other read error → also falls back to createNewParticipant
 *     (the catch-all branch on line 68)
 *
 * Plus the createNewParticipant side branches (mkdir -p, blank
 * platformId early-out).
 *
 * Cypress 07 (retired alongside this file) only exercised the
 * file-exists branch implicitly via the participant flow; these unit
 * tests pin the other two branches that nothing else covered.
 */

let scratchDir;
const originalDataDir = process.env.DATA_DIR;

beforeEach(() => {
  scratchDir = mkdtempSync(join(tmpdir(), "exportParticipantData-test-"));
  process.env.DATA_DIR = scratchDir;
});

afterEach(() => {
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  rmSync(scratchDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("getParticipantData", () => {
  test("file exists → returns the parsed participantData record", async () => {
    const platformId = "platform-abc";
    const dataDir = join(scratchDir, "participantData");
    const fs = await import("fs");
    fs.mkdirSync(dataDir, { recursive: true });
    const lines = [
      {
        type: "meta",
        key: "platformId",
        val: platformId,
        ts: "2024-01-01T00:00:00.000Z",
      },
      {
        type: "meta",
        key: "deliberationId",
        val: "delib-from-disk",
        ts: "2024-01-01T00:00:00.000Z",
      },
    ]
      .map((l) => JSON.stringify(l))
      .join("\n");
    writeFileSync(join(dataDir, `${platformId}.jsonl`), lines, "utf8");

    const result = await getParticipantData({ platformId });
    expect(result).toEqual({
      platformId,
      deliberationId: "delib-from-disk",
    });
  });

  test("file missing (ENOENT) → falls back to createNewParticipant + writes a fresh JSONL", async () => {
    const platformId = "new-platform-xyz";
    const expectedFile = join(
      scratchDir,
      "participantData",
      `${platformId}.jsonl`,
    );
    expect(existsSync(expectedFile)).toBe(false);

    const result = await getParticipantData({ platformId });

    // Returned record has the platformId we passed and a freshly
    // generated UUID-format deliberationId (not whatever was on disk
    // — there was nothing on disk).
    expect(result.platformId).toBe(platformId);
    expect(result.deliberationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    // The create-new branch also writes the JSONL to disk for next
    // time. fs.appendFile is async; poll for the *content* (not just
    // existence) so the read isn't racy with the write.
    await vi.waitFor(
      () => {
        expect(existsSync(expectedFile)).toBe(true);
        const c = readFileSync(expectedFile, "utf8");
        expect(c.length).toBeGreaterThan(0);
      },
      { timeout: 1000 },
    );
    const written = readFileSync(expectedFile, "utf8");
    expect(written).toContain(`"key":"platformId"`);
    expect(written).toContain(`"val":"${platformId}"`);
    expect(written).toContain(`"key":"deliberationId"`);
    expect(written).toContain(`"val":"${result.deliberationId}"`);
  });

  test("non-ENOENT read error → also falls back to createNewParticipant (defensive branch)", async () => {
    // Force a non-ENOENT read error by putting a directory at the
    // path readFileSync expects to find a file at. readFileSync on a
    // dir throws EISDIR — exactly the catch-all branch on
    // exportParticipantData.js:68. Avoids ESM-mocking limitations
    // (vi.spyOn can't redefine fs.readFileSync from ESM modules).
    const platformId = "platform-eisdir";
    const fs = await import("fs");
    const dataDir = join(scratchDir, "participantData");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(join(dataDir, `${platformId}.jsonl`));

    const result = await getParticipantData({ platformId });
    expect(result.platformId).toBe(platformId);
    // A fresh deliberationId is generated despite the read failure
    // — pin the UUID format so a regression that propagated the
    // error or returned undefined would be caught.
    expect(result.deliberationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

describe("createNewParticipant", () => {
  test("blank platformId → returns a record without writing a file (no name to key it by)", () => {
    const result = createNewParticipant({ platformId: "" });
    // Returns the record so callers don't blow up, but skips the
    // appendFile call — we have no filename to write under.
    expect(result.platformId).toBe("");
    expect(result.deliberationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    // No file should land in the participantData dir for the empty
    // platformId.
    const dataDir = join(scratchDir, "participantData");
    if (existsSync(dataDir)) {
      const entries = readdirSync(dataDir);
      expect(entries.filter((e) => e.startsWith(".jsonl"))).toEqual([]);
    }
  });

  test("missing participantData dir → mkdir -p creates it, file lands inside", async () => {
    const platformId = "fresh-platform";
    const dataDir = join(scratchDir, "participantData");
    expect(existsSync(dataDir)).toBe(false);

    createNewParticipant({ platformId });

    expect(existsSync(dataDir)).toBe(true);
    const expectedFile = join(dataDir, `${platformId}.jsonl`);
    await vi.waitFor(() => expect(existsSync(expectedFile)).toBe(true), {
      timeout: 1000,
    });
  });
});
