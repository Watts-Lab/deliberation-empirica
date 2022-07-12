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

# curl to install empirica and upload data
# ca-certificates for the https connection
# jq for parsing javascript (tajriba.json)
# nano to facilitate small changes on the server
# cron to run the upload script
RUN apt-get update && apt-get install -y ca-certificates curl jq nano cron && \
  (curl https://get.empirica.dev | sh) && \
  apt-get remove --yes ca-certificates && \
  apt-get clean autoclean && \
  apt-get autoremove --yes && \
  rm -rf /var/lib/{apt,dpkg,cache,log}/

# add upload scripts and assign them execution permissions
COPY scripts /scripts
RUN chmod u+x /scripts/push_data.sh


WORKDIR /
COPY --from=builder /build/deliberation.tar.zst /app/deliberation.tar.zst
# For some reason, the config is not picked up if it's not first setup during
# the build, so we run server for a few seconds to let the settings settle.
RUN timeout --preserve-status 5s empirica serve /app/deliberation.tar.zst



# create a cron job to push data to the datastore repo every 15 mins
# ref: https://blog.thesparktree.com/cron-in-docker
COPY scripts/cron_push /etc/cron.d/
# give cron access to the environemnt variables
RUN env >> /etc/environment 
RUN /etc/init.d/cron start

EXPOSE 3000

ENTRYPOINT ["empirica", "serve", "/app/deliberation.tar.zst"]
