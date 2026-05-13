# Deploying the runtime on Railway

Recipe for spinning up a single instance of this runtime on [Railway](https://railway.com/) and running a real study through it. Targeted at one-off deployments — a parity test, a hackathon, a workshop run, a researcher who needs their own short-lived instance — where the full manager-based multi-tenant orchestration isn't wanted or doesn't exist yet.

For the eventual automated, multi-tenant deployment, see the [deliberation-lab/manager](https://github.com/deliberation-lab/manager) repo.

## When to use this

- You want to run this runtime on Railway for a bounded amount of time
- You already have a working production `.env` — either from the AWS deployment or a personal dev setup
- You're OK with one study per Railway service (multi-tenant is the manager's job, not this recipe)

## Prerequisites

- A Railway account with a workspace you can create projects in
- [Railway CLI](https://docs.railway.com/guides/cli) installed and authenticated (`railway login`)
- An `.env` file with production values for the runtime — see [default.env](../../default.env) for the shape
- This repo checked out locally (you'll deploy from your working tree)

## Step 1 — Create the Railway project and service

From the root of this repo:

```bash
railway init -n <project-name> -w "<your-workspace>"
railway add -s runtime
railway service runtime   # link so subsequent CLI calls default here
```

`<project-name>` can be anything — `deliberation-parity`, `my-pilot-study`, `hackathon-2026`. The service name `runtime` is a convention, not a requirement.

## Step 2 — Attach a persistent volume

Empirica writes `tajriba.json` and data files to disk. You want them on a volume so the runtime can survive a restart without losing state mid-study.

```bash
railway volume add -m /data
```

5 GB is the default and is plenty for all but the largest studies.

## Step 3 — Set the non-secret env vars

These values are specific to the deploy, not secrets:

```bash
railway variables --service runtime --skip-deploys \
  --set "DATA_DIR=/data" \
  --set "SUBDOMAIN=<slug>" \
  --set "CONTAINER_IMAGE_VERSION_TAG=<tag>" \
  --set "TEST_CONTROLS=disabled" \
  --set "BUNDLE_DATE=<date-or-sha>" \
  --set "INCLUDE_ASSET_SERVER=false" \
  --set "START_ASSET_SERVER=disabled" \
  --set "PORT=3000"
```

- `SUBDOMAIN` is used in the tajriba + data filenames (not the public URL); any lowercase slug works
- `CONTAINER_IMAGE_VERSION_TAG` and `BUNDLE_DATE` are recorded in the data export for reproducibility; use a git SHA, a date, or a memorable label
- **`PORT=3000` is required** — Railway's V2 runtime otherwise injects `PORT=8080` and routes its edge proxy to that port, but Empirica defaults to port 3000 and ignores the `PORT` env var (see [entrypoint.sh](../../entrypoint.sh), which calls `empirica serve` without an `--addr` flag). Without this override the proxy returns 502 even though the container is healthy.

## Step 4 — Set the secrets

Two options. Pick based on how much you trust the environment you're running the CLI in.

### Option A (safer, recommended for production secrets) — Railway dashboard

Open the service's **Variables** tab in the Railway dashboard and paste each `KEY=value` pair from your `.env`. Railway has a "Raw Editor" mode that accepts multi-line KV input. Secrets never touch a shell, never enter a process argv, never land in shell history.

This is the right choice if:

- You share the machine with anyone who might inspect running processes (`ps auxww` shows full argv for every process on the system)
- Your shell history is backed up or synced (cloud backups, dotfile repos) — command lines with expanded secrets would be captured
- The secrets have real production weight (prod Daily keys, long-lived machine-user tokens)

### Option B (convenience, acceptable for short-lived or low-sensitivity secrets) — CLI with `.env` expansion

For a quick personal deploy or a spike on a single-user workstation, source your `.env` into the shell and feed the values to Railway in one batch:

```bash
set -a; source .env; set +a

railway variables --service runtime --skip-deploys \
  --set "EMPIRICA_ADMIN_PW=${EMPIRICA_ADMIN_PW}" \
  --set "DAILY_APIKEY=${DAILY_APIKEY:-none}" \
  --set "QUALTRICS_API_TOKEN=${QUALTRICS_API_TOKEN:-none}" \
  --set "QUALTRICS_DATACENTER=${QUALTRICS_DATACENTER:-none}" \
  --set "ETHERPAD_API_KEY=${ETHERPAD_API_KEY:-none}" \
  --set "ETHERPAD_BASE_URL=${ETHERPAD_BASE_URL:-none}" \
  --set "DELIBERATION_MACHINE_USER_TOKEN=${DELIBERATION_MACHINE_USER_TOKEN:-none}"
```

The `${VAR:-none}` defaults let Railway accept vars that are missing from your `.env`; the runtime treats `"none"` as a sentinel for "provider disabled" (see [server/src/providers/](../../server/src/providers/)).

`EMPIRICA_ADMIN_PW` is deliberately not defaulted — leaving it unset would produce an unreachable admin console. Set it in your `.env` or pick a password.

**Caveat with Option B:** shell-var expansion happens at command-exec time, so the expanded secret values *do* appear in the `railway` process's argv and are visible to other users on the machine via `ps auxww` while the command is running. The literal command (with `${VAR}` unexpanded) is what lands in shell history, not the values — but that's small comfort if someone is running `ps`. If that's a concern in your environment, use Option A.

## Step 5 — Deploy

```bash
railway up --service runtime --ci
```

First build takes ~5–10 minutes (Railway pulls the Empirica base image, runs `empirica bundle`). Subsequent deploys hit layer cache and take 1–2 minutes.

## Step 6 — Generate a domain

```bash
railway domain --service runtime --port 3000 --json
```

Prints a `*.up.railway.app` URL. That's the participant-facing URL. The `--port 3000` flag is required — without it, the command errors with "error decoding response body."

## Step 7 — Smoke test

```bash
curl -sSL -o /dev/null -w "%{http_code}\n" https://<your-url>/admin
```

Expect `200` within ~60 seconds of the deploy finishing. If you get `502`, verify `PORT=3000` is set (Step 3 above).

Log into `/admin` with `EMPIRICA_ADMIN_PW`. Confirm the treatment file loads and the admin UI is functional.

## Step 8 — Daily.co domain allowlist

If your study uses video, the Railway domain needs to be in your Daily account's allowlist. Add `<your-url>` to your room-config allowlist before participants try to join, or Daily will reject the embedded WebRTC connection.

## Step 9 — Run the study

Use the admin UI as you normally would — create the batch, configure participants, launch. Data commits land in the GitHub repo you configured in Step 4 on the 60-second cadence, and Daily recordings stream to the S3 bucket configured in your Daily account.

## During the study: what to watch

- **Railway memory graph** (`railway metrics` or the dashboard). Empirica has a known intermittent fault beyond ~6 hours of uptime — if memory climbs unusually, proactively end the batch.
- **Sentry** for exceptions. New exceptions that weren't present in AWS runs may be Railway-specific; old ones are preexisting.
- **GitHub data repo** for commits appearing on the expected cadence.
- **Daily dashboard** for recording delivery.

## Teardown

When the study is done, export any remaining data from GitHub (or check that batch-close flush ran), then:

```bash
railway down --service runtime   # removes the latest deployment
# or from the dashboard: delete the service, then optionally delete the project
```

Deleting the project removes the service, volume, and domain together — preferable to leaving an empty project lying around.

## Known gotchas

### `PORT=3000` is mandatory

See Step 3. Railway V2 defaults to `PORT=8080`; Empirica ignores `PORT` and defaults to port 3000. Mismatched ports produce a silent 502 with no errors in container logs.

### Railway CLI's linked-project state is directory-scoped

`railway variables --set` and related commands fail with "No linked project found" if you run them outside the directory where `railway init` / `railway link` ran. If you get that error, `cd` into the right directory first.

### `railway volume add` sometimes panics

Running `railway volume add -m /data` without first linking the service via `railway service runtime` can trigger a Rust panic. Link the service first.

### Treatment `file:` paths must be treatment-file-relative

If your treatment YAML uses repo-root-relative paths (`file: projects/example/my-study/prompts/intro.prompt.md`), you'll get 403s on prompt fetches — the runtime now resolves `file:` relative to the treatment file's folder, and repo-root-style paths end up doubled in the CDN URL. Strip the prefix so paths become just `prompts/intro.prompt.md`, etc.

## Cost expectations

One always-on runtime service + 5 GB volume runs around $5–7 per month on Railway's Pro plan. Egress is metered separately; a video-heavy study may add a few dollars more. Delete the project when done to stop billing.

## What this recipe does not cover

- **Multi-tenant orchestration** — one service, one study. For automated spin-up / teardown and a researcher-facing dashboard, use the [manager](https://github.com/deliberation-lab/manager).
- **Custom domain** (`*.study.example.com`) — use Railway's default `*.up.railway.app` here; the manager will handle wildcard DNS + TLS for the multi-tenant case.
- **Programmatic Empirica control** — this recipe uses the default admin UI at `/admin`. The manager's researcher-facing dashboard replaces that interface via Tajriba GraphQL.
- **The pass-through data flow** — this recipe uses today's direct `DELIBERATION_MACHINE_USER_TOKEN` path to GitHub. The manager-based architecture replaces that with a per-study JWT POST to the manager.

See the manager repo for anything beyond the scope of this single-service deploy.
