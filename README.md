# Experiments in small group deliberation

Walkthrough video July 29, 2022

https://user-images.githubusercontent.com/4304478/182884055-0c46c3da-0e74-4ce7-8c96-507e760601d4.mp4

# how to use the admin console

```
http://localhost:3000/admin
```

If running on another domain, append `/admin` to the url for the participant interface.

Go to "New Batch" and select the treatments you want to include.
Using "complete" lets you select how many games you want of each treatment, using "simple" just creates one game of each treatment.

Generally it is reasonable to have a single game of each treatment (if you want balanced numbers of participants in each condition)
and then run multiple batches. This means that as players arrive, they will first be randomized to games within the first batch,
and then overflow to subsequent batches. Players are randomized on arrival, not on when they finish the into steps, so it is possible that
for batch with 2 games of 2 players each, the first 4 players to arrive will not fill out those slots, and instead someone may get bumped to
the next batch. (in that batch, they'll be assigned to the same treatment condition).

# Testing multiplayer games

To launch a second participant in the same browser, append `/?playerKey=<mash keyboard here>`, for example:

```
http://localhost:3000/?playerKey=shjdfksfdj
http://localhost:3000/?playerKey=bsdfioerndfsjklsd
```

each will create a unique participant.

# Treatments

When running locally, log into:
Treatments are defined in `.empirica/treatments.yaml`. This file has each condition defined with a particular set of attributes:

```yaml
treatments:
  - name: Weinstein Listening In Motion Condition
    desc: One 13 minute video
    factors:
      playerCount: 2
      gameStages:
        - name: Intro
          type: prompt
          prompt:
            - weinstein_listening/intro_videos.md
          duration: 45
        - name: Video - How to listen in motion
          type: video
          url: https://youtu.be/FNcG-OtPpJU
        - name: Attention Check Quiz
          type: prompt
          duration: 120
          prompt:
            - weinstein_listening/motion_expert.md
            - weinstein_listening/motion_technique.md
            - weinstein_listening/motion_strategies.md
        - name: Reflect on Rejection
          type: prompt
          duration: 120
          prompt:
            - weinstein_listening/reflect_rejection.md
        - name: Discussion
          type: discussion
          prompt: weinstein_listening/topic_rejection.md
          duration: 600
      exitSurveys:
        - ListeningQualityPartner
        - ListeningQualityOwn
        - AutonomyNeedSatisfaction
        - LonelinessSingleItem
        - Demographics
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

## Development

to start the container for development, use:
`docker-compose -f docker-compose-dev.yml up`

# deliberation-empirica

## Development

Empirica V2 framework

to start the container for development, use:
`docker-compose -f docker-compose-dev.yml up`

or if you have trouble and want to clean things up a bit:
`docker-compose -f docker-compose-dev.yml up -V --force-recreate --remove-orphans`

### Code StyleCheck and Basic Debugging

This project uses Eslint to enforce coding style and automatically debug certain issues.

If not installed already, first [install](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) the ESLint VSCode extension.

Next, to install the relevant dependencies and enable linting in your local development environment, run the command `npm run lint` in a terminal opened at the root directory. The terminal will then display a list of current errors, if there are any.

You do not need to run this command again so long as the dependencies are still installed locally. Any files containing errors will red in the VSCode Explorer, and the code causing the errors underlined.

## Troubleshooting:

One easy way to deal with broken dependencies is to rebuild the container from scratch, using the command:
to rebuild the container use:
`docker-compose -f docker-compose-dev.yml build --no-cache`

Empirica stores session data in `./empirica/local/tajriba.json`.
If there is an issue where empirica's data gets corrupted, you can clear the working database
by deleting this file. Empricia will start with a fresh slate, and rebuild the file based on
actions you take from then on.

#### Docker

Docker sometimes gets too messy and says things like 'no space left'. If you want to delete old images, this command will clear everything from docker (even other containers from other projects, so be careful).
`docker system prune -a --volumes`

Quick get player ids:
`cat .empirica/local/tajriba.json | grep "Participant" | jq ".obj.Identifier"`

Get survey responses:
`cat .empirica/local/tajriba.json | grep "Survey" | jq ".obj.val" | sed 's/\\//g' | cut -c2- | rev | cut -c2- | rev | jq`

#### References

- https://www.cypress.io/blog/2019/01/03/stop-using-page-objects-and-start-using-app-actions/
- https://www.cypress.io/blog/2019/02/28/shrink-the-untestable-code-with-app-actions-and-effects/
