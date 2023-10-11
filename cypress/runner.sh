#!/bin/bash

# starts the mock CDN server and the empirca server ready for testing

echo "Runer working in $(pwd)"

echo "Starting mock CDN server on port 9091 (in background)"
npx --yes serve fixtures/mockCDN/ -l 9091 &

echo "Starting etherpad in container on port 9001 (in background)"
cd ../etherpad
#docker run -p 127.0.0.1:9001:80 -e DEFAULT_PAD_TEXT="Test etherpad default text" -e APIKEY=doremiabc123babyyouandme -e DB_FILENAME=/opt/etherpad-lite/data/etherDB.sq3 etherpad &
docker compose up -d

echo "Starting empirica on port 3000"
cd ..
mkdir -p data
TEST_CONTROLS=enabled DATA_DIR=$(pwd)/data empirica --tajriba.store.file=$(pwd)/data/tajriba.json