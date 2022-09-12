# Production Dockerfile

# Build image
FROM ubuntu:jammy as builder

# Need curl to install empirica, ca-certificates for the https connection
RUN apt-get update && apt-get install -y ca-certificates curl rsync

WORKDIR /build

# Get empirica command
RUN curl https://install.empirica.dev | sh

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
FROM ubuntu:jammy

# curl to install empirica and upload data
# ca-certificates for the https connection
# jq for parsing javascript (tajriba.json)
# nano to facilitate small changes on the server
# cron to run the upload script
RUN apt-get update && apt-get install -y ca-certificates curl jq nano cron && \
  (curl https://install.empirica.dev | sh) && \
  apt-get remove --yes ca-certificates && \
  apt-get clean autoclean && \
  apt-get autoremove --yes && \
  rm -rf /var/lib/{apt,dpkg,cache,log}/

# add upload scripts and assign them execution permissions
COPY scripts /scripts
RUN chmod u+x /scripts/push_data.sh
RUN chmod u+x /scripts/entrypoint.sh

# copy the built experiment from the builder container
WORKDIR /
COPY --from=builder /build/deliberation.tar.zst /app/deliberation.tar.zst

# For some reason, the config is not picked up if it's not first setup during
# the build, so we run server for a few seconds to let the settings settle.
RUN timeout --preserve-status 5s empirica serve /app/deliberation.tar.zst || pkill empirica || :


EXPOSE 3000

ENTRYPOINT ["/scripts/entrypoint.sh"]
