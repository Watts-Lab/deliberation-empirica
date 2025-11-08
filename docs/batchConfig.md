## Supported Config Options

Batch options are supplied as a custom batch JSON. For example:

```json
{
  "batchName": "demo",
  "cdn": "prod",
  "treatmentFile": "projects/example/demo.treatments.yaml",
  "customIdInstructions": "projects/example/demoCustomIdInstructions.md",
  "platformConsent": "US",
  "consentAddendum": "projects/example/demoConsentAddendum.md",
  "checkAudio": true,
  "checkVideo": true,
  "introSequence": "demo_intro",
  "treatments": ["cypress_omnibus"],
  "payoffs": "equal",
  "knockdowns": "none",
  "dispatchWait": 1,
  "launchDate": "09 Apr 2024 13:00:00 EDT",
  "centralPrereg": true,
  "preregRepos": [
    {
      "owner": "Watts-Lab",
      "repo": "deliberation-data-test",
      "branch": "main",
      "directory": "demo"
    }
  ],
  "dataRepos": [
    {
      "owner": "Watts-Lab",
      "repo": "deliberation-data-test",
      "branch": "main",
      "directory": "demo"
    }
  ],
  "videoStorage": {
    "bucket": "deliberation-lab-recordings-test",
    "region": "us-east-1"
  },
  "exitCodes": {
    "complete": "demoCompleteExitCode",
    "error": "demoErrorExitCode",
    "lobbyTimeout": "demoLobbyTimeoutExitCode",
    "failedEquipmentCheck": "demoFailedEquipmentCheck"
  }
}
```

All parameters are required, to avoid errors due to improper default values.

### `batchName`

Name to use in filepath of saved data

### `cdn`

The Content Delivery Network that should be used to fetch treatment files and associated content. Use:

- `test` for running cypress tests during development, to fetch files from fixtures in this repository
- `local` when developing new treatments in the `deliberation-assets` repo
- `prod` to use the full-strength CDN in production

### `treatmentFile`

Path relative to the root of the repository to the treatment file containing the treatments to be included in the batch. At the moment you can only use one treatment file.

### `customIdInstructions`

Can be either a string, or dictionary.

If a string, should be a path to a markdown file containing text to display to participants to help them enter the correct login id. File path must end in `.md`. The file should be plain markdown, without yaml front matter.

If a dictionary, the keys of the dictionary should be the URL parameters of passed in participant IDs. For example `PROLIFIC_PID`. If this URL parameter is found, it will display the corresponding customIDInstructions page, and populate the ID field with the value taken from the URL parameter value. A final `default` key is a fallback in case none of the URL parameters are detected. For example:

```JSON
{
  "customIdInstructions": {
    "PROLIFIC_PID": "prolificInstructions.md",
    "default": "defaultInstructions.md"
  }
}

```

If you do not wish to customize the ID instructions, enter `"customIdInstructions": "none"` and the default text "Please enter the identifier assigned by your recruitment platform." will be displayed.

### `platformConsent`

[US/UK/EU] which of several pre-baked consent forms to show to participants.

### `consentAddendum`

path to a markdown file containing contents to be appended to the end of the consent form, that can be used to provide particular information about collaborating research teams.

If you do not wish to use an additional consent addendum, enter `"consentAddendum": "none"`

### `checkVideo`

Must be a boolean. If you do not wish to check participant video, enter `"checkVideo": false`

Set to false if you are not using webcams in your experiment, and you don't care to check for them. (You may sometimes check for webcams even if you're not using them, to ensure that the population is the same as the population that would have had to use a webcam, and avoid differential attrition on that factor)

### `checkAudio`

Must be a boolean. If you do not wish to check participant audio, enter `"checkAudio": false`.
Set this to false if you aren't using webcams OR microphones. Has no effect unless `checkVideo` is also set to false.

> ℹ️ **Skipping Daily entirely for layout tests**
>
> When **both** `checkVideo` and `checkAudio` are `false`, the server never provisions a Daily room or assigns a `dailyUrl` to games. The client therefore renders the call layout without attempting to connect to Daily, which is useful for Cypress layout demos or for testing the surrounding UI. Setting either flag back to `true` restores the normal “create room + join Daily” flow.

### `introSequence`

The name of the sequence defined in `treatmentFile` to be shown to all participants prior to assignment to treatment condition

