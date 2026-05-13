# Production Dockerfile
# 
# This is used by "register_containter_image.yaml" GH action to
# 1. build a production container image that will
# 2. be registered on GHCR and subsequently
# 3. used by terraform to deploy the app

# Build image
# -----------
FROM ghcr.io/empiricaly/empirica:build-v1.11.2 AS builder

WORKDIR /build
# Copy only the pieces needed to build the container.
# `contracts/` MUST come before `server/` because server/package.json
# declares `"@deliberation-lab/contracts": "file:../contracts"`. Without
# the contracts/ directory in the build context, `empirica npm install`
# can't resolve the file: link, and `empirica bundle` later fails to
# resolve `@deliberation-lab/contracts/{tick,jwt,...}` imports.
COPY contracts/ contracts/
COPY client/ client/
COPY server/ server/
COPY .empirica/ .empirica/

ARG BUNDLE_DATE
ARG SENTRY_AUTH_TOKEN
ARG TEST_CONTROLS

# TEST_CONTROLS is consumed by the client at build-time (via Vite "define"),
# so it must be present in the environment when we run `empirica bundle`.
ENV TEST_CONTROLS=${TEST_CONTROLS}

WORKDIR /build/.empirica
RUN sed -i.bak "s/BUNDLEDATE/${BUNDLE_DATE}/" empirica.toml

WORKDIR /build
RUN cat .empirica/empirica.toml

# install contracts dependencies
# Server's package.json links to `file:../contracts`; npm 7+ creates
# a symlink rather than copying, so when esbuild later bundles
# `server/src/manager/jwtVerifier.mjs` and follows the link to
# `../contracts/jwt.mjs`, it tries to resolve `zod` from contracts/.
# Without `npm install` in contracts/, that resolution fails. Same
# fix as `playwright_e2e.yml` carries; both bundle paths follow the
# symlink and need contracts/node_modules to exist.
#
# IMPORTANT: `npm install` must run BEFORE we set `NODE_ENV=production`
# below. With NODE_ENV=production, npm skips installing devDependencies
# — and Vite (the bundler `empirica bundle` invokes) lives in
# `devDependencies` for both client and server packages. Setting
# NODE_ENV before this step would leave us with `sh: vite: not found`
# at bundle time. Surfaced 2026-05-13 during docker-build CI run on
# dl#172.
WORKDIR /build/contracts
RUN empirica npm install

# install server dependencies
WORKDIR /build/server
RUN empirica npm install

# install client dependencies
WORKDIR /build/client
RUN empirica npm install

# Bundle the app
WORKDIR /build
# Vite bundling can exceed Node's default heap limit inside containers.
# Allow more heap so `empirica bundle` can complete on typical dev machines.
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Build-time NODE_ENV. Read by client/vite.config.mjs at config-eval
# time (BEFORE Vite's internal mode-setting); a custom `define` block
# in that file substitutes it as a literal `"production"` string into
# the client bundle, where Sentry.init's `enabled` gate reads it. If
# unset, the substitution falls back to `"development"` and the
# client bundle ships with Sentry disabled — silently. Set after the
# `npm install` steps (so devDeps including Vite are installed) and
# before `empirica bundle` (so the define substitution sees it). The
# final runtime image does NOT bake NODE_ENV (deployment context is
# the manager's job, per contracts/env.mjs `observability` schema).
ENV NODE_ENV=production
RUN empirica bundle



# Final image
# -----------
# Already in the base image:
# - curl to install empirica and upload data
# - ca-certificates for the https connection
# - rsync for for the server build step
#
# Need to install:
# - nano to facilitate small changes on the server
# - git (for eventually syncing stuff that way)

FROM ghcr.io/empiricaly/empirica:build-v1.11.2

ARG TEST_CONTROLS
ENV TEST_CONTROLS=${TEST_CONTROLS}

# Optional local asset server for dev containers.
# This is intended for experiment designers to serve their own assets locally.
# Defaults keep production behavior unchanged.
ARG INCLUDE_ASSET_SERVER=false
ARG START_ASSET_SERVER=disabled
ARG ASSET_SERVER_PORT=9090
ARG ASSET_SERVER_DIR=/assets

ENV INCLUDE_ASSET_SERVER=${INCLUDE_ASSET_SERVER}
ENV START_ASSET_SERVER=${START_ASSET_SERVER}
ENV ASSET_SERVER_PORT=${ASSET_SERVER_PORT}
ENV ASSET_SERVER_DIR=${ASSET_SERVER_DIR}

WORKDIR /

RUN apt-get update && \
  apt-get install -q -y --no-install-recommends \
    nano \
    git \
  && apt-get clean autoclean && \
  apt-get autoremove --yes && \
  rm -rf /var/lib/{apt,dpkg,cache,log}/

# Copy Volta binaries so it doesn't happen at every start.
COPY --from=builder /root/.local/share/empirica/volta /root/.local/share/empirica/volta

# copy the built experiment from the builder container
COPY --from=builder /build/deliberation-empirica.tar.zst /app/deliberation-empirica.tar.zst

COPY entrypoint.sh /scripts/entrypoint.sh
COPY entrypoint-helpers.sh /scripts/entrypoint-helpers.sh

EXPOSE 3000
# Port used by the optional asset server (dev image tags).
EXPOSE 9090

RUN if [ "$INCLUDE_ASSET_SERVER" = "true" ]; then \
    empirica npm install -g serve; \
  fi

CMD ["/scripts/entrypoint.sh"]