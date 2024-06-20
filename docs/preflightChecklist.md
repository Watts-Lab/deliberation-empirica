Viewed
@@ -0,0 +1,32 @@

# Preflight Checklist

## Start server(s)

- [ ] visit https://app.terraform.io/app/css-lab-deliberation/workspaces/ and enter the workspace for the server you want to lanch
- [ ] in the "variables" tab, update the `deliberation_empirica_tag` to the latest version from https://github.com/Watts-Lab/deliberation-empirica/pkgs/container/deliberation-empirica. This is the value of the docker image tag, everything following the colon.
- [ ] check that the cpu and memory are set for much larger than we will need. A 2048 cpu and 8192 memory were overkill for a group of ~80. More computer is always cheaper than a failed run.
- [ ] click `[+ new run]` to start a new run, and apply the changes, checking that there are no run errors
- [ ] visit CloudWatch on the AWS console and inspect the server logs. You should see:
  - [ ] the correct `Container Image Version Tag`
  - [ ] the correct `Subdomain`
  - [ ] redacted values for the Daily APIKEY, Qualtrics Token,
  - [ ] a message that includes "callbacks: started"

## Update treatment files

- [ ] develop and test treatment files locally
- [ ] push treatment files to github, and wait 5-10 mins to make sure they are up to date on the CDN
- [ ] check the treatment file is correct by visiting it on the CDN, for example: `https://s3.amazonaws.com/assets.deliberation-lab.org/projects/example/treatments.demo.yaml` (update with the relevant path)

## Batch config for test run

- [ ] write a config json file for the test, e.g. test.config.json, using [deliberation lab docs](https://deliberation-lab.readthedocs.io/en/latest/batchConfig/) for specific options.

  - Use batchname "test" or similar
  - Use the same videoStorage bucket you intend to use in the study. Check that the bucket name and region are all correct
  - Use the same repo you intend to use in the study, but use a different folder e.g."test"
  - set "centralPrereg" to `false`

- [ ] visit the study subdomain admin page e.g. `study.deliberation-lab.org/admin`

- [ ] Check that the AWS region specified in the batch config matches the region of the intended bucket.
- [ ] set the data repo and prereg repo to a test folder in the repo you want the data to get pushed to
- [ ] enter the batch config in the `Empirica Admin Console > New Batch > Assignment Method: Custom` text box, and hit "Create"
- [ ] Wait 5 seconds for the validation to run, and then check the batch status.
- [ ] If batch creation failed, check the server logs for config validation errors and resolve them.

## Test run

-

## Update batch config for data collection

- [ ] update folder for data and prereg repos
- [ ] set centralPrereg to `true`
