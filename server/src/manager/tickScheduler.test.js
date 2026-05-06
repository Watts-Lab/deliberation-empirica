import { describe, test, expect, vi } from "vitest";
import { TickScheduler } from "./tickScheduler.mjs";

// Build a controllable timer harness so tests don't need real
// timers. Each call to `setTimeout`/`setInterval` records the
// callback + delay; `tick(ms)` advances "virtual time" and fires
// callbacks whose deadlines have passed.
function makeFakeTimers() {
  let nowMs = 0;
  let nextHandle = 1;
  const timeouts = new Map(); // handle → { deadline, fn }
  const intervals = new Map(); // handle → { everyMs, nextDeadline, fn }

  const findNextEvent = (target) => {
    let best = null;
    timeouts.forEach((t, h) => {
      if (t.deadline <= target && (!best || t.deadline < best.deadline)) {
        best = { kind: "timeout", h, deadline: t.deadline, fn: t.fn };
      }
    });
    intervals.forEach((i, h) => {
      if (
        i.nextDeadline <= target &&
        (!best || i.nextDeadline < best.deadline)
      ) {
        best = { kind: "interval", h, deadline: i.nextDeadline, fn: i.fn };
      }
    });
    return best;
  };

  // Drain queued microtasks. The production scheduler's in-flight
  // guard relies on `inFlight = false` running after the previous
  // tickOnce's `await onTick()` resolves — that's a microtask
  // continuation, not synchronous, so the next tick's firing has
  // to wait for it to settle.
  const flushMicrotasks = async () => {
    for (let i = 0; i < 4; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
  };

  return {
    setTimeoutImpl: (fn, ms) => {
      const h = nextHandle;
      nextHandle += 1;
      timeouts.set(h, { deadline: nowMs + ms, fn });
      return h;
    },
    clearTimeoutImpl: (h) => timeouts.delete(h),
    setIntervalImpl: (fn, ms) => {
      const h = nextHandle;
      nextHandle += 1;
      intervals.set(h, { everyMs: ms, nextDeadline: nowMs + ms, fn });
      return h;
    },
    clearIntervalImpl: (h) => intervals.delete(h),
    advance: async (ms) => {
      const target = nowMs + ms;
      let nextEvent = findNextEvent(target);
      while (nextEvent) {
        nowMs = nextEvent.deadline;
        if (nextEvent.kind === "timeout") {
          timeouts.delete(nextEvent.h);
        } else {
          const i = intervals.get(nextEvent.h);
          if (i) i.nextDeadline += i.everyMs;
        }
        // eslint-disable-next-line no-await-in-loop
        await nextEvent.fn();
        // eslint-disable-next-line no-await-in-loop
        await flushMicrotasks();
        nextEvent = findNextEvent(target);
      }
      nowMs = target;
    },
  };
}

describe("TickScheduler.constructor", () => {
  test("requires instanceId and onTick", () => {
    expect(() => new TickScheduler({ onTick: () => {} })).toThrow(/instanceId/);
    expect(() => new TickScheduler({ instanceId: "i" })).toThrow(/onTick/);
  });
});

describe("TickScheduler.initialOffsetMs", () => {
  test("is deterministic for the same instanceId", () => {
    const a = new TickScheduler({ instanceId: "abc", onTick: () => {} });
    const b = new TickScheduler({ instanceId: "abc", onTick: () => {} });
    expect(a.initialOffsetMs()).toBe(b.initialOffsetMs());
  });

  test("falls in [0, 60_000)", () => {
    ["a", "b", "c", "very-long-instance-id-string"].forEach((id) => {
      const s = new TickScheduler({ instanceId: id, onTick: () => {} });
      const offset = s.initialOffsetMs();
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(60_000);
      expect(offset % 1000).toBe(0); // whole seconds
    });
  });

  test("different ids spread across the window", () => {
    const offsets = new Set();
    for (let i = 0; i < 60; i += 1) {
      const s = new TickScheduler({
        instanceId: `inst-${i}`,
        onTick: () => {},
      });
      offsets.add(s.initialOffsetMs());
    }
    // Far better than 1 (constant) — sha256's first byte mod 60 is
    // well-spread; expect at least ~30 distinct slots out of 60 ids.
    expect(offsets.size).toBeGreaterThan(30);
  });
});

describe("TickScheduler.start / stop", () => {
  test("fires onTick once after initialOffset, then on each interval", async () => {
    const onTick = vi.fn(async () => "ok");
    const timers = makeFakeTimers();
    const s = new TickScheduler({
      instanceId: "abc",
      intervalMs: 60_000,
      onTick,
      ...timers,
    });
    const offset = s.initialOffsetMs();
    s.start();

    // Before the offset elapses, no ticks.
    await timers.advance(offset - 1);
    expect(onTick).toHaveBeenCalledTimes(0);

    // After the offset, one tick.
    await timers.advance(1);
    expect(onTick).toHaveBeenCalledTimes(1);

    // Then every 60s.
    await timers.advance(60_000);
    expect(onTick).toHaveBeenCalledTimes(2);
    await timers.advance(60_000);
    expect(onTick).toHaveBeenCalledTimes(3);

    s.stop();
    await timers.advance(60_000);
    expect(onTick).toHaveBeenCalledTimes(3);
  });

  test("stop before the initial offset cancels the first tick too", async () => {
    const onTick = vi.fn();
    const timers = makeFakeTimers();
    const s = new TickScheduler({
      instanceId: "abc",
      onTick,
      ...timers,
    });
    s.start();
    s.stop();
    await timers.advance(120_000);
    expect(onTick).toHaveBeenCalledTimes(0);
  });

  test("start is idempotent — second call is a no-op", async () => {
    const onTick = vi.fn(async () => "ok");
    const timers = makeFakeTimers();
    const s = new TickScheduler({
      instanceId: "abc",
      onTick,
      ...timers,
    });
    s.start();
    s.start();
    s.start();
    const offset = s.initialOffsetMs();
    await timers.advance(offset);
    expect(onTick).toHaveBeenCalledTimes(1);
    await timers.advance(60_000);
    expect(onTick).toHaveBeenCalledTimes(2);
  });
});

describe("TickScheduler.tickOnce (out-of-band emit)", () => {
  test("fires immediately bypassing the schedule", async () => {
    const onTick = vi.fn(async () => "ok");
    const timers = makeFakeTimers();
    const s = new TickScheduler({
      instanceId: "abc",
      onTick,
      ...timers,
    });
    await s.tickOnce();
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  test("returns `{skipped: true}` when a previous tick is still in flight", async () => {
    let release;
    const inFlight = new Promise((r) => {
      release = r;
    });
    const onTick = vi.fn(async () => {
      await inFlight;
      return "ok";
    });
    const timers = makeFakeTimers();
    const s = new TickScheduler({
      instanceId: "abc",
      onTick,
      ...timers,
    });
    const first = s.tickOnce();
    const second = await s.tickOnce();
    expect(second).toEqual({ skipped: true });
    expect(onTick).toHaveBeenCalledTimes(1);
    release("done");
    await first;
  });

  test("captures onTick exceptions and continues running", async () => {
    const onTick = vi
      .fn()
      .mockImplementationOnce(async () => {
        throw new Error("boom");
      })
      .mockImplementationOnce(async () => "ok");
    const timers = makeFakeTimers();
    const s = new TickScheduler({
      instanceId: "abc",
      onTick,
      ...timers,
    });
    const first = await s.tickOnce();
    expect(first.error).toBe("boom");
    const second = await s.tickOnce();
    expect(second).toBe("ok");
  });
});
