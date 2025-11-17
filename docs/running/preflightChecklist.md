**This documentation is a work in progress. It needs to be adapted for use by persons outside of the CSS Lab**

# Setup

- [ ] create a GH repo to receive data, invite `deliberation-machine-user` to be a collaborator on that repo with push permissions
- [ ] set up or identify an appropriate S3 bucket and region

# Preflight Checklist

## Start server(s)

- [ ] visit https://app.terraform.io/app/css-lab-deliberation/workspaces/ and enter the workspace for the server you want to lanch
- [ ] in the "variables" tab, update the `deliberation_empirica_tag` to the latest version from https://github.com/Watts-Lab/deliberation-empirica/pkgs/container/deliberation-empirica. This is the value of the docker image tag, everything following the colon.
- [ ] check that the cpu and memory are set for much larger than we will need. A 2048 cpu and 8192 memory were overkill for a group of ~80. More computer is always cheaper than a failed run.
- [ ] start a new run, and apply the changes, checking that there are no run errors

## Check server started properly

- [ ] visit CloudWatch on the AWS console and inspect the server logs. You should see:
  - [ ] the correct `Container Image Version Tag`
  - [ ] the correct `Subdomain`
  - [ ] redacted values for the Daily APIKEY, Qualtrics Token,
  - [ ] `github authentication succeeded`
  - [ ] no error messages
  - [ ] a message that includes "serve: server started"

## Update treatment files

- [ ] develop and test treatment files locally
- [ ] push treatment files to github, and wait 5-10 mins to make sure they are up to date on the CDN
- [ ] check the treatment file is correct by visiting it on the CDN, for example: `https://s3.amazonaws.com/assets.deliberation-lab.org/projects/example/treatments.demo.yaml` (update with the relevant path)

## Update batch config for test run

- [ ] Visit the AWS S3 Bucket list, and get the bucket name and region you want video files to save to, and enter these in the config
- [ ] set the data repo and prereg repo to a `test` folder in the repo you want the data to get pushed to
- [ ] set the batch name to indicate that this is a test or demo run
- [ ] set `cdn` to `prod`
- [ ] set `centralPrereg` to `false`

## Start the test batch

On the production study admin page

- [ ] write a config json file for the test, e.g. test.config.json, using [deliberation lab docs](https://deliberation-lab.readthedocs.io/en/latest/batchConfig/) for specific options.

  - Use batchname "test" or similar
  - Use the same videoStorage bucket you intend to use in the study. Check that the bucket name and region are all correct
  - Use the same repo you intend to use in the study, but use a different folder e.g."test"
  - set "centralPrereg" to `false`

- [ ] visit the study subdomain admin page e.g. `study.deliberation-lab.org/admin`

- [ ] Check that the AWS region specified in the batch config matches the region of the intended bucket.
- [ ] set the data repo and prereg repo to a test folder in the repo you want the data to get pushed to
- [ ] enter the batch config in the `Empirica Admin Console > New Batch > Assignment Method: Custom` text box, and hit "Create"
- [ ] Wait 5 seconds for the validation to run
- [ ] Check that the batch shows the green `Start` button
- [ ] Visit the AWS server logs and look for any errors
  - [ ] Check for `Initialized Batch ... at ...`
- [ ] Click `Start` batch button

## Test run

- visit the server directly through the participants' link, eg. study.deliberation-lab.org
- [ ] check that you see (or don't see):
  - [ ] the webcam/mic check (for videocall studies)
  - [ ] the appropriate login instructions
  - [ ] the expected intro steps
- [ ] walk through the experiment to the end steps
- [ ] look at the AWS console logs for any errors

## Stop the batch

After everyone has finished

- [ ] stop the batch on the admin page
- [ ]

## Check the data

- [ ] Download the data from the data repo
- [ ] Run the data through analysis scripts
- [ ] Look at the postflight report
- [ ] Look at the S3 bucket and make sure video files saved properly
- [ ] Download video files and recode them

## Update batch config for data collection

- [ ] update folder for data and prereg
- [ ] maybe set `centralPrereg` to `true`?

## Start the sample batch

On the production study admin page

- [ ] enter the batch config in the `Empirica Admin Console > New Batch > Assignment Method: Custom` text box, and hit "Create"
- [ ] Wait 5 seconds for the validation to run
- [ ] Check that the batch shows the green `Start` button
- [ ] Visit the AWS server logs and look for any errors
  - [ ] Check for `Initialized Batch ... at ...`
- [ ] Click `Start` batch button

## Invite the participants

## Set up monitoring

- [ ] AWS Console logs
- [ ] Sentry errors
- [ ] Daily dashboard
- [ ] S3 bucket
- [ ] ECS container loads

## Run the study

- [ ]
- [ ] respond to emails and complaints, try and help debug
