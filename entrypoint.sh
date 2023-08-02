#!/bin/bash


# Catch termination or interrupt signal and stop child processes
_term() {
  echo "Caught SIGTERM signal!"
  kill -TERM "$child" 2>/dev/null
}

trap _term SIGTERM
trap _term SIGINT

# Check environment variables
echo "Container Image Version Tag: $CONTAINER_IMAGE_VERSION_TAG"
echo "Data Directory: $DATA_DIR"
echo "Test Controls: $TEST_CONTROLS"
echo "Qualtrics Datacenter: $QUALTRICS_DATACENTER"
echo "Daily APIKEY: ****${DAILY_APIKEY: -4}"
echo "Qualtrics Token: ****${QUALTRICS_API_TOKEN: -4}"
echo "Deliberation machine user github token: ****${DELIBERATION_MACHINE_USER_TOKEN: -4}"

echo "Starting empirica ..."
empirica serve /app/deliberation-empirica.tar.zst --tajriba.store.file=$DATA_DIR/tajriba_$CONTAINER_IMAGE_VERSION_TAG.json 

# keep this script alive while empirica runs in the background
child=$!
wait "$child"