#!/bin/bash

# Catch termination or interrupt signal and stop child processes
_term() {
  echo "Caught SIGTERM signal!"
  kill -TERM "$child" 2>/dev/null
}

trap _term SIGTERM
trap _term SIGINT

# Start Caddy
#   When we deploy to aws, we use the path study.deliberation-lab.org/etherpad 
#   to access etherpad. Our load balancer forwards traffic to etherpad if it 
#   sees `/etherpad*` in the path, but includes the `/etherpad` in the path
#   that it forwards to etherpad. So we use caddy to remove that `/etherpad`
#   from the path before forwarding to etherpad.
cd /scripts
echo "Starting caddy with file:"
echo "------------------"
cat Caddyfile
echo "------------------"
caddy validate
caddy run &

# Start Etherpad
echo ""
echo "Starting etherpad ..."
cd /opt/etherpad-lite
echo "better-sqlite3 found?"
ls src/node_modules/ | grep better-sqlite3
echo ${APIKEY} > APIKEY.txt
etherpad 

# keep this script alive while processes run in the background
child=$!
wait "$child"