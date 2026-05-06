// Runtime-reportable lifecycle states for the manager↔runtime tick
// channel. Manager's full Instance state machine has more states
// (preparing / provisioning / sealed / awaiting-teardown) which are
// derived from runtime ticks plus capacity / verification gates;
// the runtime only owns the four it can directly observe.
//
// `complete` is contractual per manager ADR 0005: emitted only after
// every save has been ack'd AND post-flight is done. The runtime
// keeps re-emitting `status: complete` at the regular cadence until
// ack'd (in case the first one fails to land), but no new saves
// accompany them. Manager's BL-14 verification gate depends on this.

const VALID_STATES = ["running", "draining", "complete", "failed"];

// Allowed transitions. `running` is the boot state. `failed` is
// reachable from anywhere (unrecoverable error). `complete` is one-
// way and reachable from `draining` or directly (e.g. an empty batch
// that closes without admitting anyone). `draining` is reachable
// from `running` only — once a batch starts winding down, it
// doesn't go back to admitting.
const TRANSITIONS = {
  running: new Set(["draining", "complete", "failed"]),
  draining: new Set(["complete", "failed"]),
  complete: new Set([]),
  failed: new Set([]),
};

export class TickStatus {
  constructor(initial = "running") {
    if (!VALID_STATES.includes(initial)) {
      throw new Error(`Invalid initial status: ${initial}`);
    }
    this.status = initial;
  }

  current() {
    return this.status;
  }

  isTerminal() {
    return this.status === "complete" || this.status === "failed";
  }

  // Move to a new state; throws if the transition isn't allowed.
  // Idempotent: re-asserting the current state is a no-op.
  set(next) {
    if (!VALID_STATES.includes(next)) {
      throw new Error(`Invalid status: ${next}`);
    }
    if (next === this.status) return;
    if (!TRANSITIONS[this.status].has(next)) {
      throw new Error(
        `Invalid transition: ${this.status} → ${next}. Allowed from ${this.status}: [${[...TRANSITIONS[this.status]].join(", ")}]`,
      );
    }
    this.status = next;
  }
}

export const VALID_STATUS_VALUES = VALID_STATES;
export const ALLOWED_TRANSITIONS = TRANSITIONS;
