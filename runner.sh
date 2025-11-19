#!/bin/bash
# for running locally in dev mode
set -euo pipefail

echo "-------- runner.sh --------"

cwd=$(pwd)
echo "Working in $cwd"

echo "Cleaning up old data files"
mkdir -p "$cwd/data"
cd "$cwd/data"
rm -f tajriba.json
rm -f *.preregistration.jsonl
rm -f *.scienceData.jsonl
rm -f *.payment.jsonl
rm -f *.postFlightReport.jsonl
rm -rf participantData
rm -rf etherpad


# ----------- CDN -----------
echo "Starting mock CDN server on port 9091 (in background)"
npx --yes serve "$cwd/cypress/fixtures/mockCDN/" -l 9091 &

# ----------- Etherpad -----------
echo "Empirica runner no longer starts Etherpad automatically."
echo "Run 'npm run start:etherpad' in a separate terminal if you need the local Etherpad instance."

#----------- Empirica -----------
cd "$cwd"
echo ""
echo "Empirica version info:"
empirica version

echo ""
echo "Starting Empirica in development mode"
env $(cat .env) \
  BUNDLE_DATE="development" \
  TEST_CONTROLS=enabled \
  DATA_DIR="$cwd/data" \
  empirica \
  --tajriba.store.file="$cwd/data/tajriba.json" \
  2>&1 | tee "$cwd/data/empirica.log"
