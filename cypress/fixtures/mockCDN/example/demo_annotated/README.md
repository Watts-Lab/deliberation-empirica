# Annotated demo

This folder contains files for an annotated demo experiment.

### treatment file

- `demo.treatments.yaml` describes what gets displayed to whom, when, and describes the full experiment flow from the participants perspective, for all treatments.

### batch config files

- `demo.config.json` is batch configuration items that set up the batch on the prod server.
- `dev.config.json` is batch configuration for running locally on your own machine.

### prompt and other resources

These resources can technically be placed anywhere, but for ease of management, we organize them as follows:

- `intro/` contains files first displayed during the asynchronous intro sequence (before randomization)
- `game/` contains files displayed during the synchronous portion
- `exit/` contains files displayed during the asynchronous exit sequence
- `topics/` lists the stimuli used across the experiment.

## Using this demo

This demo expects both a republican and democratic participant. Open the experiment in two separate browsers (eaisest) and make sure when prompted for party affiliation in the intro sequence to respond once as a democrat, and in the other window as a republican.
