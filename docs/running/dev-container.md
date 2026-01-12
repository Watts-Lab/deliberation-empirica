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

Run the container, binding the container data directory to your host so you can read logs/exports/Tajriba state files:

```bash
docker run --rm \
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

Then visit:

- Admin UI: `http://localhost:3000/admin`
- Participant UI: `http://localhost:3000/`

## Notes

- The published images are currently `linux/amd64` only. On Apple Silicon, include `--platform=linux/amd64` (as shown above).
- `DATA_DIR` is required by the server preflight checks in all modes.
- The `:dev-*` tags are built with `TEST_CONTROLS=enabled` baked into the client bundle.
- The `:dev-*` tags can start a small static server on `:9090` for locally-served assets. Bind-mount your asset directory and set `ASSET_SERVER_DIR`.
- The container writes its Tajriba store file under `DATA_DIR`, so bind-mounting `/data` is the easiest way to access it from the host.
- If you need to override the server-side value of `TEST_CONTROLS` at runtime, you can add `-e TEST_CONTROLS=enabled|disabled`, but **client-side** behavior is determined at bundle build time.

If you need to disable the asset server, run with `-e START_ASSET_SERVER=disabled`.
