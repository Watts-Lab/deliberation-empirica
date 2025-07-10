#!/bin/bash
# for running locally in dev mode

echo "-------- runner.sh --------"

cwd=$(pwd)
echo "Working in $cwd"

echo "Cleaning up old data files"
cd $cwd/data
rm tajriba.json
rm *.preregistration.jsonl
rm *.scienceData.jsonl
rm *.payment.jsonl
rm *.postFlightReport.jsonl
rm -rf participantData
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
  -e DB_TYPE=sqlite \
  -e DB_FILENAME=/opt/etherpad-lite/data/etherDB.sq3 \
  -e APIKEY=doremiabc123babyyouandme \
  deliberation-etherpad &

#----------- Empirica -----------

cd $cwd
empirica version

# Check for the .env file
if [ ! -f .env ]; then
  echo "❌ Error: .env file not found in $cwd. Please create one before running this script."
  exit 1
fi

env $(cat .env) \
  BUNDLE_DATE="development" \
  TEST_CONTROLS=enabled \
  DATA_DIR=$cwd/data \
  empirica \
  --tajriba.store.file=$cwd/data/tajriba.json \
  2>&1 | tee $cwd/data/empirica.log