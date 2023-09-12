# Experiments in small group deliberation

Walkthrough video July 29, 2022

https://user-images.githubusercontent.com/4304478/182884055-0c46c3da-0e74-4ce7-8c96-507e760601d4.mp4

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

To start everything up in a dev environment, first type:

```bash
npm run start
```

This will set up empirica in dev mode. You also need to start the mock cdn:

```bash
npm run cdn
```

Then to start cypress for running end-to-end tests, run:

```bash
npm run test
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
  "treatmentFile": "projects/example/treatments.test.yaml",
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

# Treatments

Treatments are specified in a .yaml file that contains all of the information
needed to implement a specific experiment.

### Intro-sequences

Intro sequences will be the same for all participants regardless of their
treatment condition. This is a good place to include surveys and prompts that
might be used to assign participants to groups or conditions.

```yaml
#
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
  "deliberationId": "efc41eb4-250b-4385-9fad-dfd75ae5c318",
  "sampleId": "0fc204ab-3610-48ae-9654-cfcf6a4ae000",
  "batchId": "01HA599J2TYTS8KYDKJHSZXY00",
  "config": {
    "kind": "custom",
    "config": {
      "batchName": "cytest_01",
      "treatmentFile": "projects/example/treatments.test.yaml",
      "launchDate": "12 Sep 2023 14:09:01 -04:00",
      "dispatchWait": 1,
      "introSequence": "cypress_intro",
      "consentAddendum": "projects/example/consentAddendum.md",
      "cdn": "test",
      "treatments": ["cypress_omnibus"],
      "videoStorageLocation": "deliberation-lab-recordings-test",
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
  "timeBatchInitialized": 1694542122820,
  "timeArrived": 1694542129826,
  "timeIntroSequenceDone": 1694542138984,
  "timeStarted": 1694542142024,
  "timeComplete": 1694542167294,
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
    "https://api.github.com/repos/Watts-Lab/deliberation-assets/git/blobs/ab65e1775cec4f2f1009b115216a439bf90643ec",
    "agree18Understand"
  ],
  "gameId": "01HA59A6HHGV23EH5JJJY7EW1X",
  "treatment": {
    "name": "cypress_omnibus",
    "desc": "Cypress testing everything possible in one go.",
    "playerCount": 2,
    "groupComposition": [
      {
        "name": "democrat",
        "conditions": [
          { "key": "A", "comparator": "greaterThan", "value": 5 },
          { "key": "B", "comparator": "equals", "value": "Democrat" }
        ]
      }
    ],
    "gameStages": [
      {
        "name": "Qualtrics Test",
        "duration": 600,
        "elements": [
          {
            "type": "qualtrics",
            "url": "https://upenn.co1.qualtrics.com/jfe/form/SV_cumihDjKknDL702",
            "params": [{ "key": "dummyData", "value": "this is it!" }]
          }
        ],
        "chatType": "none"
      },
      {
        "name": "Test Markdown Table",
        "duration": 600,
        "elements": [
          { "type": "prompt", "file": "projects/example/markdownTable.md" },
          { "type": "submitButton" }
        ],
        "chatType": "none"
      },
      {
        "name": "Topic Survey",
        "duration": 600,
        "chatType": "none",
        "elements": [
          {
            "type": "prompt",
            "file": "projects/example/multipleChoice.md",
            "showToPositions": [0, 1]
          },
          {
            "type": "prompt",
            "description": "shown to players 1 and 2",
            "file": "projects/example/multipleChoiceWizards.md",
            "hideFromPositions": [3]
          },
          {
            "type": "prompt",
            "file": "projects/example/multipleChoiceColors.md",
            "showToPositions": [3]
          },
          {
            "type": "prompt",
            "file": "projects/example/multipleChoiceColors.md",
            "hideFromPositions": [0, 1]
          },
          {
            "type": "prompt",
            "file": "projects/example/openResponse.md",
            "name": "openResponseExample1"
          },
          { "type": "separator", "style": "thick" },
          { "type": "submitButton", "buttonText": "Continue" }
        ]
      },
      {
        "name": "Survey Library",
        "duration": 600,
        "elements": [{ "type": "survey", "surveyName": "ExampleSurvey" }],
        "chatType": "none"
      },
      {
        "name": "Training Video",
        "duration": 20,
        "chatType": "none",
        "elements": [{ "type": "video", "url": "https://youtu.be/QC8iQqtG0hg" }]
      },
      {
        "name": "Test Displays by Position",
        "duration": 600,
        "elements": [
          {
            "type": "display",
            "promptName": "openResponseExample1",
            "position": 1,
            "showToPositions": [0]
          },
          {
            "type": "display",
            "promptName": "openResponseExample1",
            "position": 0,
            "showToPositions": [1]
          },
          { "type": "submitButton" }
        ],
        "chatType": "none"
      },
      {
        "name": "Test Displays of current player",
        "duration": 600,
        "elements": [
          {
            "type": "display",
            "promptName": "openResponseExample1",
            "position": "player"
          },
          { "type": "submitButton" }
        ],
        "chatType": "none"
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
        ],
        "chatType": "none"
      },
      {
        "name": "Discussion",
        "duration": 10,
        "chatType": "video",
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
    "exitSurveys": ["TeamViability", "ExampleSurvey"]
  },
  "position": "1",
  "surveys": {
    "survey_PoliticalPartyUS_intro_3": {
      "surveySource": "@watts-lab/surveys",
      "version": "1.8.12",
      "surveySha": "8e147591c4b153ef3074ae82cd7b857b4c7e20c5",
      "scoreSha": "44bc56ce81d5a357dd0ac68b06aa2b945c12e144",
      "surveyName": "politicalPartyUS",
      "responses": {
        "party": "Republican",
        "republicanStrength": "Strong Republican",
        "republicanImportance": 50
      },
      "result": {
        "party": "Republican",
        "position": 3,
        "normPosition": 1,
        "importance": 50,
        "normImportance": 0.5
      },
      "secondsElapsed": 0,
      "playerId": "01HA599TN0BV7P6927DCFHG4WY",
      "step": "intro_3"
    },
    "survey_ExampleSurvey_stage_3": {
      "surveySource": "@watts-lab/surveys",
      "version": "1.8.12",
      "surveySha": "b09a8ef115b917affcf1bf33809d59613e8df64d",
      "scoreSha": "ff72e4a62610fc5a1aceb23c7f4cd1eba2a80f4e",
      "surveyName": "exampleSurvey",
      "responses": {
        "nps_score": 1,
        "disappointed_experience": "lorem ipsum dolor sit amet testplayer_A_911887736325"
      },
      "result": { "rawScore": 1, "normScore": 0.1 },
      "secondsElapsed": 0,
      "playerId": "01HA599TN0BV7P6927DCFHG4WY",
      "step": "stage_3"
    },
    "survey_TeamViability_exit_undefined": {
      "surveySource": "@watts-lab/surveys",
      "version": "1.8.12",
      "surveySha": "7f7c001a0b0198b711f6d47e79c5f3ba4a9b11d0",
      "scoreSha": "c14dfe089031abd75c076d1862bbaf749890bb33",
      "surveyName": "teamViability",
      "responses": {
        "capableUnit": 2,
        "futureSuccess": 2,
        "fallingApart": -2,
        "succeedDespiteDislike": 2
      },
      "result": {
        "rawScore": 2,
        "normScore": 0.8333333333333334,
        "completion": 0.6666666666666666
      },
      "secondsElapsed": 0,
      "playerId": "01HA599TN0BV7P6927DCFHG4WY",
      "step": "exit_undefined"
    },
    "survey_ExampleSurvey_exit_1": {
      "surveySource": "@watts-lab/surveys",
      "version": "1.8.12",
      "surveySha": "b09a8ef115b917affcf1bf33809d59613e8df64d",
      "scoreSha": "ff72e4a62610fc5a1aceb23c7f4cd1eba2a80f4e",
      "surveyName": "exampleSurvey",
      "responses": {
        "nps_score": 1,
        "disappointed_experience": "lorem ipsum dolor sit amet testplayer_A_911887736325"
      },
      "result": { "rawScore": 1, "normScore": 0.1 },
      "secondsElapsed": 0,
      "playerId": "01HA599TN0BV7P6927DCFHG4WY",
      "step": "exit_1"
    }
  },
  "prompts": {
    "prompt_listSorterPrompt": {
      "name": "listSorterPrompt",
      "type": "listSorter",
      "shared": true,
      "step": "stage_7",
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
  "qualtrics": {
    "qualtrics_stage_0": {
      "step": "stage_0",
      "survyeyURL": "https://upenn.co1.qualtrics.com/jfe/form/SV_cumihDjKknDL702",
      "surveyId": "SV_cumihDjKknDL702",
      "sessionId": "FS_1FFYk2NXRzbfyHS",
      "data": {}
    }
  },
  "QCSurvey": {
    "surveySource": "@watts-lab/surveys",
    "version": "1.8.12",
    "surveySha": "e135306f2f8d9f3268da3b2f1daf6a70876db9cd",
    "scoreSha": "ba0f44e4945160b5327df9edc7bd5f840443f951",
    "surveyName": "discussionQualityControl",
    "responses": {
      "participateAgain": "no",
      "adequateCompensation": "underpaid",
      "adequateTime": "adequate",
      "clearInstructions": 2,
      "videoQuality": 2,
      "joiningProblems": "no",
      "technicalProblems": "yes",
      "technicalDetail": "Check_testplayer_A_911887736325_technical_entry",
      "textExpansion": "Check_testplayer_A_911887736325_text_entry"
    },
    "result": {},
    "secondsElapsed": 0
  },
  "exitStatus": "complete",
  "exportErrors": [],
  "speakerEvents": {},
  "textChats": {}
}
```
