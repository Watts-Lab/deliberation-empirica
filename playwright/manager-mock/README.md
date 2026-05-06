# Manager-mock harness

A Node-builtin HTTP server that implements the manager-side of the runtime↔manager tick contract. Symmetric to [`manager/tools/mock-runtime/`](https://github.com/deliberation-lab/manager/tree/main/tools/mock-runtime) — together they let either repo's contract surface be exercised without the other's process running.

## What it implements

| Endpoint | Behavior |
|---|---|
| `POST /api/instances/:id/tick` | The contract surface. Validates the `Authorization: Bearer ...` header, parses the body against [`contracts/tick.mjs`](../../contracts/tick.mjs), records the tick, returns a [`tick-response.mjs`](../../contracts/tick-response.mjs)-shaped reply. |
| `POST /control/enqueueAck` | Script the next reply as `{ok: true, ackedSequence, commitSha?}`. `ackedSequence` is required per `contracts/tick-response.mjs`. |
| `POST /control/enqueueRetry` | Script the next reply as a retryable failure. |
| `POST /control/enqueueDiscard` | Script the next reply as a non-retryable failure. |
| `GET /control/received` | List captured ticks (defensive copy). |
| `POST /control/reset` | Clear captured + canned state. |

## Test usage

From a test file under `playwright/`, import via a relative path:

```js
import { buildManagerMock } from "../manager-mock/index.mjs";

const mock = buildManagerMock({});
await mock.start();
// mock.url is now e.g. "http://127.0.0.1:54321"

// runtime ticks against `${mock.url}/api/instances/.../tick` ...

const ticks = mock.received();
expect(ticks).toHaveLength(N);

mock.enqueueRetry({ code: "RATE_LIMITED" });  // next reply
// `ackedSequence` is required (contract requirement on ok-branch).
mock.enqueueAck({ ackedSequence: 5, commitSha: "deadbeef" });

await mock.stop();
```

Bare-specifier imports (e.g. `from "@deliberation-lab/manager-mock"`) work only when the consuming package declares it as a dependency. The harness itself ships under `playwright/`, so most callers are tests in the same tree — relative paths are the path of least resistance.

## JWT verification modes

| Mode | Behavior |
|---|---|
| `decode-only` (default) | Decode + claim-validate against `contracts/jwt.mjs` + check `exp`. No signature verification. Useful when the test mints tokens in-process and the JWT path isn't the focus. |
| `hs256` | Full HS256 signature verification per [manager ADR 0010](https://github.com/deliberation-lab/manager/blob/main/docs/decisions/0010-jwt-key-distribution.md). Requires `secret` (Buffer or base64 string — manager injects base64). Enforces algorithm-confusion defense (rejects `alg: "none"` and any non-HS256 alg before HMAC-comparing). |
| `verify` | Decode + claims + exp via `verifyManagerToken` from `server/src/manager/jwtVerifier.mjs`. Will collapse with `hs256` once [#109](https://github.com/deliberation-lab/deliberation-lab/issues/109) lands the runtime-side HS256 verifier. |
| `skip` | Accept any non-empty token. |

```js
buildManagerMock({ jwtVerify: "hs256", secret: process.env.JWT_VERIFY_SECRET });
```

## Why a library, not a CLI

The mock-runtime harness on the manager side ships as both a library and a `tools/mock-runtime/` standalone runner. We don't have a compelling standalone-curl use case yet, so this side is library-only — instantiate from a test, scope to the test's lifetime. Add a runner if the need shows up.

## Tests

```
cd playwright/manager-mock
npm install     # one-time, picks up zod + vitest + the contracts file: dep
npm test
```

The harness's own tests exercise every route, the JWT branches (including HS256 alg-confusion defenses), the payload-schema branches, and the control surface. They're fast (~150ms total) so they're cheap to run alongside the contracts and server suites. CI runs them via `.github/workflows/manager_mock_vitest.yml`.
