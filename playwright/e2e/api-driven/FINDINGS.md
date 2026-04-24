# API-driven control plane findings

**TL;DR: programmatically driving an Empirica study via Tajriba GraphQL is feasible for admin ops (create/start/stop batches, read state). "Simulating a participant" requires a real browser client — tajriba participants are not the same thing as empirica "players".**

Source: [`playwright/e2e/api-driven/test.spec.mjs`](./test.spec.mjs) — runs two tests against a real empirica instance:
- `api:` — pure API: create batch → register participants → snapshot → stop.
- `api+browser:` — admin via API, one participant via Playwright-driven browser; observes the full attribute surface as the participant progresses.

This answers the unknowns from [manager#2](https://github.com/deliberation-lab/manager/issues/2).

## Answers to manager#2 unknowns

| Unknown | Answer | Notes |
|---|---|---|
| Auth: does srtoken work for all management mutations? | ✅ yes for everything tested | `registerService(name, srtoken)` returns a session token; that token passes `addScopes`, `setAttributes`, `addParticipant`, `scopes` / `participants` queries. |
| Can we create a batch purely via GraphQL? | ✅ yes | `addScopes([{kind:"batch", attributes:[{key:"config", val: JSON.stringify({kind:"custom", config:{...}})}]}])`. Server's `Empirica.on("batch")` handler runs the same init (validate, fetch assetsRepoSha, set initialized) as when the admin UI creates a batch. |
| Batch lifecycle: start / end | ✅ yes | `setAttributes([{nodeID: batchId, key:"status", val: JSON.stringify("running")}])` starts dispatch. Same with `"terminated"` to close. No `pause` tested (probably possible — same mechanism). |
| Read-side: query batch status, per-player state, per-round state | ⚠️ partial — subtle gotcha | `scopes()` works and nests attributes. **Top-level `attributes(scopeID)` query panics with "not implemented" in tajriba 1.7** (see `attribute.resolvers.go:85`). Workaround: fetch through `scopes { attributes }` — which is what our helper does. |
| Trigger data export | ✅ via status transition | Setting `batch.status = "terminated"` runs `closeBatch` → `closeOutPlayer` for every player → writes preregistration + scienceData + payment JSONL + postFlightReport. No separate "export" mutation needed; the server reacts to status change. |
| Player admission | N/A via API alone | Participants come from browser flow; `addParticipant` via API creates only the tajriba-level record, not an empirica "player". See the tajriba-vs-player section below. |
| Tajriba history export | Not tested | Not needed for our test; tajriba has a `changes()` subscription + the on-disk `tajriba.json` if you need a full-state dump. |

## Tajriba participant ≠ empirica player

**This is the biggest finding, and it shapes what the control plane can and can't do solo.**

- **Tajriba participant**: a record in tajriba's auth system. Created by the `addParticipant` mutation. Has `id`, `identifier`, `createdAt`. Holds no experiment state.
- **Empirica "player" scope**: a much richer construct — a `Scope` with `kind="player"` and dozens of attributes (`connected`, `introDone`, `gameId`, `consent`, `progressLabel`, ...). Created by the empirica client-side runtime (`@empirica/core/player/classic/react`) when a browser connects. The server-side callbacks fire against these scopes.

So the control plane can fully drive the admin side (create, start, stop, observe) — but it cannot by itself simulate a participant going through a study. That needs either a real browser, or a headless implementation of the classic client. Neither is trivial.

For tests: the `api+browser:` test demonstrates the useful pairing — admin ops go through the API (fast), participant interactions stay in browsers (authentic).

## Attribute surface on a real player (observed)

After a browser participant completes ID form + consent + attention check + nickname + lobby-wait, then the batch is stopped, these 27 attributes are visible on their player scope via the API:

```
batchId               participantID         progressLabel
batchLabel            participantIdentifier setupSteps
browserInfo           paymentDataFilename   stageHistory
closedOut             timeArrived           urlParams
connected             timeIntroDone
connectionHistory     name
connectionInfo        intro
consent               introDone
duration_AttentionCheck
duration_consent
exitCodes
exitStatus
initialized
localTimeEnteredLobby
```

Attribute types seen:
- **Scalars**: `connected` (bool), `introDone` (bool), `exitStatus` (string), `timeArrived` (ISO string), `name` (string)
- **Objects**: `browserInfo`, `connectionInfo`, `participantData` (has `deliberationId`, `platformId`), `urlParams`
- **Arrays**: `consent` (list of consent items), `setupSteps` (event log), `stageHistory`, `connectionHistory`
- **Derived fields**: `progressLabel` (client-computed, useful for "where in the study is this player")

## Progression tracking

Helper `summarizePlayerProgression(client)` returns:

```js
{
  buckets: {
    completed: 0,        // exitStatus === "complete"
    inExitSequence: 0,   // gameFinished && connected
    inGame: 0,           // (gameId || assigned) && connected
    inLobby: 0,          // introDone && connected
    inCountdown: 0,      // inCountdown && connected
    inIntro: 0,          // connected (fallthrough)
    disconnected: 0,     // connected === false
    unknown: 0,
  },
  details: [ { id, bucket, attrs }, ... ]
}
```

Classification mirrors `server/src/utils/logging.js`'s `logPlayerCounts` so the test and server agree on what "in lobby" means.

Verified in `api+browser:` test — player classified as `inLobby` after going through intro, waiting for a second player.

## Performance notes

- Pure API test (create → start → add 2 participants → snapshot → stop): **~2.5s end-to-end**, of which ~500ms is actual API work and the rest is empirica bootstrap.
- Hybrid API+browser test (one participant through intro → lobby → close): **~15s**, dominated by the intro sequence typing/clicking.
- UI-only smoke (for comparison): **~13s**.
- So the win from API-driven admin ops is real but not dramatic *for a single test*. Where it matters: tests that run many batches back-to-back (setup in 500ms × N instead of 10s × N).

## Unresolved / follow-up

1. **Pause / resume batches**: not tested. Probably `setAttributes({status: "paused"})` but untried.
2. **Subscriptions (`changes`, `onEvent`, `scopedAttributes`)**: not tested. These are how the real `@empirica/core` client stays in sync; a long-lived control plane would prefer subscriptions over polling.
3. **Tajriba history / tajriba.json export via GraphQL**: not tested. File export is trivial in our setup (it's at `$DATA_DIR/tajriba.json`) but an orchestrator running on ephemeral containers would want a GraphQL path.
4. **Batch duplication / cloning**: UI has a "Duplicate" button; not verified that `addScopes` + copying attributes reproduces it.
5. **Server-driven intro skip for tests**: faster alternative to browser-driving is to mutate player attributes directly via `setAttributes` to simulate "player completed intro". Works in principle (classic runtime drives off these attributes), but would skip any client-side logic.

## How the built-in admin UI stays fresh (for the manager's dashboard)

Empirica's own admin console uses **GraphQL subscriptions over WebSocket**, not polling. Relevant details for when the manager wants to build a live dashboard on the same data:

- **Transport**: `graphql-ws` protocol (the `graphql-transport-ws` subprotocol, not the older `subscriptions-transport-ws`). Same port as the HTTP GraphQL endpoint, with a WebSocket upgrade at the same `/query` path.
- **Heartbeats**: `graphql-ws` handles ping/pong automatically. The tajriba client default is `connectionAckWaitTimeout: 5000ms`, `lazy: false` (connect eagerly), `retryAttempts: 10^10` (keep trying forever).
- **Auth**: passed via `connectionParams` on WebSocket open — `{ authToken: "Bearer <sessionToken>" }`. The sessionToken comes from whatever path you used to authenticate (see auth section below).

Four subscription types exist, each designed for a different observation pattern:

| Subscription | What it streams | Use when |
|---|---|---|
| `changes` | Diff objects — `AttributeChange` / `ParticipantChange` / `ScopeChange` / `StepChange` with a `done: bool` on the initial-sync completion | You want a normalized event log of everything. What `@empirica/core` uses internally to mirror state. |
| `scopedAttributes(input)` | Full `Attribute` objects (not diffs) within scopes matching a filter (by name/kind/id/attribute match) | You want to watch one scope tree — e.g. "this batch and its children." Good fit for a dashboard showing one study at a time. |
| `globalAttributes` | Attributes on the singleton "global" scope | Experiment-wide flags, config. |
| `onEvent` / `onAnyEvent` | Event objects for things that aren't attribute updates (`PARTICIPANT_CONNECT`, `PARTICIPANT_DISCONNECT`, `STEP_ADD`, etc.) | Reacting to lifecycle events, not state changes. |

**Recommendation for the manager**: use `scopedAttributes` filtered by `kind: "batch"` plus follow-on subscriptions per batch for its children (games, stages, players). Gives a per-batch state tree without flooding on experiment-wide noise. Poll-based `snapshot()` in the test helper here is fine for one-shot checks but would be wasteful in a live dashboard.

## Auth: how the manager should authenticate

**Three auth paths exist**, each producing a session token that subsequent requests pass in the `Authorization` header (or WebSocket `connectionParams.authToken`):

| Method | Input | Creates actor of type | When to use |
|---|---|---|---|
| `registerService(name, token)` | service name + shared secret (`srtoken`) | `Service` (admin-scope) | **Manager → Empirica.** Matches this helper's `connectAsAdmin`. |
| `login(username, password)` | admin creds from `[[tajriba.auth.users]]` in empirica.toml | `User` (admin-scope) | The built-in admin UI form. **Not recommended for manager** — it's human-facing. |
| `tokenLogin(token)` | PASETO-signed token | `User` | If you want PASETO-signed delegation. Not used in our setup. |
| `addParticipant(identifier)` | just an identifier | `Participant` (participant-scope) | Browser clients joining a study. Not for admin ops. |

**Answers to the specific sub-questions:**

1. **Where does empirica read the srtoken from?** `.empirica/empirica.toml` at process start, under `[tajriba.auth]` → `srtoken = "..."`. No env-var override — it's strictly file-read. (The Go binary owns this; not visible in node_modules.)

2. **Can the srtoken be rotated at runtime?** No — it's read once at boot. To rotate you'd need to restart the Empirica process with a new TOML. For short-lived instances (Railway containers), this is a non-issue — each instance gets a fresh srtoken at spawn.

3. **`registerService` vs `login` vs `tokenLogin`**: `registerService` is the clean programmatic path (service = machine actor). `login` is the interactive admin path. `tokenLogin` is a delegation path that takes a signed PASETO token instead of user creds; useful for IdP-integrated flows but overkill for us.

4. **Admin UI vs srtoken**: the built-in admin UI uses `login(username, password)` — the `admin` / `localpwd` from TOML. That's **separate** from the srtoken. If you want a manager-style dashboard, you use `registerService`, not `login`.

5. **Service / User / Participant / Actor roles**: `Actor = Service | User | Participant` as a GraphQL union. Admin-scope = `Service` or `User`. The distinction matters mostly for audit: `createdBy` on every scope/attribute is an `Actor`, so you can distinguish "what the manager changed" from "what the participant changed" in the history.

### Recommended approach for manager → Empirica auth

**Your instinct is correct**: generate a unique srtoken per instance at spawn time, seed the TOML, manager holds `{ instance_id → srtoken }` in its own store.

Concrete flow:

1. At container spawn (Railway): generate a 128-bit random string → `srtoken`. Write `empirica.toml` with `[tajriba.auth] srtoken = "<generated>"`. Start Empirica.
2. Manager records `{ instance_id, graphql_url, srtoken }` in its DB, keyed by the researcher / study that owns the instance.
3. When manager needs to talk to an instance:
   - Open a WebSocket to the instance's GraphQL endpoint.
   - On connect, call `registerService(name="manager", token=srtoken)` — returns `sessionToken`.
   - Use that session token in `connectionParams.authToken` for subscriptions, and in the `Authorization` header for mutations.
4. If the connection drops, reconnect and call `registerService` again with the same srtoken.

**Gotchas**:
- `registerService` is idempotent across connections — same srtoken always produces an admin session for "manager". But the **session token is per-connection**; it dies with the socket. Cache the srtoken, not the session token.
- The service name you pass to `registerService` is just for audit (shows up in `createdBy`). Pick something distinctive like `"manager-<region>"` so you can tell which manager instance created what if you ever run multiples.
- The srtoken ≠ the admin user password. Don't conflate them in secrets management. The admin password only matters if someone uses the built-in admin UI; if manager replaces that UI entirely, you can leave the admin user as a fallback or remove it.

## Conclusion for the manager spike

Yes, the admin UI can be replaced by programmatic calls for everything the control plane needs today: create batches, start/stop, observe state, trigger export. The `empiricaAdminAPI.mjs` helper in this repo is a working starting point — manager can import the same pattern (raw GraphQL over fetch, auth via `registerService`) without taking a dep on this package.

For **live** updates, drop polling in favor of the `scopedAttributes` subscription over WebSocket. Auth via per-instance srtoken seeded at spawn time.

The one thing the control plane **cannot** do alone is simulate a participant going through a study. That's a classic-runtime concern, not a tajriba one. For manager's use case (researcher-facing dashboard + orchestration, not test automation), this is a non-issue. For e2e testing, it's the reason hybrid tests remain useful.
