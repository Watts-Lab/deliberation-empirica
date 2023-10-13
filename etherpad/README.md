# Etherpad instance

This folder contains code that modifies the standard etherpad docker container for our usage.

### Caddy

When we deploy to aws, we use the path study.deliberation-lab.org/etherpad
to access etherpad. Our load balancer forwards traffic to etherpad if it
sees `/etherpad*` in the path, but includes the `/etherpad` in the path
that it forwards to etherpad. So we use caddy to remove that `/etherpad`
from the path before forwarding to etherpad.

### settings.json

we set the default settings we want to use for etherpad
