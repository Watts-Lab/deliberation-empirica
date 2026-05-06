#!/bin/bash

# Unit tests for build_empirica_serve_args() in entrypoint-helpers.sh.
#
# Run with: bash entrypoint-helpers.test.sh
#
# Each test runs the function in a fresh subshell with a controlled
# environment; the surrounding shell's vars don't leak in. Failures
# print a diagnostic and exit 1.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=entrypoint-helpers.sh
. "${SCRIPT_DIR}/entrypoint-helpers.sh"

passed=0
failed=0

# Per-process unique tempdir so concurrent runs (parallel CI jobs,
# multiple local invocations) don't clobber each other's stderr file.
TEST_TMPDIR=$(mktemp -d -t entrypoint-helpers-test.XXXXXX)
trap 'rm -rf "${TEST_TMPDIR}"' EXIT

# run_with_env <env-string...> -- runs build_empirica_serve_args in a
# subshell with ONLY the given env vars set. Captures stdout, stderr,
# and exit code separately.
run_with_env() {
  local env_args=("$@")
  local stderr_file="${TEST_TMPDIR}/stderr"
  # `env -i` wipes the env; we then add only what the test set.
  # PATH is needed for `bash` itself.
  out=$(env -i PATH="$PATH" "${env_args[@]}" bash -c "
    set -u
    . '${SCRIPT_DIR}/entrypoint-helpers.sh'
    build_empirica_serve_args
  " 2>"${stderr_file}")
  exit_code=$?
  err=$(cat "${stderr_file}")
  : >"${stderr_file}"
}

assert_eq() {
  local desc="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then
    passed=$((passed + 1))
  else
    failed=$((failed + 1))
    echo "FAIL: $desc"
    echo "  expected: $(printf '%q' "$expected")"
    echo "  actual:   $(printf '%q' "$actual")"
  fi
}

assert_contains() {
  local desc="$1" haystack="$2" needle="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    passed=$((passed + 1))
  else
    failed=$((failed + 1))
    echo "FAIL: $desc"
    echo "  needle:   $(printf '%q' "$needle")"
    echo "  haystack: $(printf '%q' "$haystack")"
  fi
}

# ---------- solo-dev mode (no manager) -----------------------------

run_with_env DATA_DIR=/data CONTAINER_IMAGE_VERSION_TAG=v1.0.0 SUBDOMAIN=demo
assert_eq "solo: exits 0" "$exit_code" "0"
assert_eq "solo: emits exactly one arg (the store-file flag)" \
  "$out" "--tajriba.store.file=/data/tajriba_v1.0.0_demo.json"

run_with_env DATA_DIR=/data CONTAINER_IMAGE_VERSION_TAG=v1.0.0 SUBDOMAIN=demo USE_MANAGER_SAVE=false
assert_eq "USE_MANAGER_SAVE=false: same single-arg output" \
  "$out" "--tajriba.store.file=/data/tajriba_v1.0.0_demo.json"

# When USE_MANAGER_SAVE is unset/false, EMPIRICA_SRTOKEN is ignored —
# legacy local development continues to work even if the env happens
# to be set (e.g. left over from a prior manager-mode run).
run_with_env DATA_DIR=/data CONTAINER_IMAGE_VERSION_TAG=v1.0.0 SUBDOMAIN=demo EMPIRICA_SRTOKEN=stale
assert_eq "solo: EMPIRICA_SRTOKEN ignored when USE_MANAGER_SAVE not set" \
  "$out" "--tajriba.store.file=/data/tajriba_v1.0.0_demo.json"

# ---------- manager-launched mode ----------------------------------

run_with_env DATA_DIR=/data CONTAINER_IMAGE_VERSION_TAG=v1.2.3 SUBDOMAIN=study42 USE_MANAGER_SAVE=true EMPIRICA_SRTOKEN=srt-abc
assert_eq "manager: exits 0" "$exit_code" "0"
expected="--tajriba.store.file=/data/tajriba_v1.2.3_study42.json
--tajriba.auth.srtoken=srt-abc"
assert_eq "manager: emits both store-file and srtoken flags" "$out" "$expected"

# Missing EMPIRICA_SRTOKEN under manager mode is a hard fail — better
# than starting with a stale shared bake-time value.
run_with_env DATA_DIR=/data CONTAINER_IMAGE_VERSION_TAG=v1 SUBDOMAIN=demo USE_MANAGER_SAVE=true
assert_eq "manager without EMPIRICA_SRTOKEN: exits non-zero" "$exit_code" "1"
assert_contains "manager without EMPIRICA_SRTOKEN: error mentions the env var" \
  "$err" "EMPIRICA_SRTOKEN is required"

run_with_env DATA_DIR=/data CONTAINER_IMAGE_VERSION_TAG=v1 SUBDOMAIN=demo USE_MANAGER_SAVE=true EMPIRICA_SRTOKEN=
assert_eq "manager with empty EMPIRICA_SRTOKEN: exits non-zero" "$exit_code" "1"

# ---------- DATA_DIR is required in both modes ---------------------

run_with_env CONTAINER_IMAGE_VERSION_TAG=v1 SUBDOMAIN=demo
assert_eq "missing DATA_DIR: exits non-zero" "$exit_code" "1"
assert_contains "missing DATA_DIR: error mentions DATA_DIR" \
  "$err" "DATA_DIR"

# ---------- srtoken values with shell-special characters ----------

run_with_env DATA_DIR=/data CONTAINER_IMAGE_VERSION_TAG=v1 SUBDOMAIN=demo USE_MANAGER_SAVE=true 'EMPIRICA_SRTOKEN=tok with spaces'
assert_contains "srtoken with spaces: passed through verbatim" \
  "$out" "--tajriba.auth.srtoken=tok with spaces"

run_with_env DATA_DIR=/data CONTAINER_IMAGE_VERSION_TAG=v1 SUBDOMAIN=demo USE_MANAGER_SAVE=true 'EMPIRICA_SRTOKEN=tok"with"quotes'
assert_contains "srtoken with quotes: passed through verbatim" \
  "$out" '--tajriba.auth.srtoken=tok"with"quotes'

# ---------- summary -----------------------------------------------

echo ""
echo "passed: $passed"
echo "failed: $failed"
if [ "$failed" -gt 0 ]; then
  exit 1
fi
