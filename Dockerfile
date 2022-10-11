# Production Dockerfile

# Build image
FROM ghcr.io/empiricaly/empirica:build-136 AS builder

WORKDIR /build

COPY . .

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
FROM ghcr.io/empiricaly/empirica:build-136

# Already in the base image:
# curl to install empirica and upload data
# ca-certificates for the https connection
# rsync for for the server build step

# jq for parsing javascript (tajriba.json)
# nano to facilitate small changes on the server
# cron to run the upload script
RUN apt-get update && \
  apt-get install -y --no-install-recommends \
    jq \
    nano \
    cron \
  && apt-get clean autoclean && \
  apt-get autoremove --yes && \
  rm -rf /var/lib/{apt,dpkg,cache,log}/

# add upload scripts and assign them execution permissions
COPY scripts /scripts

# Copy Volta binaries so it doesn't happen at every start.
COPY --from=builder /root/.local/share/empirica/volta /root/.local/share/empirica/volta

# Working dir at root, since that's where the cron_push script expects to find
# the .empirica folder.
WORKDIR /

# copy the built experiment from the builder container
COPY --from=builder /build/deliberation.tar.zst /app/deliberation.tar.zst

# For some reason, the config is not picked up if it's not first setup during
# the build, so we run server for a few seconds to let the settings settle.
# RUN timeout --preserve-status 5s /app/empirica serve /app/deliberation.tar.zst || pkill empirica || :

CMD ["/scripts/entrypoint.sh"]
