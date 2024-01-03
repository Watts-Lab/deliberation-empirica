# Experiments in small group deliberation

Walkthrough video July 29, 2022

https://user-images.githubusercontent.com/4304478/182884055-0c46c3da-0e74-4ce7-8c96-507e760601d4.mp4

# Development

## Folder structure

The files for the main empirica experiment are in folders:

- **server**: files that run on the AWS server. This is where we handle game setup/coordination, connect to authenticated servers and handle data export.
- **client**: files that run in the participant's browser.
- **empirica**: configuration, state, and data files that are accessed server-side

Additional folders support the development workflow:

- **cypress**: contains end-to-end tests and infrastructure to support testing. Also contains the mock CDN
  that supports dev workflows.
- **.github**: contains scripts that get run on commits to the github repo to run tests, etc.
- **.mturk**: contains templates for Mturk HITs.

The root folder contains a few loose files associated with the project as a whole.

- **Dockerfile** and **entrypoint.sh** are both used for packaging up the project to deploy.
- **.eslintrc** and **.prettierrc** are config files for the style checkers
- **package.json** installs the packages needed for the style checkers, and provides some helpful shortcut commands.

## Running on dev

The first time you start the environment, you need to build the etherpad container and install any project dependencies. To do this, run:

```bash
npm run build
```

Then, whenever you want to start the dev environment, you need to start the empirica server, the testing cdn, and the etherpad instance. To do this, type:

```bash
npm run start
```

Now that everything is set up, you can visit

```
http://localhost:3000/admin
```

Go to "New batch" and then "Custom". We specify particular parameters for each batch using a JSON object.
For example, enter:

```json
{
  "batchName": "labDemo",
  "treatmentFile": "projects/example/cypress.treatments.yaml",
  "dispatchWait": 1,
  "treatments": ["demo1p"]
}
```

This will set up a batch with one-player demo games.

You can then visit:

```
http://localhost:3000/
```

to test out the participant view.

# Specifying Treatments

In general,

Treatments are specified in a .yaml file that contains all of the information
needed to implement a specific experiment.

### Intro-sequences

Intro sequences will be the same for all participants regardless of their
treatment condition. This is a good place to include surveys and prompts that
might be used to assign participants to groups or conditions.

```yaml
introSequences:
  - name: cypress_intro
    desc: For testing with cypress
    consentItems:
      - projects/example/consentAddendum.md
    introSteps:
      - name: Political Leanings Survey
        elements:
          - type: survey
            surveyName: PoliticalPartyUS
      - name: Test Prompts
        elements:
          - type: prompt
            file: projects/example/multipleChoice.md
          - type: prompt
            file: projects/example/multipleChoiceWizards.md
          - type: prompt
            file: projects/example/openResponse.md
          - type: separator
          - type: submitButton
            buttonText: Continue

treatments:
  - name: cypress_omnibus
    desc: Cypress testing everything possible in one go.
    playerCount: 2 # number of people in the group. required
    groupComposition:
      - name: democrat
        conditions:
          - key: A
            comparator: greaterThan
            value: 5
          - key: B
            comparator: equals
            value: Democrat
    gameStages: # required
      - name: Qualtrics Test
        duration: 600
        elements:
          - type: qualtrics
            url: https://upenn.co1.qualtrics.com/jfe/form/SV_cumihDjKknDL702
            params:
              - key: dummyData
                value: "this is it!"
      - name: Topic Survey
        duration: 60
        chatType: none
        elements:
          - type: prompt
            file: projects/example/multipleChoice.md
            showToPositions:
              - 0
              - 1
          - type: prompt
            description: shown to players 1 and 2
            file: projects/example/multipleChoiceWizards.md
            hideFromPositions:
              - 3
          - type: prompt
            file: projects/example/multipleChoiceColors.md
            showToPositions:
              - 3
          - type: prompt
            file: projects/example/multipleChoiceColors.md
            hideFromPositions:
              - 0
              - 1
          - type: prompt
            file: projects/example/openResponse.md
          - type: separator
            style: thick
          - type: submitButton
            buttonText: Continue
      - name: Survey Library
        duration: 60
        elements:
          - type: survey
            surveyName: ExampleSurvey
      - name: Training Video
        duration: 20
        chatType: none
        elements:
          - type: video
            url: https://youtu.be/QC8iQqtG0hg
      - name: Discussion
        duration: 10
        chatType: video
        elements:
          - type: prompt
            file: projects/example/multipleChoiceColors.md
            displayTime: 0
            hideTime: 5
          - type: timer
            endTime: 5
            hideTime: 5
            warnTimeRemaining: 4
          - type: prompt
            file: projects/example/multipleChoiceWizards.md
            displayTime: 5
          - type: timer
            displayTime: 5
          - type: audio
            file: shared/airplane_chime.mp3
            displayTime: 5
    exitSurveys:
      - TeamViability
      - ExampleSurvey
```

