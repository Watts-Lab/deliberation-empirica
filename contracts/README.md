# `@deliberation-lab/contracts`

Source-of-truth Zod schemas for the runtime's external interface — the surfaces a consumer (today the [manager](https://github.com/deliberation-lab/manager), tomorrow whatever else wants to observe or automate a deliberation-lab Instance) needs to speak.

## Why these live here, not in the manager

Each schema describes _this runtime's_ behavior — what env it reads, what it emits on the tick channel, what error codes it surfaces. Manager is a consumer of that interface, as any future tool will be. Schema-next-to-code affinity: a contributor adding a new tick field is editing runtime code; the schema is one directory over, not a cross-repo PR.

Decided in [issue #29](https://github.com/deliberation-lab/deliberation-lab/issues/29) and the manager's ADRs [0006](https://github.com/deliberation-lab/manager/blob/main/docs/decisions/0006-unified-tick-polling-first.md) and [0007](https://github.com/deliberation-lab/manager/blob/main/docs/decisions/0007-study-batch-distinction.md).

## Files

| File                  | What it defines                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tick.mjs`            | Runtime → manager tick payload (`sequence`, `status`, optional `save`, `state` snapshot, optional `errors[]`).                                                                                               |
| `tick-response.mjs`   | Manager → runtime tick response (`{ok, ackedSequence, commitSha?}` or `{ok: false, retryable, code, message}`).                                                                                              |
| `jwt.mjs`             | Per-Instance JWT claims the manager signs and the runtime verifies (`instance_id`, `batch_id`, `study_id`, `workspace_id`, `iat`, `exp`, `aud`, `scope`).                                                    |
| `env.mjs`             | Env-var set the manager injects at `serviceCreate`; the runtime reads at boot. Distinguishes manager-launched mode (`USE_MANAGER_SAVE=true`) from solo-dev mode.                                             |
| `errors.mjs`          | Structured error catalog tagged by actionable-by (researcher vs platform). Per-code `details` payloads feed the manager's friendly-error renderer.                                                           |
| `buckets.mjs`         | Participant-progression bucket names matching the runtime's `logPlayerCounts` logic; consumed by the tick payload's `state.participants` field.                                                              |
| `batch-config.mjs`    | Synthesized batch config the manager pushes into the runtime via Tajriba `addScopes(kind="batch")` at Instance startup. Subset of the historical `validateBatchConfig.ts`, minus fields the manager now owns. |

## Sync workflow with manager

This repo is the source of truth. Manager carries a synced copy at `manager/src/contracts/` plus a CI job that fetches `contracts/` from this repo's `main` and fails the build on drift.

1. PR against this repo first.
2. Once merged to `main`, open a small bump-the-copy PR in `manager` that copies the changed files.

## Versioning

Pre-1.0: assume any change is breaking. Producers and consumers are coupled at the same git SHA via the manager's `contract_version` check (image-tagging) and the drift gate. Once both sides have stabilized, semver this package.

## Testing

```
cd contracts && npm install && npm test
```

Tests are in `__tests__/` and exercise the happy-path plus rejection cases for each schema. They're not exhaustive — they exist to catch obvious regressions and document expected shapes.
