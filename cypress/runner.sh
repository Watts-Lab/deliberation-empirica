#!/bin/bash

# starts the mock CDN server and the empirca server ready for testing

npx --yes serve fixtures/mockCDN/ -l 9091 &

cd ../etherpad
docker run -p 127.0.0.1:9001:80 -e DEFAULT_PAD_TEXT="Test etherpad default text" -e "APIKEY=doremiabc123babyyouandme" etherpad &

cd ..
mkdir -p data
TEST_CONTROLS=enabled DATA_DIR=$(pwd)/data empirica --tajriba.store.file=$(pwd)/data/tajriba.json