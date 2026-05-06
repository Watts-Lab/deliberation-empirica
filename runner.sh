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
# Local mock for the asset CDN. In dev, demos/annotated_demo/dev.config.json
# sets `assetBaseUrl: "http://localhost:9091"`, served by `npx serve` from
# `demos/`. Treatment paths are relative to that root — e.g. a batchConfig
# with treatmentFile=annotated_demo/demo.treatments.yaml resolves under it.
echo "Starting mock CDN server on port 9091 (in background)"
# `--cors` is necessary because the empirica server (3000) and CDN (9091)
# are cross-origin; without it, prompt/content fetches fail in-browser.
# `serve.json` in demos/ duplicates these headers as a backstop, but the
# explicit flag is the load-bearing piece — serve picks up its config
# from the directory it serves only when its cwd matches, and we run
# from `data/` here.
npx --yes serve --cors "$cwd/demos/" -l 9091 &

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
