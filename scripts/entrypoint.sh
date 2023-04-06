#!/bin/bash

echo "Starting cron for data extraction"
# move cron file to the correct folder
# this cron job pushes data to the datastore repo every 15 mins
# ref: https://blog.thesparktree.com/cron-in-docker
mv /scripts/cron_push /etc/cron.d/
mkdir /scripts/log
echo "Start of data upload log" > /scripts/log/data_push.log
# give cron access to the environemnt variables
env >> /etc/environment  
# start cron daemon
/etc/init.d/cron start

_term() {
  echo "Caught SIGTERM signal!"
  kill -TERM "$child" 2>/dev/null
}

trap _term SIGTERM
trap _term SIGINT

mkdir /data
mkdir /data/scienceData
mkdir /data/participantData
mkdir /data/paymentData 
mkdir /data/runtimeLogs

echo "Starting empirica"
empirica serve /app/deliberation.tar.zst | tee /data/runtimeLogs/empirica.log &


child=$!
wait "$child"