If you do not wish to use an intro sequence, enter `"introSequence": "none"`

### `treatments`

A list of strings, each string corresponding to a treatment condition defined in the `treatmentFile`.

### `payoffs`

When multiple treatments are included in the batch, the dispatcher will attempt to assign participants to maximize the total payoff. A different payoff is assigned for each treatment, with the order of the payoffs matching the order that treatments are included in the `treatments` argument.

The dispatcher sorts treatments in order of greatest payoff to least payoff, trying to fill the highest payoff treatments. This means that if you have a backup condition that you want to use only if a player cannot be assigned to any other treatment, you can give it a lower payoff, and it will be assigned later.

As a shorthand, you can assign `"payoffs": "equal"` to give all treatments a payoff of `1`.

### `knockdowns`

Knockdown factors that are used to reduce the payoff of a treatment for its n+1st use, to encourage diverse assignment between treatments.

The knockdown factor can be specified in three ways.

- as a single number in the range `(0,1]` that is applied to any treatment when it is used
- as an array of numbers number in the range `(0,1]` with length corresponding to the number of treatments, with each position in the array used to knock down the payoff for the corresponding treatment
- as a square matrix of numbers in the range `(0,1]` with each dimension equal to the number of treatments. In this case, when a particular treatment is used, all treatment payoffs can be knocked down by varying amounts. This can be used when treatments sit in a multidimensional treatment space, and instead of distributing assignment across a discrete number of treatments we want to distribute assignment across the space.

See [Player assignment to groups](groupAssignment.md) for more details.

If you don't want to use knockdown factors, assign `"knockdowns": "none"`

### `dispatchWait`

Window for collecting participants before randomizing to groups, in seconds. Must be a positive number.

### `launchDate`

Date at which randomization to groups can begin. Should be a properly formatted timestamp, eg. `"launchDate": "09 Apr 2024 13:00:00 EDT"`

The launch date must be in the future. If you do not wish to use a launch date, enter `"launchDate": "immediate"`. This will allow participants to enter the game stages immediately after completing the intro steps, with no synchronization between players.

### `centralPrereg`

Whether the data collected in this batch should be preregistered and embargoed in the central deliberation-lab repository.

Must be a boolean. If you do not wish to preregister to the central repository, enter `"centralPrereg": false`

### `preregRepos`

A list of objects, each object describing a github repository and folder that preregistration and post-flight report data should be pushed to. You can include any number of repos to get copies of the data.

```json
[
  {
    "owner": "Watts-Lab",
    "repo": "deliberation-data-test",
    "branch": "main",
    "directory": "test-prereg"
  }
  //... other repos that should also get the data
]
```

To push to a repository, you need to give push permissions to `deliberation-machine-user`.

If you do not wish to specify a preregistration repository, enter value `"preregRepos":"none"` and no preregistration or postflight report will be saved.

### `dataRepos`

A list of objects, each object describing a github repository and folder that data should be pushed to. You can include any number of repos to get copies of the data.

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

To push to a repository, you need to give push permissions to `deliberation-machine-user`.

### `videoStorage`

An object describing where the video should be stored, in the form:

```json
{
  "videoStorage": {
    "bucket": "deliberation-lab-recordings-{projectName}",
    "region": "us-east-1"
  }
}
```

This must be an aws S3 bucket that is managed by the deliberation-lab.

If you do not wish to store video, enter `"videoStorage": "none"` instead of an object.

### `exitCodes`

You can specify exit codes for the different ways that participants can leave the experiment.

```json
{
  "exitCodes": {
    "complete": "goodJob2001",
    "error": "ohNo404whoops",
    "lobbyTimeout": "youGotTiredOfWaiting408",
    "failedEquipmentCheck": "youFailedEquipmentCheck"
  }
}
```

- "complete" will be displayed to the participant when they get all the way through the exit steps
- "error" will be shown in case of server error or premature batch termination
- "lobbyTimeout" will be shown if it takes more than 5 minutes to match participants, giving them the option to leave and be paid only for the intro sequence.
- "failedEquipmentCheck" will be shown if the participants can't get their webcams working

If you do not wish to supply exit codes, enter `"exitCodes": "none"`.

## Additional support

The ultimate authority on batch config option usage is the project test suite, found under `cypress/e2e/*.js`
