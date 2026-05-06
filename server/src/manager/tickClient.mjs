// POSTs ticks to ${MANAGER_URL}/api/instances/${INSTANCE_ID}/tick
// with the per-Instance JWT as a Bearer token. Returns a parsed
// response classifying the manager's reply into one of:
//
//   - acked         : ok=true; runtime advances sequence + per-path
//                     hash on the save (if any).
//   - retry         : ok=false, retryable=true; runtime leaves state
//                     untouched, next tick re-emits the same payload.
//   - discarded     : ok=false, retryable=false; runtime advances
//                     state but records the rejected payload for
//                     forensic inspection.
//   - fetch-failed  : transport-level failure (network, DNS,
//                     timeout); same handling as "retry".
//
// Mirrors the ack/retry semantics of manager/tools/mock-runtime/src/
// tickClient.ts so both sides of the contract use the same vocabulary.

import { tickResponse } from "@deliberation-lab/contracts/tick-response";

const TIMEOUT_MS_DEFAULT = 30_000;

export class TickClient {
  constructor({
    managerUrl,
    instanceId,
    instanceToken,
    fetchImpl = fetch,
    timeoutMs = TIMEOUT_MS_DEFAULT,
    AbortControllerImpl,
  }) {
    if (!managerUrl) throw new Error("TickClient: managerUrl is required");
    if (!instanceId) throw new Error("TickClient: instanceId is required");
    if (!instanceToken) {
      throw new Error("TickClient: instanceToken is required");
    }
    this.endpoint = `${managerUrl.replace(/\/+$/, "")}/api/instances/${instanceId}/tick`;
    this.token = instanceToken;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.AbortControllerImpl =
      AbortControllerImpl ??
      (typeof AbortController !== "undefined" ? AbortController : null);
  }

  // Send a tick payload. The caller is responsible for state
  // transitions (advance sequence on `acked`, hold on `retry`,
  // discard on `non-retryable`). This method is pure I/O —
  // no side effects on caller state.
  async send(payload) {
    const controller = this.AbortControllerImpl
      ? new this.AbortControllerImpl()
      : null;
    const timeout = controller
      ? setTimeout(() => controller.abort(), this.timeoutMs)
      : null;
    let res;
    try {
      res = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined,
      });
    } catch (err) {
      if (timeout) clearTimeout(timeout);
      // err can legally be any thrown value (including null/undefined);
      // optional-chain to message and fall through to String(err) so a
      // weird throw doesn't itself throw and mask the original failure.
      return {
        outcome: "fetch-failed",
        error: err?.message ?? String(err),
        sequence: payload.sequence,
      };
    }
    if (timeout) clearTimeout(timeout);

    let body = {};
    try {
      const text = await res.text();
      body = text.length > 0 ? JSON.parse(text) : {};
    } catch {
      // Non-JSON response — treat as a structured non-retryable
      // failure with a synthetic code so the caller can record what
      // happened without crashing.
      return {
        outcome: "discarded",
        sequence: payload.sequence,
        code: `http-${res.status}-non-json`,
        retryable: false,
        httpStatus: res.status,
      };
    }

    // Validate the response shape against the contract. A response
    // that doesn't parse is a contract violation — surface as
    // discarded so the runtime doesn't loop forever on garbage.
    const parsed = tickResponse.safeParse(body);
    if (!parsed.success) {
      return {
        outcome: "discarded",
        sequence: payload.sequence,
        code: "INVALID_TICK_RESPONSE",
        retryable: false,
        httpStatus: res.status,
        validationIssues: parsed.error.issues,
      };
    }
    const r = parsed.data;
    if (r.ok) {
      return {
        outcome: "acked",
        sequence: payload.sequence,
        ackedSequence: r.ackedSequence,
        commitSha: r.commitSha,
        httpStatus: res.status,
      };
    }
    if (r.retryable) {
      return {
        outcome: "retry",
        sequence: payload.sequence,
        code: r.code,
        message: r.message,
        httpStatus: res.status,
      };
    }
    return {
      outcome: "discarded",
      sequence: payload.sequence,
      code: r.code,
      message: r.message,
      retryable: false,
      httpStatus: res.status,
    };
  }
}
