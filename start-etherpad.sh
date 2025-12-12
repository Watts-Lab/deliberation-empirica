#!/bin/bash
set -euo pipefail

echo "-------- start-etherpad.sh --------"

cwd=$(pwd)
echo "Base directory ${cwd}"

ETHERPAD_DIR="${cwd}/etherpad"
IMAGE_NAME="deliberation-etherpad"
CONTAINER_NAME="deliberation-etherpad-dev"
LOGGER_PID=""
IMAGE_ALREADY_PRESENT=0

cleanup() {
  local exit_code=$?
  echo "Cleaning up Etherpad resources..."

  if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER_NAME}\$"; then
    docker stop "${CONTAINER_NAME}" >/dev/null 2>&1 || true
    docker rm "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  fi

  if [ "${IMAGE_ALREADY_PRESENT}" -eq 0 ] && docker image inspect "${IMAGE_NAME}" >/dev/null 2>&1; then
    docker rmi "${IMAGE_NAME}" >/dev/null 2>&1 || true
  fi

  if [ -n "${LOGGER_PID}" ] && ps -p "${LOGGER_PID}" >/dev/null 2>&1; then
    kill "${LOGGER_PID}" >/dev/null 2>&1 || true
  fi

  exit "${exit_code}"
}

trap cleanup EXIT
trap 'echo "Interrupted"; exit 130' INT

ensure_docker_cli() {
  if command -v docker >/dev/null 2>&1; then
    echo "Docker CLI is installed."
    return
  fi

  echo "Docker not found. Installing..."
  if ! curl -fsSL https://get.docker.com -o install-docker.sh; then
    echo "Failed to download Docker installation script. Exiting."
    exit 1
  fi

  if ! sh install-docker.sh; then
    echo "Failed to install Docker. Exiting."
    rm -f install-docker.sh
    exit 1
  fi

  echo "Docker installed successfully."
  rm -f install-docker.sh
}

wait_for_docker_daemon() {
  local attempts=0
  local max_attempts=30

  until docker info >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "${attempts}" -ge "${max_attempts}" ]; then
      echo "Docker daemon is not responding. Please start Docker manually and retry."
      exit 1
    fi
    echo "Waiting for Docker daemon to become ready..."
    sleep 2
  done
}

start_docker_daemon_if_needed() {
  if docker info >/dev/null 2>&1; then
    echo "Docker daemon is running."
    return
  fi

  echo "Docker daemon not running. Attempting to start it..."

  case "$(uname -s)" in
    Linux*)
      if command -v systemctl >/dev/null 2>&1; then
        if sudo systemctl start docker; then
          wait_for_docker_daemon
          return
        fi
      fi
      ;;
    Darwin*)
      if command -v open >/dev/null 2>&1; then
        open -a Docker || true
        wait_for_docker_daemon
        return
      fi
      ;;
  esac

  echo "Unable to start Docker automatically. Please start Docker and rerun this script."
  exit 1
}

build_image() {
  if docker image inspect "${IMAGE_NAME}" >/dev/null 2>&1; then
    IMAGE_ALREADY_PRESENT=1
    echo "Docker image ${IMAGE_NAME} already exists."
    return
  fi

  echo "Building ${IMAGE_NAME} image..."
  pushd "${ETHERPAD_DIR}" >/dev/null
  docker buildx build \
    --platform linux/amd64 \
    --tag "${IMAGE_NAME}" \
    --file Dockerfile \
    --load \
    .
  popd >/dev/null
}

start_container() {
  if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}\$"; then
    echo "Container ${CONTAINER_NAME} is already running."
    return
  fi

  if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}\$"; then
    echo "Removing stale container ${CONTAINER_NAME}."
    docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  fi

  echo "Starting Etherpad container (${CONTAINER_NAME}) on http://localhost:9001 ..."
  docker run -d \
    --platform linux/amd64 \
    --name "${CONTAINER_NAME}" \
    -p "127.0.0.1:9001:80" \
    -e DEFAULT_PAD_TEXT="Test_etherpad_default_text" \
    -e DB_TYPE=sqlite \
    -e DB_FILENAME=/opt/etherpad-lite/data/etherDB.sq3 \
    -e APIKEY=doremiabc123babyyouandme \
    "${IMAGE_NAME}" >/dev/null
}

stream_logs() {
  echo "Streaming Etherpad logs. Press Ctrl+C to stop and clean up."
  docker logs -f "${CONTAINER_NAME}" &
  LOGGER_PID=$!
  wait "${LOGGER_PID}"
}

ensure_docker_cli
start_docker_daemon_if_needed
build_image
start_container
stream_logs
