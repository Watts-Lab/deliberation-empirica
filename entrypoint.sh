#!/bin/bash

echo "Setting empirica admin pw..."
sed -i 's/localpw/${EMPIRICA_ADMIN_PW}/' /.empirica/empirica.toml

_term() {
  echo "Caught SIGTERM signal!"
  kill -TERM "$child" 2>/dev/null
}

trap _term SIGTERM
trap _term SIGINT

echo "Starting empirica ..."
empirica serve /app/deliberation-empirica.tar.zst

child=$!
wait "$child"