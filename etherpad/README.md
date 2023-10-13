# Etherpad instance

This folder contains code that modifies the standard etherpad docker container for our usage.

### Caddyfile

When we deploy to aws, we use the path study.deliberation-lab.org/etherpad
to access etherpad. Our load balancer forwards traffic to etherpad if it
sees `/etherpad*` in the path, but includes the `/etherpad` in the path
that it forwards to etherpad. So we use caddy to remove that `/etherpad`
from the path before forwarding to etherpad.

We expose to the outside world port 80, but internally caddy will redirect this to 9001,
with the path rewriting.

### Dockerfile

Instead of working with the etherpad source directly, we work with the
official docker image. There are a few changes we need to make - one is to
install caddy, another is to install sqlite.

### Settings

We also adjust a few of the default settings, to streamline how the interface looks.

### entrypoint

We overwrite the default entrypoint in order to start both caddy and the etherpad server.
We also write the apikey to a file on startup from an environment variable. This means
we can set the environment variable on the container during deploy, rather than in the
image itself, which gets shared publicly.