- `name` gives the treatment name as it will show up in the admin console
- `desc` is purely for documentation
- `playerCount` is the number of people who will participate in each "game" (including treatments and discussion)
- `gameStages` shows the progression that participants will take after the consent, intro screen, and video check
- `exitSurveys` shows the ordered list of surveys that will be shown to participants. (These surveys are implemented and described here: https://github.com/Watts-Lab/surveys/tree/main/surveys)

#### Game Stages

Within the `gameStages`, each stage of the game has a variety of attributes

- `name` is mostly descriptive and for tracking data after the experiment
- `type` indicates which components will be displayed, and can fall into the following categories
  - `prompt` displays text or a set of questions to the participant
  - `video` displays a video to the participant
  - `discussion` shows the videocall window and also a discussion prompt/question
- `duration` is the maximum length of the stage. It defaults to just over 30 minutes.
  - For video stages, when the video has completed for all players the stage will automatically advance, so we don't need to supply a duration.
  - For prompt stages, participants may click "next" when they have finished answering the questions, and so proceed to the next stage automatically
  - Discussion stages will always last for the time specified in "duration".
- `url` is the youtube URL of the video to be displayed
- `prompt` can take a list of prompts to be displayed on the same page.

## Code StyleCheck and Basic Debugging

This project uses Eslint to enforce coding style and automatically debug certain issues.

If not installed already, first [install](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) the ESLint VSCode extension.

Next, to install the relevant dependencies and enable linting in your local development environment, run the command `npm run lint` in a terminal opened at the root directory. The terminal will then display a list of current errors, if there are any.

You do not need to run this command again so long as the dependencies are still installed locally. Any files containing errors will red in the VSCode Explorer, and the code causing the errors underlined.

## Troubleshooting:

Empirica stores session data in `./empirica/local/tajriba.json`.
If there is an issue where empirica's data gets corrupted, you can clear the working database
by deleting this file. Empricia will start with a fresh slate, and rebuild the file based on
actions you take from then on.

#### References

- https://www.cypress.io/blog/2019/01/03/stop-using-page-objects-and-start-using-app-actions/
- https://www.cypress.io/blog/2019/02/28/shrink-the-untestable-code-with-app-actions-and-effects/

## Supported Config Options

- **batchName** name to use in filepath of saved data
- **treatmentFile** path relative to the root of the repository to the treatment file containing the treatments to be included in the batch. At the moment you can only use one treatment file.
- **introSequence** is the name of the sequence defined in **treatmentFile** to be shown to all participants prior to assignment to treatment condition
- **treatments** list of strings, each string corresponding to a treatment condition defined in the **treatmentFile**
- **preregister** [true/false] whether the data collected in this batch should be preregistered and used in data analysis. Use false when testing or developing
- **dispatchWait** window for collecting participants before randomizing to groups, in seconds
- **platformConsent** [US/UK/EU] which of several pre-baked consent forms to show to participants
- **consentAddendum** path to a markdown file containing contents to be appended to the end of the consent form, that can be used to provide particular information about collaborating research teams.
- **launchDate** date at which randomization to groups can begin
- **dataRepos**: list of objects describing the repo, branch, and directory where data should be stored. data will also be stored to deliberaiton-data-private prior to the expiry of the embargo period
- **videoStorageLocation**: The name of an aws S3 bucket that is managed by the deliberation-lab. Will have the format `deliberation-lab-recordings-{projectName}`
- **awsRegion**: The aws region of the video storage S3 bucket. defaults to `us-east-1`
- **exitCodeStem**: The stem of an exit code for participants in this batch. Will be appended a status code to tell you how they exited. (loosely based on HTML status codes, so they aren't easy for participants to guess/fudge.) For example, if the exit stem is `XYZ`:
  - `XYZ200` indicates successful completion of the whole experiment
  - `XYZ408` indicates that they chose not to wait out the lobby
  - `XYZ500` indicates server error
    Alternatively, if you enter "none" as the stem, will not show payment codes at all.

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

- **embargoThrough**: a datestring after which data collected in this batch can be automatically made public
- **videoStorageLocation**: name of an AWS S3 storage bucket for video recordings to be stored in. Always starts with `deliberation-lab-recordings-` and then the research group name or study name. e.g. `deliberation-lab-recordings-test`. You cannot omit unless you explicitly pass config options `checkVideo=false` and `checkAudio=false`. You can set to "none" in order to not save a recording at all.

- **checkVideo**: (optional, default: true) set to false if you are not using webcams in your experiment, and you don't care to check for them. (You may sometimes check for webcams even if you're not using them, to ensure that the population is the same as the population that would have had to use a webcam, and avoid differential attrition on that factor)
- **checkAudio**: (optional, default: true) set this to false if you arent using webcams or microphones. Has no effect unless `checkVideo` is also set to false.

```json
{
  "containerTag": "local-dev",
  "deliberationId": "ed8942ea-ca3d-4453-a5d3-e362be2641d5",
  "sampleId": "2ff8a234-7730-4d9b-8d7d-711567dbbf84",
  "viewerInfo": {
    "width": 1728,
    "height": 1079,
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  },
  "batchId": "01HJHXEN1BW2ZXPE4VKXR44YYX",
  "config": {
    "kind": "custom",
    "config": {
      "batchName": "cytest_01",
      "treatmentFile": "projects/example/cypress.treatments.yaml",
      "launchDate": "25 Dec 2023 20:57:46 -05:00",
      "dispatchWait": 1,
      "exitCodeStem": "cypress",
      "introSequence": "cypress_intro",
      "consentAddendum": "projects/example/consentAddendum.md",
      "cdn": "test",
      "treatments": ["cypress_omnibus"],
      "videoStorageLocation": "deliberation-lab-recordings-test",
      "awsRegion": "us-east-1",
      "preregister": true,
      "dataRepos": [
        {
          "owner": "Watts-Lab",
          "repo": "deliberation-data-test",
          "branch": "main",
          "directory": "cypress_test_exports"
        },
        {
          "owner": "Watts-Lab",
          "repo": "deliberation-data-test",
          "branch": "main",
          "directory": "cypress_test_exports2"
        }
      ],
      "preregRepos": [
        {
          "owner": "Watts-Lab",
          "repo": "deliberation-data-test",
          "branch": "main",
          "directory": "preregistration"
        },
        {
          "owner": "Watts-Lab",
          "repo": "deliberation-data-test",
          "branch": "public-test",
          "directory": "preregistration"
        }
      ]
    }
  },
  "timeBatchInitialized": "2023-12-26T01:57:29.126Z",
  "timeArrived": "2023-12-26T01:57:35.218Z",
  "timeEnteredCountdown": 1703555867175,
  "timeIntroDone": 1703555867303,
  "timeStarted": "2023-12-26T01:57:49.167Z",
  "timeComplete": 1703555959908,
  "consent": [
    "about",
    "releaseAnonymizedData",
    "storePlatformID",
    "recordVideo",
    "showVideoToCoders",
    "shareVideoWithResearchers",
    "storeVideoIndefinitely",
    "storeWebsiteInteractions",
    "upennContact",
    "https://api.github.com/repos/Watts-Lab/deliberation-assets/git/blobs/e592c8a0e23148fb1e194a79ea59b0c58a538e27",
    "agree18Understand"
  ],
  "introSequence": "missing",
  "gameId": "01HJHXF9MNJCS8A7XXH4DF51NP",
  "treatment": {
    "name": "cypress_omnibus",
    "desc": "Cypress testing everything possible in one go.",
    "playerCount": 2,
    "groupComposition": [
      { "desc": "Blue team", "position": 0, "title": "Title-A-Position-0" },
      { "desc": "Red team", "position": 1, "title": "Title-B-Position-1" }
    ],
    "gameStages": [
      {
        "name": "Test Markdown Table",
        "duration": 600,
        "elements": [
          { "type": "prompt", "file": "projects/example/markdownTable.md" },
          { "type": "submitButton" }
        ]
      },
      {
        "name": "Test simultaneous prompt editing",
        "duration": 600,
        "chatType": "none",
        "elements": [
          {
            "type": "prompt",
            "file": "projects/example/multipleChoiceNumbers.md",
            "name": "individualMultipleChoiceNumbers"
          },
          {
            "type": "prompt",
            "file": "projects/example/multipleChoice.md",
            "name": "individualMultipleChoice"
          },
          {
            "type": "prompt",
            "file": "projects/example/multipleChoiceWizards.md",
            "shared": true,
            "name": "sharedMultipleChoiceWizards"
          },
          {
            "type": "prompt",
            "file": "projects/example/multipleChoiceColors.md",
            "name": "individualMultipleChoiceColors"
          },
          {
            "type": "prompt",
            "file": "projects/example/openResponse.md",
            "name": "individualOpenResponse"
          },
          { "type": "separator", "style": "thick" },
          { "type": "submitButton", "buttonText": "Continue" }
        ]
      },
      {
        "name": "Test Conditional Renders",
        "duration": 600,
        "elements": [
          {
            "type": "prompt",
            "desc": "shown for first 8 seconds",
            "file": "projects/example/testDisplay00.md",
            "hideTime": 4
          },
          {
            "type": "prompt",
            "desc": "shows to everyone",
            "file": "projects/example/testDisplay01.md"
          },
          {
            "type": "prompt",
            "desc": "shown to position 0 only",
            "file": "projects/example/testDisplay02.md",
            "showToPositions": [0]
          },
          {
            "type": "prompt",
            "desc": "shown to position 1 only",
            "file": "projects/example/testDisplay03.md",
            "hideFromPositions": [0]
          },
          {
            "type": "prompt",
            "desc": "shown to position 0 only",
            "file": "projects/example/testDisplay04.md",
            "conditions": [
              {
                "promptName": "individualMultipleChoiceColors",
                "comparator": "equal",
                "value": "Octarine"
              }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to position 1 only",
            "file": "projects/example/testDisplay05.md",
            "conditions": [
              {
                "promptName": "individualMultipleChoiceColors",
                "comparator": "notEqual",
                "value": "Octarine"
              }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to position 0 only",
            "file": "projects/example/testDisplay06.md",
            "conditions": [
              {
                "promptName": "individualOpenResponse",
                "comparator": "lengthAtMost",
                "value": 12
              }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to position 1 only",
            "file": "projects/example/testDisplay07.md",
            "conditions": [
              {
                "promptName": "individualOpenResponse",
                "comparator": "lengthAtLeast",
                "value": 12
              }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to position 0 only",
            "file": "projects/example/testDisplay08.md",
            "conditions": [
              {
                "promptName": "individualOpenResponse",
                "comparator": "notInclude",
                "value": "suchlike"
              }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to position 1 only",
            "file": "projects/example/testDisplay09.md",
            "conditions": [
              {
                "promptName": "individualOpenResponse",
                "comparator": "include",
                "value": "suchlike"
              }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to both",
            "file": "projects/example/testDisplay10.md",
            "conditions": [
              {
                "promptName": "sharedMultipleChoiceWizards",
                "comparator": "equal",
                "position": "shared",
                "value": "Merlin"
              }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to neither",
            "file": "projects/example/testDisplay11.md",
            "conditions": [
              {
                "promptName": "sharedMultipleChoiceWizards",
                "comparator": "equal",
                "position": "shared",
                "value": "Gandalf"
              }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to both",
            "file": "projects/example/testDisplay12.md",
            "conditions": [
              {
                "promptName": "individualMultipleChoice",
                "comparator": "equal",
                "position": "all",
                "value": "HTML"
              }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to neither",
            "file": "projects/example/testDisplay13.md",
            "conditions": [
              {
                "promptName": "individualMultipleChoiceColors",
                "comparator": "equal",
                "position": "all",
                "value": "Octarine"
              }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to both",
            "file": "projects/example/testDisplay14.md",
            "conditions": [
              {
                "promptName": "individualMultipleChoiceColors",
                "comparator": "equal",
                "position": 0,
                "value": "Octarine"
              }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to neither",
            "file": "projects/example/testDisplay15.md",
            "conditions": [
              {
                "promptName": "individualMultipleChoiceColors",
                "comparator": "equal",
                "position": 1,
                "value": "Octarine"
              }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to 0 only",
            "file": "projects/example/testDisplay16.md",
            "conditions": [
              {
                "promptName": "individualMultipleChoiceColors",
                "comparator": "oneOf",
                "value": ["Octarine", "Red", "Blue"]
              }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to 1 only",
            "file": "projects/example/testDisplay17.md",
            "conditions": [
              {
                "promptName": "individualMultipleChoiceColors",
                "comparator": "notOneOf",
                "value": ["Octarine", "Red", "Blue"]
              }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to 1 only",
            "file": "projects/example/testDisplay18.md",
            "conditions": [
              {
                "promptName": "individualOpenResponse",
                "comparator": "match",
                "value": "/\\b\\w{7,}\\b/"
              }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to 0 only",
            "file": "projects/example/testDisplay19.md",
            "conditions": [
              {
                "promptName": "individualOpenResponse",
                "comparator": "notMatch",
                "value": "/\\b\\w{7,}\\b/"
              }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to 0 only",
            "file": "projects/example/testDisplay20.md",
            "conditions": [
              {
                "promptName": "multipleChoiceWizardsIntroExample",
                "comparator": "equal",
                "value": "Merlin"
              },
              {
                "promptName": "individualMultipleChoiceColors",
                "comparator": "equal",
                "value": "Octarine"
              }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to both",
            "file": "projects/example/testDisplay21.md",
            "conditions": [
              {
                "promptName": "individualMultipleChoiceColors",
                "comparator": "exists"
              }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to neither",
            "file": "projects/example/testDisplay22.md",
            "conditions": [
              { "promptName": "nonexistentPrompt", "comparator": "exists" }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to neither",
            "file": "projects/example/testDisplay23.md",
            "conditions": [
              {
                "promptName": "individualMultipleChoiceColors",
                "comparator": "notExists"
              }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown to both",
            "file": "projects/example/testDisplay24.md",
            "conditions": [
              { "promptName": "nonexistentPrompt", "comparator": "notExists" }
            ]
          },
          {
            "type": "prompt",
            "desc": "shown after first 8 seconds",
            "file": "projects/example/testDisplay99.md",
            "displayTime": 4
          },
          {
            "type": "submitButton",
            "buttonText": "Continue",
            "conditions": [
              {
                "promptName": "individualMultipleChoice",
                "comparator": "equal",
                "position": "all",
                "value": "HTML"
              }
            ]
          }
        ]
      },
      {
        "name": "Survey Library",
        "duration": 600,
        "elements": [{ "type": "survey", "surveyName": "ExampleSurvey" }]
      },
      {
        "name": "Training Video",
        "duration": 20,
        "chatType": "none",
        "elements": [{ "type": "video", "url": "https://youtu.be/QC8iQqtG0hg" }]
      },
      {
        "name": "Test displays earlier submission by position",
        "duration": 600,
        "elements": [
          {
            "type": "display",
            "promptName": "individualOpenResponse",
            "position": 1,
            "showToPositions": [0]
          },
          {
            "type": "display",
            "promptName": "individualOpenResponse",
            "position": 0,
            "showToPositions": [1]
          },
          { "type": "submitButton" }
        ]
      },
      {
        "name": "Test displays earlier submission of current player",
        "duration": 600,
        "elements": [
          {
            "type": "display",
            "promptName": "individualOpenResponse",
            "position": "player"
          },
          { "type": "submitButton" }
        ]
      },
      {
        "name": "Test List Sorter",
        "duration": 6000,
        "elements": [
          {
            "name": "listSorterPrompt",
            "type": "prompt",
            "file": "projects/example/listSorter.md",
            "shared": true
          },
          { "type": "submitButton" }
        ]
      },
      {
        "name": "Discussion",
        "duration": 10,
        "discussion": {
          "chatType": "video",
          "showNickname": true,
          "showTitle": true
        },
        "elements": [
          {
            "type": "prompt",
            "file": "projects/example/multipleChoiceColors.md",
            "displayTime": 0,
            "hideTime": 5
          },
          {
            "type": "timer",
            "endTime": 5,
            "hideTime": 5,
            "warnTimeRemaining": 4
          },
          {
            "type": "prompt",
            "file": "projects/example/multipleChoiceWizards.md",
            "displayTime": 5
          },
          { "type": "timer", "displayTime": 5 },
          {
            "type": "audio",
            "file": "shared/airplane_chime.mp3",
            "displayTime": 5
          }
        ]
      }
    ],
    "exitSequence": [
      {
        "name": "Team Viability Survey",
        "elements": [{ "type": "survey", "surveyName": "TeamViability" }]
      },
      {
        "name": "Example Survey",
        "elements": [{ "type": "survey", "surveyName": "ExampleSurvey" }]
      }
    ]
  },
  "position": "1",
  "recordingsFolder": "20231226_0157_cytestDF51NP",
  "recordingRoomName": "20231226_0157_cytestDF51NP",
  "recordingsPath": "missing",
  "recordingIds": "missing",
  "surveys": {
    "survey_PoliticalPartyUS_intro_4": {
      "surveySource": "@watts-lab/surveys",
      "version": "1.10.0",
      "surveySha": "80b9769ececff2a0d93e25ec56f2669dcb080f24",
      "scoreSha": "4f9591e4781bc5e1c4ab6f57b1c3c9953c5f9dad",
      "surveyName": "politicalPartyUS",
      "responses": {
        "party": "Republican",
        "republicanStrength": "Strong Republican",
        "republicanImportance": 50
      },
      "result": {
        "party": "Republican",
        "position": 3,
        "normPosition": "1.000",
        "importance": 50,
        "normImportance": 0.5
      },
      "secondsElapsed": 0,
      "playerId": "01HJHXEWVG096FBGDAPN4T812T",
      "step": "intro_4"
    },
    "survey_ExampleSurvey_stage_3": {
      "surveySource": "@watts-lab/surveys",
      "version": "1.10.0",
      "surveySha": "7e8beed36fa4517d23ed1f5686f7709b8a104427",
      "scoreSha": "ff72e4a62610fc5a1aceb23c7f4cd1eba2a80f4e",
      "surveyName": "exampleSurvey",
      "responses": { "nps_score": 1 },
      "result": { "rawScore": 1, "normScore": 0.1 },
      "secondsElapsed": 0,
      "playerId": "01HJHXEWVG096FBGDAPN4T812T",
      "step": "stage_3"
    },
    "survey_TeamViability_exit_undefined": {
      "surveySource": "@watts-lab/surveys",
      "version": "1.10.0",
      "surveySha": "a8d79734a2bb990efe60adc1976fe7fadfbbf29f",
      "scoreSha": "fd5099e572dc8c98c99568fd46336a85cdbe98c1",
      "surveyName": "teamViability",
      "responses": {
        "capableUnit": 2,
        "futureSuccess": 2,
        "fallingApart": -2,
        "succeedDespiteDislike": 2
      },
      "result": {
        "rawScore": "2.000",
        "normScore": "0.833",
        "completion": 0.6666666666666666
      },
      "secondsElapsed": 0,
      "playerId": "01HJHXEWVG096FBGDAPN4T812T",
      "step": "exit_undefined"
    },
    "survey_ExampleSurvey_exit_1": {
      "surveySource": "@watts-lab/surveys",
      "version": "1.10.0",
      "surveySha": "7e8beed36fa4517d23ed1f5686f7709b8a104427",
      "scoreSha": "ff72e4a62610fc5a1aceb23c7f4cd1eba2a80f4e",
      "surveyName": "exampleSurvey",
      "responses": {
        "nps_score": 1,
        "disappointed_experience": "lorem ipsum dolor sit amet testplayer_A_3139589942342"
      },
      "result": { "rawScore": 1, "normScore": 0.1 },
      "secondsElapsed": 0,
      "playerId": "01HJHXEWVG096FBGDAPN4T812T",
      "step": "exit_1"
    }
  },
  "prompts": {
    "prompt_multipleChoiceIntroExample": {
      "name": "multipleChoiceIntroExample",
      "type": "multipleChoice",
      "author": "James Houghton",
      "modified": "Oct 19, 2022",
      "permalink": "https://api.github.com/repos/Watts-Lab/deliberation-assets/git/blobs/2df86aa5510e204e56cfd24825f00ea6a2357a88",
      "step": "intro_5",
      "prompt": "\n# Markdown or HTML?\n\nWe need to decide whether to use Markdown or HTML for storing\n[deliberation](https://www.annualreviews.org/doi/abs/10.1146/annurev.polisci.11.081306.070308) topics.\n\n- **Markdown** files are a convenient way to include basic formatting in a human-readable plain text document that can be easily version controlled.\n- **HTML** documents allow for more customization, but are more difficult to write and to read without a renderer.\n\n_Which format is better for this task?_\n\n",
      "responses": ["Markdown", "HTML"],
      "value": "Markdown"
    },
    "prompt_multipleChoiceWizardsIntroExample": {
      "name": "multipleChoiceWizardsIntroExample",
      "type": "multipleChoice",
      "shuffleOptions": true,
      "author": "James Houghton",
      "modified": "Jan 6, 2023",
      "notes": "supports testing",
      "permalink": "https://api.github.com/repos/Watts-Lab/deliberation-assets/git/blobs/fc8891f5cee58cc1694d80980d8da80c699fb1af",
      "step": "intro_5",
      "prompt": "\n# Which of the following wizards appears in the most novels?\n\n",
      "responses": [
        "Eskarina Smith",
        "Dr. Strange",
        "Merlin",
        "Thomas Edison",
        "Ponder Stibbons",
        "Albus Dumbledore",
        "Gandalf",
        "Ged/Sparrowhawk",
        "Harry Dresden"
      ],
      "value": "Merlin"
    },
    "prompt_introOpenResponse": {
      "name": "introOpenResponse",
      "type": "openResponse",
      "author": "James Houghton",
      "modified": "Oct 19, 2022",
      "rows": 3,
      "permalink": "https://api.github.com/repos/Watts-Lab/deliberation-assets/git/blobs/9177d03a8dfb9698621b1f4594adbaef17885a2a",
      "step": "intro_5",
      "prompt": "\n# Markdown or HTML?\n\nWe need to decide whether to use Markdown or HTML for storing\n[deliberation](https://www.annualreviews.org/doi/abs/10.1146/annurev.polisci.11.081306.070308) topics.\n\n- **Markdown** files are a convenient way to include basic formatting in a human-readable plain text document that can be easily version controlled.\n- **HTML** documents allow for more customization, but are more difficult to write and to read without a renderer.\n\n_Are there any other reasons you can think of for choosing one or the other?_\n\n",
      "responses": ["Please enter your response here."],
      "value": "Intro Open Response for testplayer_A_3139589942342"
    },
    "prompt_individualMultipleChoice": {
      "name": "individualMultipleChoice",
      "type": "multipleChoice",
      "author": "James Houghton",
      "modified": "Oct 19, 2022",
      "permalink": "https://api.github.com/repos/Watts-Lab/deliberation-assets/git/blobs/2df86aa5510e204e56cfd24825f00ea6a2357a88",
      "step": "stage_1",
      "prompt": "\n# Markdown or HTML?\n\nWe need to decide whether to use Markdown or HTML for storing\n[deliberation](https://www.annualreviews.org/doi/abs/10.1146/annurev.polisci.11.081306.070308) topics.\n\n- **Markdown** files are a convenient way to include basic formatting in a human-readable plain text document that can be easily version controlled.\n- **HTML** documents allow for more customization, but are more difficult to write and to read without a renderer.\n\n_Which format is better for this task?_\n\n",
      "responses": ["Markdown", "HTML"],
      "value": "HTML"
    },
    "prompt_individualMultipleChoiceColors": {
      "name": "individualMultipleChoiceColors",
      "type": "multipleChoice",
      "author": "James Houghton",
      "modified": "Jan 6, 2023",
      "notes": "supports testing",
      "permalink": "https://api.github.com/repos/Watts-Lab/deliberation-assets/git/blobs/c05a550dcf0dcfc819efe5afbb2013477e4b3f2d",
      "step": "stage_1",
      "prompt": "\n# Which of the following colors indicates the presence of a strong magical field?\n\n",
      "responses": ["Octarine", "Hooloovoo", "Ultrablack", "Ulfire", "Plaid"],
      "value": "Plaid"
    },
    "prompt_individualOpenResponse": {
      "name": "individualOpenResponse",
      "type": "openResponse",
      "author": "James Houghton",
      "modified": "Oct 19, 2022",
      "rows": 3,
      "permalink": "https://api.github.com/repos/Watts-Lab/deliberation-assets/git/blobs/9177d03a8dfb9698621b1f4594adbaef17885a2a",
      "step": "stage_1",
      "prompt": "\n# Markdown or HTML?\n\nWe need to decide whether to use Markdown or HTML for storing\n[deliberation](https://www.annualreviews.org/doi/abs/10.1146/annurev.polisci.11.081306.070308) topics.\n\n- **Markdown** files are a convenient way to include basic formatting in a human-readable plain text document that can be easily version controlled.\n- **HTML** documents allow for more customization, but are more difficult to write and to read without a renderer.\n\n_Are there any other reasons you can think of for choosing one or the other?_\n\n",
      "responses": ["Please enter your response here."],
      "value": "This is an extremely long response with lots of words and letters and punctuation and suchlike, so as to demonstrate long texts."
    },
    "prompt_sharedMultipleChoiceWizards": {
      "name": "sharedMultipleChoiceWizards",
      "type": "multipleChoice",
      "shuffleOptions": true,
      "author": "James Houghton",
      "modified": "Jan 6, 2023",
      "notes": "supports testing",
      "permalink": "https://api.github.com/repos/Watts-Lab/deliberation-assets/git/blobs/fc8891f5cee58cc1694d80980d8da80c699fb1af",
      "shared": true,
      "step": "stage_1",
      "prompt": "\n# Which of the following wizards appears in the most novels?\n\n",
      "responses": [
        "Albus Dumbledore",
        "Gandalf",
        "Ponder Stibbons",
        "Harry Dresden",
        "Eskarina Smith",
        "Merlin",
        "Ged/Sparrowhawk",
        "Thomas Edison",
        "Dr. Strange"
      ],
      "value": "Merlin"
    },
    "prompt_listSorterPrompt": {
      "name": "listSorterPrompt",
      "type": "listSorter",
      "shared": true,
      "step": "stage_7",
      "prompt": "\n# Please drag the following list into alphabetical order by first name\n\n",
      "responses": [
        "Harry Potter",
        "Hermione Granger",
        "Ron Weasley",
        "Albus Dumbledore",
        "Severus Snape",
        "Rubeus Hagrid",
        "Ginny Weasley",
        "Luna Lovegood",
        "Draco Malfoy",
        "Neville Longbottom"
      ],
      "value": [
        "Hermione Granger",
        "Harry Potter",
        "Ron Weasley",
        "Albus Dumbledore",
        "Severus Snape",
        "Rubeus Hagrid",
        "Ginny Weasley",
        "Luna Lovegood",
        "Draco Malfoy",
        "Neville Longbottom"
      ]
    }
  },
  "qualtrics": {},
  "QCSurvey": "missing",
  "exitStatus": "complete",
  "exportErrors": [],
  "speakerEvents": {},
  "reports": [],
  "checkIns": [],
  "textChats": {},
  "cumulativeSpeakingTime": "missing"
}
```
