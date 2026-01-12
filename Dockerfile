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
# Copy only the pieces needed to build the container
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

EXPOSE 3000
# Port used by the optional asset server (dev image tags).
EXPOSE 9090

RUN if [ "$INCLUDE_ASSET_SERVER" = "true" ]; then \
    empirica npm install -g serve; \
  fi

CMD ["/scripts/entrypoint.sh"]