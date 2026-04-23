import { describe, test, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import { appendJsonlLine } from "./appendJsonlLine";

vi.mock("fs", () => ({
  appendFileSync: vi.fn(),
}));

describe("appendJsonlLine", () => {
  beforeEach(() => {
    fs.appendFileSync.mockReset();
    fs.appendFileSync.mockImplementation(() => {});
  });

  test("writes JSON.stringify(data) + newline to filename", () => {
    const ok = appendJsonlLine({
      filename: "/tmp/out.jsonl",
      data: { a: 1, b: [2, 3] },
      label: "science data",
      playerId: "p1",
    });
    expect(ok).toBe(true);
    expect(fs.appendFileSync).toHaveBeenCalledWith(
      "/tmp/out.jsonl",
      '{"a":1,"b":[2,3]}\n'
    );
  });

  test("returns false and does not throw when appendFileSync fails", () => {
    fs.appendFileSync.mockImplementation(() => {
      throw new Error("disk full");
    });
    const ok = appendJsonlLine({
      filename: "/tmp/out.jsonl",
      data: { x: 1 },
      label: "payment data",
      playerId: "p2",
    });
    expect(ok).toBe(false);
  });

  test("serializes top-level arrays and primitives as written", () => {
    appendJsonlLine({
      filename: "/tmp/out.jsonl",
      data: [1, 2, 3],
      label: "x",
      playerId: "p1",
    });
    expect(fs.appendFileSync).toHaveBeenLastCalledWith(
      "/tmp/out.jsonl",
      "[1,2,3]\n"
    );
  });
});
