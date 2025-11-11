#!/bin/bash
set -euo pipefail

echo "-------- builder.sh --------"

cwd=$(pwd)
echo "Base directory $cwd"

mkdir -p "${cwd}/data"

ENV_FILE="${cwd}/.env"
DEFAULT_ENV="${cwd}/default.env"

# Fetches the Empirica CLI if the developer hasn't installed it yet.
ensure_empirica_cli() {
  if command -v empirica >/dev/null 2>&1; then
    echo "Empirica CLI already installed."
    return
  fi

  echo "Empirica CLI not found. Installing..."
  if ! curl -fsS https://install.empirica.dev | sh; then
    echo "Failed to install Empirica CLI. Exiting."
    exit 1
  fi
}

# Creates .env if missing, preferring the checked-in default.env template.
ensure_env_file() {
  if [ -f "${ENV_FILE}" ]; then
    echo ".env already exists. Skipping creation."
    return
  fi

  if [ -f "${DEFAULT_ENV}" ]; then
    cp "${DEFAULT_ENV}" "${ENV_FILE}"
    echo "Created .env from default.env. Update it with real secrets before running production workloads."
  else
    cat <<'EOF' > "${ENV_FILE}"
DAILY_APIKEY=none
QUALTRICS_API_TOKEN=none
QUALTRICS_DATACENTER=none
ETHERPAD_API_KEY=none
ETHERPAD_BASE_URL=none
DELIBERATION_MACHINE_USER_TOKEN=none
EMPIRICA_ADMIN_PW=localpwd
TEST_CONTROLS=enabled
GITHUB_PRIVATE_DATA_OWNER=none
GITHUB_PUBLIC_DATA_OWNER=none
GITHUB_PRIVATE_DATA_REPO=none
GITHUB_PRIVATE_DATA_BRANCH=none
GITHUB_PUBLIC_DATA_REPO=none
GITHUB_PUBLIC_DATA_BRANCH=none
EOF
    echo "Created .env with local-safe defaults. Replace these with real values as needed."
  fi
}

ensure_env_file
ensure_empirica_cli

echo "Installing empirica dependencies for server/"
cd "${cwd}/server"
empirica npm install

echo "Installing empirica dependencies for client/"
cd "${cwd}/client"
empirica npm install
