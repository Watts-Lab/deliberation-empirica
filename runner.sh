#!/bin/bash

echo "-------- runner.sh --------"

cwd=$(pwd)
echo "Working in $cwd"

echo "Cleaning up old data files"
cd $cwd/data
rm tajriba.json
rm -rf participantData
rm -rf preregistrationData
rm -rf paymentData
rm -rf scienceData
rm -rf etherpad

# ----------- CDN -----------
echo "Starting mock CDN server on port 9091 (in background)"
npx --yes serve $cwd/cypress/fixtures/mockCDN/ -l 9091 &

# ----------- Etherpad -----------
echo "Starting etherpad in container on port 9001 (in background)"
cd $cwd/etherpad

docker run \
  --platform linux/amd64 \
  -p "127.0.0.1:9001:80" \
  -e DEFAULT_PAD_TEXT="Test_etherpad_default_text" \
  -e DB_FILENAME=/opt/etherpad-lite/data/etherDB.sq3 \
  -e APIKEY=doremiabc123babyyouandme \
  -v $cwd/data/etherpad:/opt/etherpad-lite/data \
  deliberation-etherpad &
# for some reason, this works if there is a volume mounted to the /data folder, otherwise fails with an error about not being able to find better-sqlite3

#----------- Empirica -----------

cd $cwd
empirica version

env $(cat .env) \
TEST_CONTROLS=enabled \
  DATA_DIR=$cwd/data \
  empirica \
  --tajriba.store.file=$cwd/data/tajriba.json