#!/bin/bash

echo "-------- builder.sh --------"

cwd=$(pwd)
echo "Base directory $cwd"

mkdir -p ${cwd}/data

echo "Building etherpad"
cd ${cwd}/etherpad

docker buildx build \
  --platform linux/amd64 \
  --tag deliberation-etherpad \
  --file Dockerfile \
  .
echo "Installing empirica"
cd $cwd
curl -fsS https://install.empirica.dev | sh

echo "Installing empirica dependencies"
cd $cwd/server 
empirica npm install

cd $cwd/client 
empirica npm install
