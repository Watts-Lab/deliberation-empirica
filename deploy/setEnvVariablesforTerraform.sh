#!/bin/bash

# call with `. ./setEnvVariablesforTerraform.sh ../.empirica/.env`

while read line; do
    # echo "setting ${line} as"
    export "TF_VAR_${line}"
    export "${line}"
    echo $"TF_VAR_${line}"

done < $1