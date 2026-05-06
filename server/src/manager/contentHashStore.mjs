import { createHash } from "node:crypto";

// Per-path sha256 dedup table. Each tick that carries a `save`
// references one of the runtime's tracked output files (science.jsonl,
// payment.jsonl, preregistration.jsonl, postFlightReport.jsonl).
// Manager ADR 0005 §"Pass-through data flow" specifies one save per
// tick, with the runtime omitting saves whose content hasn't changed
// since the last ack — multi-file post-flight bursts ride out-of-band
// ticks, one file per tick.
//
// Replaces the historical single `lastPushedHash` pattern in
// providers/github.js with a Map keyed by runtime-relative path so
// the four file types each track independently.

export class ContentHashStore {
  constructor() {
    this.lastAckedMap = new Map();
  }

  // Compute sha256 hex of a buffer or string. Exposed so callers
  // can hash once and pass the hash through to both `needsSave()`
  // and the tick payload's `contentHash` field — matches what the
  // manager will dedup against.
  static hashContent(content) {
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
    return createHash("sha256").update(buf).digest("hex");
  }

  // Returns true if content for `path` differs from the last value
  // the manager ack'd. New paths (never ack'd) always return true so
  // a first save fires.
  needsSave(path, content) {
    const hash = ContentHashStore.hashContent(content);
    return this.lastAckedMap.get(path) !== hash;
  }

  // Record that the manager has committed `path` at `hash`. Call
  // this only on tick-response `ok: true` per ADR 0005 §"Ack
  // semantics". On retryable failures the cursor stays where it is
  // so the next tick re-emits the same save.
  recordAck(path, hash) {
    if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) {
      throw new Error(
        `recordAck expects a sha256 hex string; got ${typeof hash === "string" ? `"${hash.slice(0, 12)}..."` : typeof hash}`,
      );
    }
    this.lastAckedMap.set(path, hash);
  }

  // Last-acked hash for a path, or undefined if never ack'd.
  // Useful for diagnostics — shouldn't normally drive save decisions
  // (use needsSave() instead, which compares against fresh content).
  lastAcked(path) {
    return this.lastAckedMap.get(path);
  }

  // Forget a path — used during tests and (eventually) when the
  // manager signals a teardown/replay scenario where the runtime
  // should re-emit everything.
  reset(path) {
    if (path === undefined) {
      this.lastAckedMap.clear();
    } else {
      this.lastAckedMap.delete(path);
    }
  }
}
