import { describe, test, expect, vi } from "vitest";
import {
  buildPaymentData,
  collectPaymentExportErrors,
} from "./paymentDataHelpers";

function makePlayer(attrs = {}) {
  return {
    id: "p1",
    get: vi.fn((key) => attrs[key]),
  };
}
function makeBatch(id, attrs = {}) {
  return {
    id,
    get: vi.fn((key) => attrs[key]),
  };
}

// ---------- collectPaymentExportErrors ----------

describe("collectPaymentExportErrors", () => {
  test("returns empty array when IDs match", () => {
    expect(
      collectPaymentExportErrors({
        player: makePlayer({ batchId: "b1" }),
        batch: makeBatch("b1"),
      })
    ).toEqual([]);
  });

  test("reports a batch-ID mismatch", () => {
    const errors = collectPaymentExportErrors({
      player: makePlayer({ batchId: "assigned" }),
      batch: makeBatch("actual"),
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Batch ID: actual.*assigned/);
  });

  test("reports a mismatch when player has no batchId", () => {
    const errors = collectPaymentExportErrors({
      player: makePlayer({}),
      batch: makeBatch("b1"),
    });
    expect(errors).toHaveLength(1);
  });
});

// ---------- buildPaymentData ----------

describe("buildPaymentData", () => {
  const fullFixture = () => ({
    player: makePlayer({
      batchId: "b1",
      participantData: { platformId: "worker-7" },
      introDone: true,
      timeIntroDone: "2024-01-01T00:00:05.000Z",
      exitStatus: "complete",
      connectionInfo: { country: "US" },
      urlParams: { workerId: "worker-7", assignmentId: "asgn-1" },
    }),
    batch: makeBatch("b1", {
      validatedConfig: { batchName: "pilot-A" },
    }),
    exportErrors: [],
  });

  test("produces the full payment row shape", () => {
    const data = buildPaymentData(fullFixture());
    expect(data).toMatchObject({
      batchId: "b1",
      batchName: "pilot-A",
      platformId: "worker-7",
      introDone: true,
      timeIntroDone: "2024-01-01T00:00:05.000Z",
      exitStatus: "complete",
      connectionInfo: { country: "US" },
      workerId: "worker-7",
      assignmentId: "asgn-1",
      exportErrors: [],
    });
  });

  test("spreads urlParams onto the row (for workerId/assignmentId/referrer)", () => {
    const inputs = fullFixture();
    inputs.player = makePlayer({
      batchId: "b1",
      participantData: { platformId: "x" },
      urlParams: { workerId: "abc", referrer: "https://example.org" },
    });
    const data = buildPaymentData(inputs);
    expect(data.workerId).toBe("abc");
    expect(data.referrer).toBe("https://example.org");
  });

  test("forwards exportErrors verbatim", () => {
    const inputs = fullFixture();
    inputs.exportErrors = ["mismatch"];
    expect(buildPaymentData(inputs).exportErrors).toEqual(["mismatch"]);
  });

  test("defaults exportErrors to [] when omitted", () => {
    const inputs = fullFixture();
    delete inputs.exportErrors;
    expect(buildPaymentData(inputs).exportErrors).toEqual([]);
  });

  test("handles a player without urlParams (no spread pollution)", () => {
    const inputs = fullFixture();
    inputs.player = makePlayer({
      batchId: "b1",
      participantData: { platformId: "x" },
      // no urlParams
    });
    expect(() => buildPaymentData(inputs)).not.toThrow();
  });

  test("handles missing participantData and batchConfig gracefully", () => {
    const inputs = {
      player: makePlayer({ batchId: "b1" }), // no participantData
      batch: makeBatch("b1", {}), // no validatedConfig
      exportErrors: [],
    };
    const data = buildPaymentData(inputs);
    expect(data.batchId).toBe("b1");
    expect(data.platformId).toBeUndefined();
    expect(data.batchName).toBeUndefined();
  });

  test("serializes losslessly through JSON.stringify", () => {
    const data = buildPaymentData(fullFixture());
    const json = JSON.stringify(data);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.batchId).toBe("b1");
    expect(parsed.workerId).toBe("worker-7");
  });
});
