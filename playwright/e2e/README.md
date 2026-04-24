# Playwright full-stack e2e

Full-stack tests that spin up a real Empirica server (plus a per-test mock CDN)
and exercise flows that can't be tested at a lower layer.

Related issues: [#2](https://github.com/deliberation-lab/deliberation-lab/issues/2) (test suite architecture), [#9](https://github.com/deliberation-lab/deliberation-lab/issues/9) (this runner's scope).

## Run

```bash
npm run test:e2e          # headless
npm run test:e2e:headed   # watch browsers
npm run test:e2e:ui       # playwright ui mode
```

`globalSetup` builds the server bundle once before workers start. Each
worker then launches its own Empirica stack with `node dist/index.js`
(skipping rebuilds to avoid concurrent writes to `server/dist/`).

## Current tests

| File | What it covers |
|---|---|
| [smoke/test.spec.mjs](./smoke/test.spec.mjs) | 2-player happy path, admin UI-driven: admin creates batch → both participants run through ID form → consent → attention check → nickname → lobby dispatch → game submit → admin stops batch → assert scienceData JSONL has one row per participant with platform-populated keys |
| [api-driven/test.spec.mjs](./api-driven/test.spec.mjs) | Admin operations via Tajriba GraphQL instead of the admin UI. Two tests: pure-API (fast; no browsers) and hybrid (admin via API + one participant via browser, observing the player attribute surface). Doubles as the spike for [manager#2](https://github.com/deliberation-lab/manager/issues/2) — see [FINDINGS.md](./api-driven/FINDINGS.md). |

The smoke is deliberately minimal — one prompt, one submit, no video, no chat,
no survey — so a failure narrows to "does the stack wire up end-to-end?"
Other concerns get their own focused files.

For admin operations, prefer the API path ([`_helpers/empiricaAdminAPI.mjs`](./_helpers/empiricaAdminAPI.mjs)): 500ms to create + start + stop a batch vs. 5-10s clicking through the admin UI. The UI-driven path stays for tests where "does the admin UI still work" is the subject, not the scaffolding.

## Architecture

### One server per test file

Each `test.spec.mjs` owns its Empirica stack via `beforeAll` / `afterAll`.
Startup cost (~5-10s once the server bundle is prebuilt) is amortized
across whatever tests live in that file.

### Parallelism via worker-indexed ports

[`_helpers/ports.mjs`](./_helpers/ports.mjs) allocates a 10-port stripe
per Playwright worker using `process.env.TEST_WORKER_INDEX`:

| Port | Worker 0 | Worker 1 | Worker N |
|---|---|---|---|
| empirica (admin/proxy) | 3100 | 3110 | 3100 + N*10 |
| vite (client dev) | 8900 | 8910 | 8900 + N*10 |
| tajriba (graphql) | 4800 | 4810 | 4800 + N*10 |
| cdn (mock fixtures) | 9100 | 9110 | 9100 + N*10 |
| mock external APIs | 9200 | 9210 | 9200 + N*10 |

The stripe starts clear of default dev ports (3000/8844/4737/9091) so a
`npm run start` session doesn't collide with worker 0.

Per-worker isolation is enforced by:

- **Per-worker tajriba file** inside the scratch dir — not shared. (`--tajriba.store.mem` looked tempting but breaks empirica's service-account bootstrap: the session token never gets written.)
- **Per-worker `--callbacks.sessionTokenPath`** so each callbacks process authenticates against its own tajriba.
- **`CDN_TEST_URL`** injected into the empirica env, so a batch config with `cdn: "test"` resolves to this worker's mock CDN port. (The server's zod schema constrains `cdn` to `"test" | "prod" | "local"`, so direct URLs in the batch config don't validate.)
- **Explicit `--url` + `--sessionTokenPath` + `--token=<srtoken>` on the callbacks devcmd** — empirica doesn't forward those to the callbacks process when the devcmd is overridden, and `server/src/index.js` defaults to `http://localhost:3000/query` without them.

### Fixtures per test folder

```
playwright/e2e/
  _helpers/
    ports.mjs            # port stripe per worker
    empiricaServer.mjs   # launchStack({ workerIndex, fixtureDir })
    globalSetup.mjs      # builds server/dist once before workers start
  smoke/
    fixtures/
      study.treatments.yaml
      hello.prompt.md
    test.spec.mjs
```

The fixture folder is served over HTTP as the "test" CDN for this test.
Co-locating treatment YAML + prompt/debrief files as the unit of work is
the point — `git mv`-ing or deleting a single folder is an atomic
test-surface change.

### Cleanup

`stop()` kills the whole process group (empirica + its vite/callbacks
children, and the CDN's npx wrapper). Empirica doesn't propagate SIGTERM
to its children, so `detached: true` + `process.kill(-pid, signal)` is
needed to kill the tree. Set `E2E_KEEP_SCRATCH=1` to preserve the scratch
dir (with the tajriba file, JSONL exports, and participant data) for
post-mortem inspection.

### External-provider mock

[`_helpers/mockExternalServer.mjs`](./_helpers/mockExternalServer.mjs) is
an in-process Node HTTP server that stands in for GitHub / Daily / etc.
when the server makes outbound calls. It's spawned per worker on a
stripe port; the server's provider modules read `GITHUB_API_BASE_URL` /
`DAILY_API_BASE_URL` from env and point there.

```js
stack.mock.recorded // array of {provider, method, path, query, body, responseStatus}
stack.mock.reset()  // clear recorded + any stateful fixture data between tests
```

**Design principle**: handlers validate inputs against each provider's
public API spec (per their REST docs), *not* mirror what our code
happens to send. If our code sends something the real API would reject,
the mock rejects it the same way — that gives us an independent
conformance check, not a tautology.

To add a new endpoint:
1. Read the provider's REST doc for the endpoint.
2. Add a pattern to the `*_PATH_PATTERNS` array — enforce required
   headers/body fields per the spec.
3. Return the real response shape (status + body).
4. Only add endpoints when a test actually needs them — no speculative
   coverage.

Currently implemented:
- **GitHub**: `GET /rate_limit`, `GET /repos/:o/:r/git/ref/:ref`,
  `GET /repos/:o/:r/contents/:path`, `PUT /repos/:o/:r/contents/:path`
- **Daily**, **Qualtrics**, **Etherpad**: not yet implemented. Add as
  tests need them.

## What belongs here

Filter: "can this be tested at a lower layer?" If yes, it goes there.
e2e is the *only* layer that hits:

1. **Data-export shape end-to-end** (covered by smoke today)
2. **Batch lifecycle** — create → start → player joins → close → JSONL emitted, GitHub push called
3. **Group formation under contention** — dispatch wait timeouts, multi-player-join racing, treatment eligibility
4. **Session resumption** — player refreshes mid-stage; timers, stageHistory, progressLabel reconciliation
5. **Dropout → check-in → ReportMissing flow** — multi-system, timing-sensitive
6. **Invalid-config rejection at batch creation** — server validation path end-to-end
7. **Refusal paths** — browser-compat block, consent decline, attention-check failure producing specific logs/state

Not e2e:
- Markdown rendering → stagebook
- Chat reactions → Playwright CT
- `participantInfo.name` resolution → vitest (done)
- Video call join → Playwright CT (done, 101 tests)
- SharedNotepad iframe params → Playwright CT

## Writing a new e2e file

1. `mkdir playwright/e2e/<concern>/fixtures`
2. Drop a `study.treatments.yaml` + any referenced prompt/debrief files into `fixtures/`
3. Copy `smoke/test.spec.mjs` as a starter, trim what you don't need
4. Keep each test ≤30 lines; keep the file focused on one concern

Anti-pattern: the 800-line omnibus that tells you "something between line 1
and line 800 broke." If you're writing more than ~3 tests per file,
split the concern.

## Known quirks (non-blocking)

- Empirica logs `"player: command failed, restarting"` during startup. The
  admin UI still works; this appears to be a benign vite startup race.
- Empirica logs `"http: request method or response status code does not
  allow body"` once per stack. Doesn't affect behavior.
