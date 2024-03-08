## Supported Config Options

Batch options are (currently) supplied as a custom batch JSON
{
"option": value.
"option"

}

### `batchName`

Name to use in filepath of saved data

### `treatmentFile`

Path relative to the root of the repository to the treatment file containing the treatments to be included in the batch. At the moment you can only use one treatment file.

### `introSequence`

is the name of the sequence defined in ` treatmentFile`
to be shown to all participants prior to assignment to treatment condition

### `treatments`

list of strings, each string corresponding to a treatment condition defined in the ` treatmentFile`.

### `payoffs`

When multiple treatments are included in the batch, the dispatcher will attempt to assign participants to maximize the total payoff. A different payoff is assigned for each treatment, with the order of the payoffs matching the order that treatments are included in the `treatments` argument.

The dispatcher sorts treatments in order of greatest payoff to least payoff, trying to fill the highest payoff treatments. This means that if you have a backup condition that you want to use only if a player cannot be assigned to any other treatment, you can give it a lower payoff, and it will be assigned later.

### `knockdowns`

Knockdown factors that are used to reduce the payoff of a treatment for its n+1st use, to encourage diverse assignment between treatments.

The knockdown factor can be specified in three ways.

- as a single number in the range [0,1] that is applied to any treatment when it is used
- as an array of numbers number in the range [0,1] with length corresponding to the number of treatments, with each position in the array used to knock down the payoff for the corresponding treatment
- as a square matrix of numbers in the range [0,1] with each dimension equal to the number of treatments. In this case, when a particular treatment is used, all treatment payoffs can be knocked down by varying amounts. This can be used when treatments sit in a multidimensional treatment space, and instead of distributing assignment across a discrete number of treatments we want to distribute assignment across the space.

See [Player assignment to groups](groupAssignment.md) for more details.

### `dispatchWait`

window for collecting participants before randomizing to groups, in seconds

### `preregister`

[true/false] whether the data collected in this batch should be preregistered and used in data analysis. Use false when testing or developing

### `platformConsent`

[US/UK/EU] which of several pre-baked consent forms to show to participants

### `consentAddendum`

path to a markdown file containing contents to be appended to the end of the consent form, that can be used to provide particular information about collaborating research teams.

### `launchDate`

date at which randomization to groups can begin

### `dataRepos`

list of objects describing the repo, branch, and directory where data should be stored. data will also be stored to deliberaiton-data-private prior to the expiry of the embargo period

### `videoStorageLocation`

The name of an aws S3 bucket that is managed by the deliberation-lab. Will have the format `deliberation-lab-recordings-{projectName}`

### `awsRegion`

The aws region of the video storage S3 bucket. defaults to `us-east-1`

### `exitCodeStem`

The stem of an exit code for participants in this batch. Will be appended a status code to tell you how they exited. (loosely based on HTML status codes, so they aren't easy for participants to guess/fudge.) For example, if the exit stem is `XYZ`:

- `XYZ200` indicates successful completion of the whole experiment
- `XYZ408` indicates that they chose not to wait out the lobby
- `XYZ500` indicates server error

> Alternatively, if you enter "none" as the stem, will not show payment codes at all.

```json
[
  {
    "owner": "Watts-Lab",
    "repo": "deliberation-data-test",
    "branch": "main",
    "directory": "cypress_test_exports"
  }
  //... other repos that should also get the data
]
```

### `embargoThrough`

a datestring after which data collected in this batch can be automatically made public

### `videoStorageLocation`

name of an AWS S3 storage bucket for video recordings to be stored in. Always starts with `deliberation-lab-recordings-` and then the research group name or study name. e.g. `deliberation-lab-recordings-test`. You cannot omit unless you explicitly pass config options `checkVideo=false` and `checkAudio=false`.

You can set to "none" in order to not save a recording at all.

### `checkVideo` (optional, default: true)

set to false if you are not using webcams in your experiment, and you don't care to check for them. (You may sometimes check for webcams even if you're not using them, to ensure that the population is the same as the population that would have had to use a webcam, and avoid differential attrition on that factor)

### `checkAudio` (optional, default: true)

set this to false if you arent using webcams or microphones. Has no effect unless `checkVideo` is also set to false.

## Additional support

The ultimate authority on batch config option usage is the project test suite, found under `cypress/e2e/*.js`
