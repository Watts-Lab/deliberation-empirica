# Production Dockerfile
# 
# This is used by "register_containter_image.yaml" GH action to
# 1. build a production container image that will
# 2. be registered on GHCR and subsequently
# 3. used by terraform to deploy the app

# Build image
# -----------
FROM ghcr.io/empiricaly/empirica:build-v1.8.11 AS builder

WORKDIR /build
# Copy only the pieces needed to build the container
COPY client/ client/
COPY server/ server/
COPY .empirica/ .empirica/

ARG BUNDLE_DATE

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

FROM ghcr.io/empiricaly/empirica:build-v1.8.11

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

CMD ["/scripts/entrypoint.sh"]