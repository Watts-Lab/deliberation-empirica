import { createHash } from "node:crypto";

// 60s tick scheduler. Spreads tick-arrival times across each minute
// via a per-Instance offset (`hash(INSTANCE_ID) % 60` seconds), per
// manager ADR 0006 §"Polling-first". Without the offset, every
// running Instance would tick at :00 of every minute and the
// manager would face a thundering-herd of incoming ticks each second.
//
// The scheduler owns:
//   - the timer lifecycle (start / stop / one-off tickOnce)
//   - the in-flight guard (a slow tick can't overlap the next firing)
//   - the offset computation
//
// It does NOT own the payload composition or the response handling
// — those live in the caller's `onTick` callback. Keeping the
// scheduler payload-agnostic lets the same instance drive the
// 60s steady-state cadence AND out-of-band immediate-emits for
// terminal errors / post-flight bursts (#11 issue body §3).

const DEFAULT_INTERVAL_MS = 60_000;

export class TickScheduler {
  constructor({
    instanceId,
    intervalMs = DEFAULT_INTERVAL_MS,
    onTick,
    setIntervalImpl = setInterval,
    clearIntervalImpl = clearInterval,
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
    logger = null,
  }) {
    if (!instanceId) {
      throw new Error("TickScheduler: instanceId is required");
    }
    if (typeof onTick !== "function") {
      throw new Error("TickScheduler: onTick callback is required");
    }
    this.instanceId = instanceId;
    this.intervalMs = intervalMs;
    this.onTick = onTick;
    this.setInterval = setIntervalImpl;
    this.clearInterval = clearIntervalImpl;
    this.setTimeout = setTimeoutImpl;
    this.clearTimeout = clearTimeoutImpl;
    this.logger = logger;
    this.intervalHandle = null;
    this.initialTimeoutHandle = null;
    this.inFlight = false;
    this.stopped = false;
  }

  // Per-Instance offset in milliseconds. Deterministic for the same
  // instanceId so a process restart lands on the same slot. Spreads
  // across 0..59999ms uniformly via the first byte of sha256(id).
  initialOffsetMs() {
    const buf = createHash("sha256").update(this.instanceId).digest();
    return (buf.readUInt8(0) % 60) * 1000;
  }

  start() {
    if (this.intervalHandle !== null || this.initialTimeoutHandle !== null) {
      return;
    }
    this.stopped = false;
    const offset = this.initialOffsetMs();
    this.initialTimeoutHandle = this.setTimeout(() => {
      this.initialTimeoutHandle = null;
      if (this.stopped) return;
      this.tickOnce().catch(() => {});
      this.intervalHandle = this.setInterval(
        () => this.tickOnce().catch(() => {}),
        this.intervalMs,
      );
    }, offset);
  }

  stop() {
    this.stopped = true;
    if (this.initialTimeoutHandle !== null) {
      this.clearTimeout(this.initialTimeoutHandle);
      this.initialTimeoutHandle = null;
    }
    if (this.intervalHandle !== null) {
      this.clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  // Fire one tick immediately, bypassing the schedule. Used for
  // out-of-band emissions (terminal errors, post-flight bursts).
  // Returns the onTick callback's resolution; surfaces "skipped" if
  // a previous tick is still in flight (in-flight guard prevents
  // payload overlap).
  async tickOnce() {
    if (this.inFlight) {
      this.logger?.warn?.(
        { instanceId: this.instanceId },
        "tick: skipped (previous in-flight)",
      );
      return { skipped: true };
    }
    this.inFlight = true;
    try {
      return await this.onTick();
    } catch (err) {
      this.logger?.warn?.(
        { instanceId: this.instanceId, err: err?.message ?? err },
        "tick: onTick threw",
      );
      return { error: err?.message ?? String(err) };
    } finally {
      this.inFlight = false;
    }
  }
}
