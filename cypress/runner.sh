#!/bin/bash

# starts the mock CDN server and the empirca server ready for testing

npx --yes serve fixtures/mockCDN/ -l 9091 &
 
cd ..
TEST_CONTROLS=enabled DATA_DIR=$(pwd)/data empirica