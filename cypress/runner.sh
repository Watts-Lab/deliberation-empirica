#!/bin/bash

# starts the mock CDN server and the empirca server ready for testing

npx --yes serve fixtures/mockCDN/ -l 9091 &

cd ../etherpad
docker compose up &

cd ..
mkdir -p data
TEST_CONTROLS=enabled DATA_DIR=$(pwd)/data empirica --tajriba.store.file=$(pwd)/data/tajriba.json