# Manager

Runtime-side toolkit for the manager↔runtime tick channel — what the runtime
needs to participate in the manager-launched control plane (per
[manager interface-contract.md](https://github.com/deliberation-lab/manager/blob/main/docs/interface-contract.md)
and ADRs [0005](https://github.com/deliberation-lab/manager/blob/main/docs/decisions/0005-pass-through-data-flow.md)
/ [0006](https://github.com/deliberation-lab/manager/blob/main/docs/decisions/0006-unified-tick-polling-first.md)).
Everything here is gated on `USE_MANAGER_SAVE=true`; in solo-dev mode none of
this code runs and the legacy direct-Octokit save path
([`server/src/providers/github.js`](../providers/github.js)) keeps working.

The wire format the modules below cooperate on lives in
[`contracts/`](../../../contracts) — schemas (Zod `.mjs`) for ticks,
tick-responses, JWT claims, env vars, error catalog, progression buckets, and
the synthesized batch config. Both this side and the manager-side `src/contracts/`
import from the same source-of-truth.

## How a tick happens

```
ctx                       getCtxFn()                     ┌────────────┐
(Empirica)  ──────────────────────►  buildTickPayload  ──┤ tickPayload │── POST ─►  manager
   │                                       │             │ contract   │            (or harness)
   ▼                                       ▼             └────────────┘                │
summarizePlayerProgression           tickClient.send                                   │
(state/)                                   │                                           │
                                           ▼                                           │
                                  tickResponse (acked /                                │
                                  retry / discarded /  ◄────────────────────────────────┘
                                  fetch-failed)
                                           │
        ┌──────────────────────────────────┼─────────────────────────────────────┐
        │                                  │                                     │
        ▼                                  ▼                                     ▼
   advance sequence              hold sequence                  advance sequence + Sentry capture
   + per-path hash               (re-peek same                  (per interface-contract.md
   on next save                  payload next tick)             §"Error surfacing")
```

The 60s steady-state cadence runs through `tickScheduler`; out-of-band emits
(terminal errors, post-flight bursts) call `scheduler.tickOnce()` directly.

## Files

### State machines + stores

- `tickStatus.mjs` (+ tests) — Runtime-reportable lifecycle state machine.
  Four states (`running` / `draining` / `complete` / `failed`) with an explicit
  allowed-transition matrix. `complete` and `failed` are terminal; `draining`
  is one-way (no return to admitting). Throws on illegal transitions so a
  wiring bug surfaces at the assertion site rather than as drift later. The
  manager's full Instance state machine has more states (`preparing` /
  `provisioning` / `sealed` / `awaiting-teardown`) which are derived
  manager-side from runtime ticks plus capacity / verification gates; the
  runtime owns only the four it can directly observe.

- `contentHashStore.mjs` (+ tests) — Per-path sha256 dedup table for the
  multi-file post-flight burst (science / payment / preregistration /
  postFlightReport). Replaces the historical single `lastPushedHash` pattern
  in `providers/github.js`. `recordAck` rejects non-sha256 strings to catch
  caller bugs where someone passes content instead of the digest.

### Boundary I/O

- `jwtVerifier.mjs` (+ tests) — Boot-time decode + claim validation against
  [`contracts/jwt.mjs`](../../../contracts/jwt.mjs) + expiration check. Plus
  `assertInstanceMatch` cross-checks the JWT's `instance_id` against the env's
  `INSTANCE_ID` — catches a manager spawn-pipeline misinjection. Signature
  verification (HS256 + `JWT_VERIFY_SECRET` per
  [manager ADR 0010](https://github.com/deliberation-lab/manager/blob/main/docs/decisions/0010-jwt-key-distribution.md))
  is tracked separately in [#109](https://github.com/deliberation-lab/deliberation-lab/issues/109);
  until then the manager's own signature-verify on every received tick is the
  primary gate.

- `tickClient.mjs` (+ tests) — POSTs ticks to
  `${MANAGER_URL}/api/instances/${INSTANCE_ID}/tick` with the per-Instance JWT
  as a Bearer token. Validates the manager's response against
  [`contracts/tick-response.mjs`](../../../contracts/tick-response.mjs) and
  classifies into one of four outcomes:
  - `acked` — `ok: true`; advance sequence + per-path hash on the save.
  - `retry` — `ok: false retryable: true`; hold sequence, next tick re-peeks.
  - `discarded` — `ok: false retryable: false`; advance sequence + Sentry
    capture (the rejection is a runtime bug or upstream blip; the next tick
    won't repair the same payload).
  - `fetch-failed` — transport-level failure; same handling as `retry`.

  Outcome vocabulary mirrors `manager/tools/mock-runtime/src/tickClient.ts`
  so both sides of the contract use the same words. Pure I/O — the caller
  owns state transitions.

- `tickScheduler.mjs` (+ tests) — 60s `setInterval` with a deterministic
  per-Instance offset (`sha256(instanceId).readUInt8(0) % 60` seconds, per
  ADR 0006). The offset spreads tick-arrival times across each minute so the
  manager doesn't face a thundering-herd at `:00`. Owns the timer lifecycle,
  in-flight guard (a slow tick can't overlap the next firing), and offset
  compute. Stays payload-agnostic so the same instance drives both the
  steady-state cadence and out-of-band emits via `tickOnce()`.

### Composition

- `index.mjs` (+ tests) — Bootstrap. `initManagerRuntime({ getCtx })` reads
  env, decodes the JWT, instantiates the toolkit, returns a runtime handle.
  `getCtx` is invoked fresh on each tick so the callbacks-side wiring can
  supply the current Empirica `ctx` once it's available (`ctx` is passed to
  Empirica event handlers, not available at server start). `setCtx(newCtx)`
  is the in-process equivalent for callers that prefer to push.

  Composes `tickPayload` from the current sequence + status + state snapshot
  (via [`summarizePlayerProgression`](../state/summarizePlayerProgression.mjs)),
  validates against the contract schema, sends through the client, and
  applies the appropriate state transition based on outcome. On `discarded`
  also captures to Sentry with full instance/batch/study/workspace tags.

  Convenience accessors (`startTicking` / `stopTicking` / `setStatus` /
  `fireTickNow` / `getRuntime`) for the callbacks-side wiring.

## Currently uncalled

The toolkit ships in this PR but isn't yet wired into `callbacks.js`. Wiring
needs:

1. A `ctx`-capture point. `Empirica.on("batch", ctx, …)` is the earliest place
   ctx is available; the captured ctx is pushed into the runtime via
   `setCtx(ctx)`.
2. Status-transition hooks. `Empirica.on("batch", "status", …)` fires when the
   batch flips to `terminated`; that's the cue for `setStatus("draining")`.
   Once post-flight callbacks all complete and every tracked file is ack'd,
   `setStatus("complete")` — but the BL-14 verification protocol means the
   runtime should only emit `complete` after the hash store confirms every
   path has been ack'd at the latest content hash.
3. Save-channel migration off `pushDataToGithub`. The toolkit's `tickSave`
   payload is plumbed via `contentHashStore`; replacing the existing
   direct-Octokit push with a tick-channel save is a focused follow-up that
   touches `closeOutPlayer`, `exportScienceData`, and the post-flight
   helpers.

All three are tracked under [#11](https://github.com/deliberation-lab/deliberation-lab/issues/11).

### One batch per Instance — trust the manager

A design decision the wiring will inherit: under `USE_MANAGER_SAVE=true`,
the manager's policy is exactly one Empirica batch per Instance container
(per [manager interface-contract.md](https://github.com/deliberation-lab/manager/blob/main/docs/interface-contract.md);
the manager `serviceDelete`s and spawns a fresh Instance for the next
`Batch`). The runtime trusts this — no defensive assert against a second
`Empirica.on("batch")` event firing in manager mode. If the policy ever
breaks, the second batch attempting to `setStatus("running")` from
`complete` will throw via the TickStatus state machine's terminal-state
guard, which is the correct fail-fast: the manager messed up and the
runtime surfaces it loudly rather than carrying on with two batches'
worth of state confused under one Instance.

In solo-dev mode the toolkit isn't engaged (gated on the env flag), so
running multiple batches sequentially in one process keeps working as
it does today — no manager state machine in the loop.

## Testing

```
cd server && npx vitest run src/manager/
```

Each module has its own test file with the failure modes and contract
boundaries pinned independently. The fake-timer harness in
`tickScheduler.test.js` flushes microtasks between virtual-time advances so
the scheduler's in-flight guard is exercised correctly.

For end-to-end tests once `callbacks.js` wiring lands: the symmetric
[manager-mock harness](../../../playwright/manager-mock/) implements the
manager-side of the contract, so the full tick channel can be exercised
without a real manager process.
