#!/bin/bash

# This script uploads tajriba.json to our private data repo.
# Each time empirica is updated, a new tajriba.json is created
# so we upload a different file for each new system setup.
# The filename for the new file is based on the timestamp of the
# empirica setup.

# To test this script, set the following environment variables:
# - GH_DATA_REPO (format "Owner/repoName")
# - GH_BRANCH 
# - GH_TOKEN (from GH machine user authorized to write to repo)

shopt -s lastpipe # enables lastpipe

now=$(date +"%D %T")
echo -n "$now "

# if there is not already a file to stash the previous file length,
# create one and set it to zero
if [ ! -f /scripts/tajribaLineCount.txt ]
then
    echo -n "Creating new tajribaLineCount file."
    echo "0" > /scripts/tajribaLineCount.txt
fi

# get line length of tajriba.json
# TODO: use file size instead of line length to be robust to encryption
cat "/.empirica/local/tajriba.json" |
    wc -l |
    read currentLineLength  # save as varle using lastpipe (only works in bash)
echo -n "tajriba.json: ${currentLineLength} lines, "

# read line length from last time this script was run
cat /scripts/tajribaLineCount.txt |
    read lastLineLength  # save as variable using lastpipe (only works in bash)
echo -n "was ${lastLineLength}. "

# only push to server if there have been changes
# tajriba.json is append-only, so we can see changes as new lienes
if [ $currentLineLength -gt $lastLineLength ]
then
    # get empirica system boot time
    cat /.empirica/local/tajriba.json |
        grep system | # look for the row where empirica system is set up
        jq '.obj' |
        jq '.createdAt' | # get the time of the system creation entry
        sed 's/:/-/g' |  # replace `:` with `-`
        sed 's/["]//g' |  # remove `"`
        sed 's/[.].*//g' | # get rid of everything after the `.` in the timestamp
        read loadTime  # save as variable using lastpipe (only works in bash)
    #echo -n "Empirica started at ${loadTime}."

    outfileName="tajriba_${loadTime}.json"

    if [ -f /scripts/fileSHA.txt ]  # if there is a SHA from a previous commit
    then
        cat /scripts/fileSHA.txt | read fileSHA  # load previous sha into a variable
        echo "Updating: ${outfileName} on branch '${GH_BRANCH}'."
        jq -n \
          --arg message "pushing ${currentLineLength} lines to ${outfileName}" \
          --arg branch "${GH_BRANCH}" \
          --arg name "deliberation-machine-user" \
          --arg email "james.p.houghton+ghMachineUser@gmail.com" \
          --arg content $(base64 -w 0 /.empirica/local/tajriba.json) \
          --arg sha "${fileSHA}" \
          '{"message": $message, "branch": $branch, "committer":{"name": $name, "email": $email}, "content":$content, "sha":$sha}' > /scripts/PUT_BODY.json
        #echo {"message":"pushing ${currentLineLength} lines to ${outfileName}","branch":"${GH_BRANCH}","committer":{"name":"deliberation-machine-user","email":"james.p.houghton+ghMachineUser@gmail.com"},"content":"$(base64 -w 0 /.empirica/local/tajriba.json)","sha":${filesha}}` > /scripts/PUT_BODY.json
        #echo '{"message":"pushing '"$currentLineLength lines to $outfileName"'","branch":"'$GH_BRANCH'","committer":{"name":"deliberation-machine-user","email":"james.p.houghton+ghMachineUser@gmail.com"},"content":"'"$(base64 -w 0 /.empirica/local/tajriba.json)"',"}' > /scripts/PUT_BODY.json
    else
        echo "Creating: ${outfileName} on branch '${GH_BRANCH}'."
        jq -n \
          --arg message "pushing ${currentLineLength} lines to ${outfileName}" \
          --arg branch "${GH_BRANCH}" \
          --arg name "deliberation-machine-user" \
          --arg email "james.p.houghton+ghMachineUser@gmail.com" \
          --arg content $(base64 -w 0 /.empirica/local/tajriba.json) \
          '{"message": $message, "branch": $branch, "committer":{"name": $name, "email": $email}, "content":$content}' > /scripts/PUT_BODY.json
        #echo `{"message":"pushing ${currentLineLength} lines to ${outfileName}","branch":"${GH_BRANCH}","committer":{"name":"deliberation-machine-user","email":"james.p.houghton+ghMachineUser@gmail.com"},"content":"$(base64 -w 0 /.empirica/local/tajriba.json)"}` > /scripts/PUT_BODY.json
        #echo '{"message":"pushing '"$currentLineLength lines to $outfileName"'","branch":"'$GH_BRANCH'","committer":{"name":"deliberation-machine-user","email":"james.p.houghton+ghMachineUser@gmail.com"},"content":"'"$(base64 -w 0 /.empirica/local/tajriba.json)"'"}' > /scripts/PUT_BODY.json
    fi

    # push to github
    # documentation here: https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents
    curl \
        --fail-with-body \
        -X "PUT" \
        -H "Accept: application/vnd.github+json" \
        -H "Authorization: token ${GH_TOKEN}" \
        https://api.github.com/repos/${GH_DATA_REPO}/contents/raw/${outfileName} \
        -d @/scripts/PUT_BODY.json > /scripts/PUT_RESPONSE.json
        


    # extract the relevant info from the response.
    cat /scripts/PUT_RESPONSE.json |
        jq '.content' |
        jq '.sha' |
        read fileSHA

    if [ ! -z $fileSHA ]   # if the put response contains a SHA, store it
    then
        echo $fileSHA > /scripts/fileSHA.txt
    fi

    echo $currentLineLength > /scripts/tajribaLineCount.txt

else
    echo "Nothing to update."
fi
