# Production Dockerfile

# Build image
FROM ubuntu:jammy as builder

# Need curl to install empirica, ca-certificates for the https connection
RUN apt-get update && apt-get install -y ca-certificates curl

WORKDIR /build

# Get empirica command
RUN curl https://get.empirica.dev | sh

COPY . .

# Bundle the app
RUN empirica bundle

# Final image
FROM alpine

WORKDIR /app

COPY --from=builder /build/deliberation.tar.zst .

EXPOSE 3000

ENTRYPOINT ["empirica", "serve", "deliberation.tar.zst"]
