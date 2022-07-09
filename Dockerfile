# Production Dockerfile

# Build image
FROM ubuntu:jammy as builder

# Need curl to install empirica, ca-certificates for the https connection
RUN apt-get update && apt-get install -y ca-certificates curl rsync

WORKDIR /build

# Get empirica command
RUN curl https://get.empirica.dev | sh

COPY . .

# install server dependencies
WORKDIR /build/server
RUN empirica yarn install

# install client dependencies
WORKDIR /build/client
RUN empirica yarn install

# Bundle the app
WORKDIR /build
RUN empirica bundle

# Final image
FROM ubuntu:jammy

# curl to install empirica
# ca-certificates for the https connection
# jq for parsing javascript (tajriba.json)
RUN apt-get update && apt-get install -y ca-certificates curl jq && \
  (curl https://get.empirica.dev | sh) && \
  apt-get remove --yes ca-certificates curl && \
  apt-get clean autoclean && \
  apt-get autoremove --yes && \
  rm -rf /var/lib/{apt,dpkg,cache,log}/

# Get empirica command
# RUN curl https://get.empirica.dev | sh

COPY --from=builder /build/deliberation.tar.zst /app/deliberation.tar.zst

# For some reason, the config is not picked up if it's not first setup during
# the build, so we run server for a few seconds to let the settings settle.
RUN timeout --preserve-status 5s empirica serve /app/deliberation.tar.zst

# set up a line length counter file for the data push script to use
RUN echo "0" > .empirica/local/tajribaLineCount.txt
EXPOSE 3000

ENTRYPOINT ["empirica", "serve", "/app/deliberation.tar.zst"]
