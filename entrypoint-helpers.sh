#!/bin/bash

# Functions sourced by entrypoint.sh, extracted so they can be unit-
# tested without running the full container boot path.
#
# Each function reads from env vars and writes its results to stdout,
# one item per line. The caller wraps the output in an array via
# `mapfile -t ARR < <(fn)`. Errors go to stderr and are signalled by
# a non-zero exit code.
#
# Tested by entrypoint-helpers.test.sh.

# Build the argument list for `empirica serve`. Mode-dependent:
#
# - Always: `--tajriba.store.file=<DATA_DIR>/tajriba_<TAG>_<SUBDOMAIN>.json`
#   so the on-disk Tajriba store is namespaced by image version + study
#   subdomain.
#
# - When USE_MANAGER_SAVE=true: also pass `--tajriba.auth.srtoken=<value>`
#   from the EMPIRICA_SRTOKEN env var. This overrides the hardcoded
#   srtoken in the bundled `.empirica/empirica.toml` (cobra+viper flag
#   precedence: flag > env > config). The manager mints a fresh srtoken
#   per Instance at `serviceCreate`; without this override every spawned
#   container would share the bake-time value.
#
#   In this mode EMPIRICA_SRTOKEN is required. Missing it indicates the
#   manager-spawn pipeline is misconfigured — fail fast rather than
#   start with a stale shared token.
#
# - When USE_MANAGER_SAVE is unset or false (solo-dev / isolated-instance
#   mode): no srtoken flag is added; empirica reads the bundled
#   `[tajriba.auth].srtoken` from the toml. EMPIRICA_SRTOKEN is ignored
#   in this mode, so legacy local development continues to work
#   regardless of the env's presence.
build_empirica_serve_args() {
  if [ -z "${DATA_DIR:-}" ]; then
    echo "ERROR: DATA_DIR is required (Tajriba state + export staging)." >&2
    return 1
  fi
  local data_dir="$DATA_DIR"
  local tag="${CONTAINER_IMAGE_VERSION_TAG:-}"
  local subdomain="${SUBDOMAIN:-}"
  echo "--tajriba.store.file=${data_dir}/tajriba_${tag}_${subdomain}.json"

  if [ "${USE_MANAGER_SAVE:-false}" = "true" ]; then
    # Defense in depth: `contracts/env.mjs` schema (consumed by the
    # node preflight in `server/src/preFlight/preFlightChecks.js`)
    # already requires EMPIRICA_SRTOKEN in manager mode per dl#124,
    # so this bash check should never fire in practice. Kept anyway
    # because this helper builds the `empirica serve` command line —
    # passing the flag without a value would silently produce a
    # malformed argument; failing here is a clearer surface.
    if [ -z "${EMPIRICA_SRTOKEN:-}" ]; then
      echo "ERROR: EMPIRICA_SRTOKEN is required when USE_MANAGER_SAVE=true (manager mints a per-Instance srtoken at serviceCreate)." >&2
      return 1
    fi
    echo "--tajriba.auth.srtoken=${EMPIRICA_SRTOKEN}"
  fi
}
