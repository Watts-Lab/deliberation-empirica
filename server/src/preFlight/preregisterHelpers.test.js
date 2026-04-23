import { describe, test, expect, vi } from "vitest";
import { createHash } from "crypto";
import {
  buildTreatmentMetadata,
  buildPreregData,
} from "./preregisterHelpers";

// ---------- Fixtures ----------

function makePlayer(attrs = {}) {
  return {
    id: "p1",
    get: vi.fn((key) => attrs[key]),
    set: vi.fn(),
  };
}
function makeGame(id, attrs = {}) {
  return {
    id,
    get: vi.fn((key) => attrs[key]),
  };
}
function makeBatch(id, attrs = {}) {
  return {
    id,
    get: vi.fn((key) => attrs[key]),
  };
}

// ---------- buildTreatmentMetadata ----------

describe("buildTreatmentMetadata", () => {
  test("extracts the headline fields and hashes the full object", () => {
    const treatment = {
      name: "study_A",
      desc: "A one-player study",
      playerCount: 1,
      gameStages: [
        { name: "s", duration: 10, elements: [{ type: "submitButton" }] },
      ],
    };
    const metadata = buildTreatmentMetadata(treatment);
    expect(metadata).toMatchObject({
      name: "study_A",
      desc: "A one-player study",
      playerCount: 1,
    });
    expect(metadata.treatmentHash).toMatch(/^[0-9a-f]{40}$/); // sha1 hex
  });

  test("produces a stable hash across invocations for the same input", () => {
    const treatment = { name: "x", playerCount: 2 };
    const h1 = buildTreatmentMetadata(treatment).treatmentHash;
    const h2 = buildTreatmentMetadata(treatment).treatmentHash;
    expect(h1).toBe(h2);
  });

  test("produces a different hash when any nested field changes", () => {
    const base = {
      name: "x",
      playerCount: 1,
      gameStages: [
        { name: "s", duration: 10, elements: [{ type: "submitButton" }] },
      ],
    };
    const tweaked = {
      ...base,
      gameStages: [
        { name: "s", duration: 11, elements: [{ type: "submitButton" }] },
      ],
    };
    expect(buildTreatmentMetadata(base).treatmentHash).not.toBe(
      buildTreatmentMetadata(tweaked).treatmentHash
    );
  });

  test("hash matches a manually-computed sha1 of the stringified treatment", () => {
    const treatment = { name: "x", playerCount: 1 };
    const expected = createHash("sha1")
      .update(JSON.stringify(treatment))
      .digest("hex");
    expect(buildTreatmentMetadata(treatment).treatmentHash).toBe(expected);
  });

  test("handles undefined treatment without throwing", () => {
    const metadata = buildTreatmentMetadata(undefined);
    expect(metadata.name).toBeUndefined();
    expect(metadata.treatmentHash).toMatch(/^[0-9a-f]{40}$/);
  });
});

// ---------- buildPreregData ----------

describe("buildPreregData", () => {
  const fullFixture = () => ({
    sampleId: "sample-abc-123",
    player: makePlayer({
      batchId: "b1",
      gameId: "g1",
      participantData: { deliberationId: "delib-1" },
      treatment: {
        name: "t_main",
        desc: "main treatment",
        playerCount: 2,
      },
      position: "0",
    }),
    batch: makeBatch("b1", {
      timeInitialized: 1700000000000,
      assetsRepoSha: "abcdef0123456789abcdef0123456789abcdef01",
      validatedConfig: {
        name: "b1",
        knockdowns: [0.5, 0.6],
        extraField: "kept",
      },
    }),
    game: makeGame("g1", { timeGameStarted: 1700000001000 }),
    exportErrors: [],
  });

  test("produces the full prereg-data shape with populated fields", () => {
    const inputs = fullFixture();
    const data = buildPreregData(inputs);

    expect(data.sampleId).toBe("sample-abc-123");
    expect(data.deliberationId).toBe("delib-1");
    expect(data.batchId).toBe("b1");
    expect(data.gameId).toBe("g1");
    expect(data.position).toBe("0");
    expect(data.timeBatchInitialized).toBe(1700000000000);
    expect(data.timeGameStarted).toBe(1700000001000);

    // treatmentMetadata is composed by buildTreatmentMetadata
    expect(data.treatmentMetadata).toMatchObject({
      name: "t_main",
      desc: "main treatment",
      playerCount: 2,
    });
    expect(data.treatmentMetadata.treatmentHash).toMatch(/^[0-9a-f]{40}$/);

    // Knockdowns are condensed into summary stats (shared with science-data)
    expect(data.config.extraField).toBe("kept");
    expect(data.config.knockdowns).toBeUndefined();
    expect(data.config.knockdownDetails).toMatchObject({ shape: [2] });

    expect(data.exportErrors).toEqual([]);
  });

  test("stamps assetsRepoSha from the batch into the prereg row", () => {
    const inputs = fullFixture();
    expect(buildPreregData(inputs).assetsRepoSha).toBe(
      "abcdef0123456789abcdef0123456789abcdef01"
    );
  });

  test("assetsRepoSha is undefined when the batch has no sha set", () => {
    const inputs = fullFixture();
    inputs.batch = makeBatch("b1", { timeInitialized: 1700000000000 });
    expect(buildPreregData(inputs).assetsRepoSha).toBeUndefined();
  });

  test("leaves timeGameStarted undefined when game hasn't started yet", () => {
    const inputs = fullFixture();
    inputs.game = makeGame("g1", {}); // no timeGameStarted
    expect(buildPreregData(inputs).timeGameStarted).toBeUndefined();
  });

  test("config is 'missing' when the batch has no validatedConfig", () => {
    const inputs = fullFixture();
    inputs.batch = makeBatch("b1", {});
    expect(buildPreregData(inputs).config).toBe("missing");
  });

  test("exportErrors defaults to [] when not provided", () => {
    const inputs = fullFixture();
    delete inputs.exportErrors;
    expect(buildPreregData(inputs).exportErrors).toEqual([]);
  });

  test("forwards exportErrors verbatim", () => {
    const inputs = fullFixture();
    inputs.exportErrors = ["batch-mismatch", "game-mismatch"];
    expect(buildPreregData(inputs).exportErrors).toEqual([
      "batch-mismatch",
      "game-mismatch",
    ]);
  });

  test("serializes losslessly through JSON.stringify", () => {
    const data = buildPreregData(fullFixture());
    const json = JSON.stringify(data);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.sampleId).toBe("sample-abc-123");
    expect(parsed.treatmentMetadata.treatmentHash).toMatch(/^[0-9a-f]{40}$/);
  });

  test("treatmentHash is stable for the same treatment across sampleIds", () => {
    // Pre-registration integrity: two participants assigned the same
    // treatment should carry the same hash, even though their sampleIds
    // differ.
    const a = fullFixture();
    const b = fullFixture();
    b.sampleId = "different";
    expect(buildPreregData(a).treatmentMetadata.treatmentHash).toBe(
      buildPreregData(b).treatmentMetadata.treatmentHash
    );
  });
});
