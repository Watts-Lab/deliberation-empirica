import { describe, test, expect } from "vitest";
import { ContentHashStore } from "./contentHashStore.mjs";

const SHA256_HEX = /^[a-f0-9]{64}$/;

describe("ContentHashStore.hashContent", () => {
  test("produces a sha256 hex string", () => {
    const h = ContentHashStore.hashContent("hello world");
    expect(h).toMatch(SHA256_HEX);
    // Stable canonical sha256 of "hello world".
    expect(h).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });

  test("accepts strings or Buffers and produces the same hash", () => {
    const a = ContentHashStore.hashContent("foo");
    const b = ContentHashStore.hashContent(Buffer.from("foo"));
    expect(a).toBe(b);
  });
});

describe("ContentHashStore.needsSave", () => {
  test("returns true for a never-seen path", () => {
    const s = new ContentHashStore();
    expect(s.needsSave("science.jsonl", "row 1\n")).toBe(true);
  });

  test("returns false when content is unchanged since last ack", () => {
    const s = new ContentHashStore();
    const content = "row 1\n";
    const hash = ContentHashStore.hashContent(content);
    s.recordAck("science.jsonl", hash);
    expect(s.needsSave("science.jsonl", content)).toBe(false);
  });

  test("returns true when content changes after an ack", () => {
    const s = new ContentHashStore();
    const a = "row 1\n";
    s.recordAck("science.jsonl", ContentHashStore.hashContent(a));
    expect(s.needsSave("science.jsonl", "row 1\nrow 2\n")).toBe(true);
  });

  test("tracks paths independently — ack on one doesn't mute another", () => {
    const s = new ContentHashStore();
    s.recordAck("science.jsonl", ContentHashStore.hashContent("a"));
    expect(s.needsSave("science.jsonl", "a")).toBe(false);
    // payment.jsonl was never ack'd, so it still needs save.
    expect(s.needsSave("payment.jsonl", "a")).toBe(true);
  });
});

describe("ContentHashStore.recordAck", () => {
  test("rejects a non-sha256 hash (catches caller bugs that pass content instead of digest)", () => {
    const s = new ContentHashStore();
    expect(() => s.recordAck("science.jsonl", "not-a-hash")).toThrow(
      /sha256 hex/,
    );
    expect(() => s.recordAck("science.jsonl", undefined)).toThrow();
  });
});

describe("ContentHashStore.lastAcked + reset", () => {
  test("lastAcked returns undefined for unseen paths", () => {
    expect(new ContentHashStore().lastAcked("x.jsonl")).toBeUndefined();
  });

  test("reset(path) forgets a single path", () => {
    const s = new ContentHashStore();
    const hA = ContentHashStore.hashContent("a");
    const hB = ContentHashStore.hashContent("b");
    s.recordAck("a.jsonl", hA);
    s.recordAck("b.jsonl", hB);
    s.reset("a.jsonl");
    expect(s.lastAcked("a.jsonl")).toBeUndefined();
    expect(s.lastAcked("b.jsonl")).toBe(hB);
  });

  test("reset() with no arg clears everything", () => {
    const s = new ContentHashStore();
    s.recordAck("a.jsonl", ContentHashStore.hashContent("a"));
    s.recordAck("b.jsonl", ContentHashStore.hashContent("b"));
    s.reset();
    expect(s.lastAcked("a.jsonl")).toBeUndefined();
    expect(s.lastAcked("b.jsonl")).toBeUndefined();
  });
});
