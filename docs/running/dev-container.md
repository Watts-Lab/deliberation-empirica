# Running the dev container locally

This repo publishes a production container image (default) and a _dev-controls_ variant.

- **Production tags**: `:latest`, `:<BUNDLE_DATE>`
- **Dev-controls tags**: `:dev-latest`, `:dev-<BUNDLE_DATE>`

The dev-controls variant is the same bundled app, but it is **built with `TEST_CONTROLS=enabled`** so client-side dev/test controls are available.

## Prerequisites

- Docker installed and running

## Run the dev-controls image

Create a local directory for outputs:

```bash
mkdir -p ./data
```

Create a local directory (if you don't already have one) for your experiment assets (the dev container will serve these over the local CDN):

```bash
mkdir -p ./assets
```

`ASSET_SERVER_DIR` is the **path inside the container** that the asset server serves.

- In a bind mount like `-v "/some/host/path:/assets"`, `/assets` is the container path.
- `ASSET_SERVER_DIR` must match that container path (the part after the `:`).

Run the container, binding the container data directory to your host so you can read logs/exports/Tajriba state files:

```bash
docker run --rm \
  --name deliberation-dev \
  --platform=linux/amd64 \
  -p 3000:3000 \
  -p 9090:9090 \
  -v "$PWD/data:/data" \
  -v "$PWD/assets:/assets" \
  --env-file default.env \
  -e DATA_DIR=/data \
  -e ASSET_SERVER_DIR=/assets \
  -e TEST_CONTROLS=enabled \
  ghcr.io/watts-lab/deliberation-empirica:dev-latest
```

If you want to mount your assets read-only (recommended), use:

```bash
-v "$PWD/assets:/assets:ro"
```

Then visit:

- Admin UI: `http://localhost:3000/admin`
- Participant UI: `http://localhost:3000/`

## Stop the container

If you ran the container in the foreground (no `-d`) with `--rm`, stop it with:

- Press `Ctrl+C` in the terminal running `docker run`

If you ran the container in the background (with `-d`) and gave it a name (recommended), stop it with:

```bash
docker stop deliberation-dev
```

If you didn't name the container, you can stop it by ID:

```bash
docker ps
docker stop <container_id>
```

Notes:

- `--rm` removes the container after it stops.
- If you didn't use `--rm`, you can remove a stopped container with `docker rm <container_id_or_name>`.

## Troubleshooting

### Container name already in use

If you see an error like:

> Conflict. The container name "/deliberation-dev" is already in use

it means a container with that name already exists (it may be running, or it may be stopped but not removed).

Use one of these options:

```bash
# See whether it exists / whether it's running
docker ps -a --filter "name=deliberation-dev"

# Stop it (if running)
docker stop deliberation-dev

# Remove it so you can reuse the name
docker rm deliberation-dev

# Or: stop+remove in one step
docker rm -f deliberation-dev
```

### Shell line continuations

When copying multi-line commands, the backslash (`\`) must be the **last character on the line** (no trailing spaces), or your shell may interpret the command differently.

### Checking `DAILY_APIKEY`

The container prints a masked `Daily APIKEY:` line on startup.

If you ran detached (`-d`), you can also check the value directly:

```bash
docker exec deliberation-dev printenv DAILY_APIKEY
```

If `DAILY_APIKEY` is empty/missing, you likely forgot `--env-file default.env` (or forgot to set `-e DAILY_APIKEY=...`).

If your batch config has `checkAudio: true` and/or `checkVideo: true`, you generally need a real Daily API key to create video rooms.
For local designer testing without video checks, set `checkAudio`/`checkVideo` to `false` in your batch config.

### Checking the asset server

The easiest check is to create a known file in your host assets folder and `curl` it via the asset server.

```bash
echo "asset server ok" > ./assets/asset-server-check.txt
curl -fsS http://localhost:9090/asset-server-check.txt
```

If you want to confirm the CORS header is present (important when the app is served from `:3000`):

```bash
curl -fsS -I http://localhost:9090/asset-server-check.txt \
  | tr -d '\r' \
  | egrep -i 'HTTP/|access-control-allow-origin'
```

If this fails, double-check:

- The container is running and port `9090` is published (`-p 9090:9090`).
- Your bind mount points at the right host folder and the container path matches `ASSET_SERVER_DIR`.

## Notes

- The published images are currently `linux/amd64` only. On Apple Silicon, include `--platform=linux/amd64` (as shown above).
- `DATA_DIR` is required by the server preflight checks in all modes.
- The `:dev-*` tags are built with `TEST_CONTROLS=enabled` baked into the client bundle.
- The `:dev-*` tags can start a small static server on `:9090` for locally-served assets. Bind-mount your asset directory and set `ASSET_SERVER_DIR`.
- The container writes its Tajriba store file under `DATA_DIR`, so bind-mounting `/data` is the easiest way to access it from the host.
- If you need to override the server-side value of `TEST_CONTROLS` at runtime, you can add `-e TEST_CONTROLS=enabled|disabled`, but **client-side** behavior is determined at bundle build time.

If you need to disable the asset server, run with `-e START_ASSET_SERVER=disabled`.
