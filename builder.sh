#!/bin/bash

echo "-------- builder.sh --------"

cwd=$(pwd)
echo "Base directory $cwd"

mkdir -p ${cwd}/data

echo "Building etherpad"
cd ${cwd}/etherpad

echo "Installing Docker if needed"
if ! docker -v &> /dev/null; then
    if ! curl -fsSL https://get.docker.com -o install-docker.sh; then
        echo "Failed to download Docker installation script. Exiting."
        exit 1
    fi
    if ! sh install-docker.sh; then
        echo "Failed to install Docker. Exiting."
        exit 1
    fi
    echo "Docker installed successfully."
    rm -f install-docker.sh
fi

echo "Building docker"
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
