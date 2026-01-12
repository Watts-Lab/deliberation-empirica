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

## Notes

- The published images are currently `linux/amd64` only. On Apple Silicon, include `--platform=linux/amd64` (as shown above).
- `DATA_DIR` is required by the server preflight checks in all modes.
- The `:dev-*` tags are built with `TEST_CONTROLS=enabled` baked into the client bundle.
- The `:dev-*` tags can start a small static server on `:9090` for locally-served assets. Bind-mount your asset directory and set `ASSET_SERVER_DIR`.
- The container writes its Tajriba store file under `DATA_DIR`, so bind-mounting `/data` is the easiest way to access it from the host.
- If you need to override the server-side value of `TEST_CONTROLS` at runtime, you can add `-e TEST_CONTROLS=enabled|disabled`, but **client-side** behavior is determined at bundle build time.

If you need to disable the asset server, run with `-e START_ASSET_SERVER=disabled`.
