#!/bin/bash

echo "Starting cron for data extraction"
# give cron access to the environemnt variables
env >> /etc/environment  
# start cron daemon
/etc/init.d/cron start
# move cron file to the correct folder
# this cron job pushes data to the datastore repo every 15 mins
# ref: https://blog.thesparktree.com/cron-in-docker
mv /scripts/cron_push /etc/cron.d/

echo "Starting empirica"
empirica serve /app/deliberation.tar.zst