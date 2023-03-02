#!/bin/bash

# This script uploads science data files in .jsonl format to our private data repo.
# Any files with the extension `.jsonl` will be pushed, and updated every time
# the script runs, if they have changes.

# To test this script, set the following environment variables:
# - GH_DATA_REPO (format "Owner/repoName")
# - GH_BRANCH
# - GH_TOKEN (from GH machine user authorized to write to repo)
# - SCIENCE_DATA_DIR

shopt -s lastpipe # enables lastpipe

for entry in ${SCIENCE_DATA_DIR}/batch_*.jsonl
do
  [ -e $entry ] || continue  # if filename doesn't exist, continue
  echo "---- ${entry} ----"
  if [ ! -f $entry.numlines ]
  then
    echo "Creating new line count file ${entry}.numlines"
    echo "0" > $entry.numlines
  fi

  # get line length of tajriba.json
  cat $entry |
    wc -l |
    read currentLineLength  # save as varle using lastpipe (only works in bash)
  echo -n "has: ${currentLineLength} lines, "

  # read line length from last time this script was run
  cat $entry.numlines |
    read lastLineLength  # save as variable using lastpipe (only works in bash)
  echo "was ${lastLineLength}. "


  # only push to server if there have been changes
  # file is append-only, so we can see changes as new lienes
  if [ $currentLineLength -gt $lastLineLength ]
  then
    # check if file already exists in repo, branch
    curl \
        -H "Accept: application/vnd.github+json" \
        -H "Authorization: token ${GH_TOKEN}" \
        https://api.github.com/repos/${GH_DATA_REPO}/contents/scienceData/${entry}?ref=${GH_BRANCH} \
        > $entry.ghStatus

    cat $entry.ghStatus |
        jq -r '.sha' |
        read fileSHA


    if [ ${#fileSHA} -ge 10 ]  # if there is a SHA from a previous commit
    then
        echo "Updating: ${entry} on branch '${GH_BRANCH}'."
        cat $entry |
          jq --slurp --raw-input\
            --arg message "Updating ${entry} to ${currentLineLength} lines" \
            --arg branch "${GH_BRANCH}" \
            --arg name "deliberation-machine-user" \
            --arg email "james.p.houghton+ghMachineUser@gmail.com" \
            --arg sha "${fileSHA}" \
            '{message: $message, branch: $branch, committer:{name: $name, email: $email}, content: .|@base64 , sha:$sha}' \
          > $entry.PUT_BODY.json
    else
        echo "Creating: ${entry} on branch '${GH_BRANCH}'."
        cat $entry |
          jq --slurp --raw-input\
            --arg message "Creating ${entry} with ${currentLineLength} lines" \
            --arg branch "${GH_BRANCH}" \
            --arg name "deliberation-machine-user" \
            --arg email "james.p.houghton+ghMachineUser@gmail.com" \
            '{message: $message, branch: $branch, committer:{name: $name, email: $email}, content: .|@base64 }' \
          > $entry.PUT_BODY.json
    fi

    entry_basename=$(basename "$entry")

    # push to github
    # documentation here: https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents
    curl \
        --fail-with-body \
        -X "PUT" \
        -H "Accept: application/vnd.github+json" \
        -H "Authorization: token ${GH_TOKEN}" \
        https://api.github.com/repos/${GH_DATA_REPO}/contents/scienceData/${entry_basename} \
        -d @$entry.PUT_BODY.json > $entry.PUT_RESPONSE.json

    # $entry.PUT_RESPONSE.json

    echo $currentLineLength > $entry.numlines

else
    echo "Nothing to update."
fi

done
