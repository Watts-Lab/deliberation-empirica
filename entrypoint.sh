#!/bin/bash

# Be strict about failing commands, but don't fail just because an optional env
# var isn't set (prod/dev environments may differ).
set -eo pipefail


# Catch termination or interrupt signal and stop child processes
child=""
asset_server_pid=""

_term() {
  echo "Caught SIGTERM signal!"
  if [ -n "$child" ]; then
    kill -TERM "$child" 2>/dev/null || true
  fi
  if [ -n "$asset_server_pid" ]; then
    kill -TERM "$asset_server_pid" 2>/dev/null || true
  fi
}

trap _term SIGTERM
trap _term SIGINT

mask_last4() {
  local value="${1:-}"
  if [ -z "$value" ]; then
    echo ""
    return
  fi

  local len=${#value}
  if [ "$len" -le 4 ]; then
    echo "****$value"
    return
  fi

  echo "****${value: -4}"
}

# Check environment variables
echo "Container Image Version Tag: ${CONTAINER_IMAGE_VERSION_TAG:-}"
echo "Subdomain: ${SUBDOMAIN:-}"
echo "Data Directory: ${DATA_DIR:-}"
echo "Test Controls: ${TEST_CONTROLS:-}"
echo "Qualtrics Datacenter: ${QUALTRICS_DATACENTER:-}"
echo "Daily APIKEY: $(mask_last4 "${DAILY_APIKEY:-}")"
echo "Qualtrics Token: $(mask_last4 "${QUALTRICS_API_TOKEN:-}")"
echo "Deliberation machine user github token: $(mask_last4 "${DELIBERATION_MACHINE_USER_TOKEN:-}")"

echo "Starting empirica ..."
echo "System empirica version:"
empirica version

# Dev-only helper: serve designer-provided assets inside the container.
# Typical usage is bind-mounting the host directory (e.g. "$PWD/assets") to
# ${ASSET_SERVER_DIR} and letting both browser and server-side code use the
# same localhost origin.
if [ "${START_ASSET_SERVER:-disabled}" = "enabled" ]; then
  asset_dir="${ASSET_SERVER_DIR:-/assets}"
  asset_port="${ASSET_SERVER_PORT:-9090}"

  if [ -d "$asset_dir" ]; then
    echo "Starting asset server on port ${asset_port}, serving ${asset_dir} ..."
    # Use Empirica-managed Node/Volta so we don't depend on `node` being on PATH.
    # `npm exec --package serve` ensures the binary is available even if it isn't on PATH.
    empirica npm exec --package serve -- serve -C -l "$asset_port" "$asset_dir" &
    asset_server_pid=$!
  else
    echo "Asset directory not found at ${asset_dir}; skipping asset server"
  fi
fi

empirica serve /app/deliberation-empirica.tar.zst --tajriba.store.file=$DATA_DIR/tajriba_${CONTAINER_IMAGE_VERSION_TAG}_${SUBDOMAIN}.json &
child=$!



wait "$child"