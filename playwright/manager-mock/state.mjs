// In-memory state for the manager-mock harness. Records every tick
// the runtime sends and decides what reply to send back. Symmetric
// to manager/tools/mock-runtime/src/state.ts (which records what the
// manager sent and decides what the runtime "saw"); the two harnesses
// together let either side be exercised in isolation.
//
// Reply behavior is scripted via a queue of canned responses. When the
// queue is empty, replies fall through to the default (ack with
// `ackedSequence` echoing the sent sequence). Tests push canned
// responses onto the queue to exercise retry / discard / fetch-error
// shapes without intricate stubbing.
//
// Captured ticks are immutable from the test's perspective —
// `received()` returns a defensive copy so a test that mutates one
// entry doesn't corrupt the harness's internal log.

const cloneTick = (tick) => ({
  payload: JSON.parse(JSON.stringify(tick.payload)),
  jwt: tick.jwt,
  receivedAt: tick.receivedAt,
});

export class ManagerMockState {
  constructor() {
    this.receivedTicks = [];
    this.cannedResponses = [];
    this.defaultResponse = {
      shape: "ackEcho", // built-in: ack with `ackedSequence` = sent sequence
    };
  }

  // Record an incoming tick. Returns the canned reply (or default-
  // shaped reply) that the server should send back.
  recordAndReply(payload, jwt) {
    this.receivedTicks.push({
      payload,
      jwt,
      receivedAt: Date.now(),
    });
    if (this.cannedResponses.length > 0) {
      return this.cannedResponses.shift();
    }
    return this.buildDefaultResponse(payload);
  }

  buildDefaultResponse(payload) {
    if (this.defaultResponse.shape === "ackEcho") {
      return {
        body: { ok: true, ackedSequence: payload.sequence },
        status: 200,
      };
    }
    return this.defaultResponse;
  }

  // Push a canned response for the next tick (FIFO). Caller passes
  // the literal {body, status} the server should send. Convenience
  // factories below cover the common shapes.
  enqueueResponse(response) {
    this.cannedResponses.push(response);
  }

  enqueueAck({ ackedSequence, commitSha } = {}) {
    // ackedSequence is required by contracts/tick-response.mjs on the
    // ok-branch — a reply without it would fail the runtime's
    // tickClient response-validation. Reject at the source so a
    // misshapen test fixture surfaces here rather than as an opaque
    // INVALID_TICK_RESPONSE on the runtime side.
    if (typeof ackedSequence !== "number" || ackedSequence < 0) {
      throw new Error(
        "enqueueAck requires `ackedSequence` (non-negative integer) per contracts/tick-response.mjs",
      );
    }
    const body = { ok: true, ackedSequence };
    if (commitSha !== undefined) body.commitSha = commitSha;
    this.enqueueResponse({ status: 200, body });
  }

  enqueueRetry({ code = "RATE_LIMITED", message } = {}) {
    this.enqueueResponse({
      status: 503,
      body: { ok: false, retryable: true, code, message },
    });
  }

  enqueueDiscard({ code = "RUNTIME_PROTOCOL_VIOLATION", message } = {}) {
    this.enqueueResponse({
      status: 400,
      body: { ok: false, retryable: false, code, message },
    });
  }

  // Returns a defensive copy of the received ticks. Tests assert
  // against this to verify what the runtime actually emitted.
  received() {
    return this.receivedTicks.map(cloneTick);
  }

  reset() {
    this.receivedTicks.length = 0;
    this.cannedResponses.length = 0;
  }
}
