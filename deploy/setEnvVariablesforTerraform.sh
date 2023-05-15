#!/bin/bash

# call with . /setEnvVariablesforTerraform.sh <path to file with env vars>

while read line; do
    echo "TF_VAR_${line}"
    export "TF_VAR_${line}"
done < $1