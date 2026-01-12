# Setup for Researchers (Recommended)

Use this guide if you want to **run Deliberation Lab locally** to design/test an experiment, without installing Node.js/Empirica.

This workflow runs the app from a published container image and lets you:

- Keep your experiment assets on your machine (served via a local CDN)
- Keep your study output data on your machine (written into a mounted `data/` folder)

If you want to develop or modify the Deliberation Lab codebase itself, see **Setup for Tool Developers**.

---

## 1. Install prerequisites

1. **Docker Desktop**
   - Install Docker Desktop and make sure Docker is running.
2. **Git** (recommended)
   - You only need Git if you want to clone/update the shared experiment assets repository.

---

## 2. Create a local workspace folder

Pick (or create) a folder on your machine for two things:

- **Data outputs** (Tajriba store, exports, logs)
- **Assets** (treatments, prompts, instructions, etc.)

Example:

```bash
mkdir -p ./delib-local/data
mkdir -p ./delib-local/assets
cd ./delib-local
```

---

## 3. Get experiment assets

If you use shared assets (recommended), clone the assets repo into your `assets/` folder:

```bash
git clone https://github.com/Watts-Lab/deliberation-assets.git ./assets
```

Your batch config may reference paths like:

- `projects/<study>/.../baseline.treatments.yaml`

Those files must exist under the mounted assets directory, because the container serves them at:

- `http://localhost:9090/projects/...`

---

## 4. Start the dev container

From your `delib-local/` folder (the one that contains `data/` and `assets/`), run:

```bash
docker run --rm \
  --name deliberation-dev \
  --platform=linux/amd64 \
  -p 3000:3000 \
  -p 9090:9090 \
  -v "$PWD/data:/data" \
  -v "$PWD/assets:/assets:ro" \
  --env-file /path/to/default.env \
  -e DATA_DIR=/data \
  -e SUBDOMAIN=local \
  -e CONTAINER_IMAGE_VERSION_TAG=local \
  -e ASSET_SERVER_DIR=/assets \
  ghcr.io/watts-lab/deliberation-empirica:dev-latest
```

Notes:

- On Apple Silicon, `--platform=linux/amd64` is required.
- Update `--env-file /path/to/default.env` to point at a real file on your machine.
  - You can start with the `default.env` from the `deliberation-empirica` repository.
  - For local testing, most values can remain `none`.

Then visit:

- Admin UI: `http://localhost:3000/admin`
- Participant UI: `http://localhost:3000/`

---

## 5. Verify assets are served

Quick check (expects your assets folder to contain `projects/`):

```bash
curl -fsS -I http://localhost:9090/projects/ | head -n 1
```

If you want a more explicit check, see **Running the Dev Container Locally**.

---

## 6. Common issues

### Resetting local state

The Tajriba store file is written into your mounted data directory. With the recommended env vars, the filename is:

- `data/tajriba_local_local.json`

To start fresh, stop the container and delete that file (or delete the whole `data/` folder contents).

### Video checks (Daily)

If your batch config sets `checkAudio: true` or `checkVideo: true`, you typically need a real `DAILY_APIKEY`.
For local designer testing without video, set `checkAudio`/`checkVideo` to `false`.

---

## Next steps

- Read **Running the Dev Container Locally** for mounting details, troubleshooting, and asset-server checks.
- See **Batch Configuration** for how to create batches and point them at `cdn: local`.
