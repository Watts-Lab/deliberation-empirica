import { describe, test, expect } from "vitest";
import { TickStatus, VALID_STATUS_VALUES } from "./tickStatus.mjs";

describe("TickStatus", () => {
  test("starts in `running` by default", () => {
    expect(new TickStatus().current()).toBe("running");
  });

  test("accepts a valid initial state", () => {
    expect(new TickStatus("draining").current()).toBe("draining");
  });

  test("rejects an invalid initial state", () => {
    expect(() => new TickStatus("sealed")).toThrow(/Invalid initial status/);
  });

  test("running → draining → complete is allowed", () => {
    const s = new TickStatus("running");
    s.set("draining");
    expect(s.current()).toBe("draining");
    s.set("complete");
    expect(s.current()).toBe("complete");
  });

  test("running → complete (skip draining) is allowed (e.g. empty batch)", () => {
    const s = new TickStatus("running");
    s.set("complete");
    expect(s.current()).toBe("complete");
  });

  test("draining → running is rejected (one-way wind-down)", () => {
    const s = new TickStatus("running");
    s.set("draining");
    expect(() => s.set("running")).toThrow(/Invalid transition/);
  });

  test("complete is terminal — no further transitions", () => {
    const s = new TickStatus("running");
    s.set("complete");
    expect(s.isTerminal()).toBe(true);
    expect(() => s.set("draining")).toThrow(/Invalid transition/);
    expect(() => s.set("running")).toThrow(/Invalid transition/);
    expect(() => s.set("failed")).toThrow(/Invalid transition/);
  });

  test("failed is terminal", () => {
    const s = new TickStatus("running");
    s.set("failed");
    expect(s.isTerminal()).toBe(true);
    expect(() => s.set("running")).toThrow(/Invalid transition/);
  });

  test("any non-terminal can transition to failed", () => {
    ["running", "draining"].forEach((start) => {
      const s = new TickStatus(start);
      s.set("failed");
      expect(s.current()).toBe("failed");
    });
  });

  test("re-asserting the current state is a no-op", () => {
    const s = new TickStatus("draining");
    s.set("draining");
    expect(s.current()).toBe("draining");
  });

  test("rejects an invalid target state", () => {
    const s = new TickStatus();
    expect(() => s.set("sealed")).toThrow(/Invalid status/);
  });

  test("VALID_STATUS_VALUES enumerates the four runtime-reportable states", () => {
    expect(VALID_STATUS_VALUES).toEqual([
      "running",
      "draining",
      "complete",
      "failed",
    ]);
  });
});
