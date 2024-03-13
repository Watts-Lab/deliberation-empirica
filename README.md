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

## Installing local dependencies
`deliberation-empirica` assumes certain dependencies prior to local development. These are:
- Node.js (https://nodejs.org/en/download)
- Docker (https://www.docker.com/)
- Empirica (https://docs.empirica.ly/getting-started/setup); the top of the setup page contains a one-line command for installing Empirica.

Running `npm run build` without these dependencies leads to an error (e.g, `docker: command not found`; `empirica: command not found`).

[For Mac users] One easy way of installing Docker is via homebrew (https://docs.brew.sh/Installation). Once homebrew is installed, simply run:
```
brew install docker --cask
```

## Setting up the local environment
At the root folder of `deliberation-empirica`, the system expects an `.env` file with the following structure:
```
DAILY_APIKEY=
QUALTRICS_API_TOKEN=
QUALTRICS_DATACENTER=
ETHERPAD_API_KEY=
ETHERPAD_BASE_URL=
DELIBERATION_MACHINE_USER_TOKEN=
EMPIRICA_ADMIN_PW=
TEST_CONTROLS=
GITHUB_PRIVATE_DATA_OWNER=
GITHUB_PUBLIC_DATA_OWNER=
GITHUB_PRIVATE_DATA_REPO=
GITHUB_PRIVATE_DATA_BRANCH=
GITHUB_PUBLIC_DATA_REPO=
GITHUB_PUBLIC_DATA_BRANCH=
```
Starting the server without the `.env` file will work, but experiments will fail without the proper API keys, GitHub repos, etc.

After installing these dependencies and setting up the local environment, you can proceed to running on dev.

## Running on dev

The first time you start the environment, you need to build the etherpad container and install any project dependencies. To do this, run:

```bash
npm run build
```

Then, whenever you want to start the dev environment, you need to start the empirica server, the testing cdn, and the etherpad instance. To do this, type:

```bash
npm run start
```

This runs the `runner.sh` script, which is only run in development.

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

- documentation under `/docs`
