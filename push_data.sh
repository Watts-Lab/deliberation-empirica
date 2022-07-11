#!/bin/bash

# This script uploads tajriba.json to our private data repo.
# Each time empirica is updated, a new tajriba.json is created
# so we upload a different file for each new system setup.
# The filename for the new file is based on the timestamp of the
# empirica setup.

shopt -s lastpipe # enables lastpipe

# get line length of tajriba.json
cat .empirica/local/tajriba.json |
    wc -l |
    read currentLineLength  # save as variable using lastpipe (only works in bash)
echo "Tajriba.json has" $currentLineLength "lines"

# read line length from last time this script was run
cat .empirica/local/tajribaLineCount.txt |
    read lastLineLength  # save as variable using lastpipe (only works in bash)
echo "Last time, had" $lastLineLength "lines"

# only push to server if there have been changes
# tajriba.json is append-only, so we can see changes as new lienes
if [ $currentLineLength -gt $lastLineLength ] 
then
    # get empirica system boot time
    cat .empirica/local/tajriba.json | 
        grep system | # look for the row where empirica system is set up
        jq '.obj' | 
        jq '.createdAt' | # get the time of the system creation entry
        sed 's/:/-/g' |  # replace `:` with `-`
        sed 's/["]//g' |  # remove `"`
        sed 's/[.].*//g' | # get rid of everything after the `.` in the timestamp
        read loadTime  # save as variable using lastpipe (only works in bash)
    echo "Empirica system boot time:" $loadTime

    outfileName="tajriba_${loadTime}5.json"    
    
    if [ -f ".empirica/local/PUT_RESPONSE.json" ]; then  # if the put response exists, then the file exists, so we update it
        cat .empirica/local/PUT_RESPONSE.json |
            jq '.content' |
            jq '.sha' |
            read filesha

        echo '{"message":"pushing '"$currentLineLength lines to $outfileName"'","branch":"'$GH_BRANCH'","committer":{"name":"deliberation-machine-user","email":"james.p.houghton+ghMachineUser@gmail.com"},"content":"'"$(base64 -w 0 .empirica/local/tajriba.json)"'","sha":'$filesha'}' > ".empirica/local/PUT_BODY.json"    
    else 
        echo '{"message":"pushing '"$currentLineLength lines to $outfileName"'","branch":"'$GH_BRANCH'","committer":{"name":"deliberation-machine-user","email":"james.p.houghton+ghMachineUser@gmail.com"},"content":"'"$(base64 -w 0 .empirica/local/tajriba.json)"'"}' > ".empirica/local/PUT_BODY.json"
    fi

    # push to github
    # documentation here: https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents
    curl \
        -X "PUT" \
        -H "Accept: application/vnd.github+json" \
        -H "Authorization: token $GH_TOKEN" \
        https://api.github.com/repos/$GH_DATA_REPO/contents/raw/$outfileName \
        -d @.empirica/local/PUT_BODY.json > ".empirica/local/PUT_RESPONSE.json"

    cat ".empirica/local/PUT_RESPONSE.json"
    echo $currentLineLength > .empirica/local/tajribaLineCount.txt

else 
    echo "No changes since last commit"
fi
