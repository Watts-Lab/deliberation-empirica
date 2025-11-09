# Building a Study

This guide explains how to author treatments, organize assets, validate your study locally, and promote it to production.

## 1. Organize Study Assets

We recommend mirroring the annotated example:

```
projects/<projectName>/<studyName>/
  intro/      # asynchronous pre-randomization steps
  game/       # synchronous stages during the live discussion
  exit/       # asynchronous post-discussion materials
  topics/     # stimuli shared across sections
  <study>.treatments.yaml
  <study>.config.json
```

Keep markdown files close to where they’re first used; reuse is clearer when a file appears in multiple sections (e.g., `intro/all_mandatory.md` also used in exit).

## 2. Author Treatments

1. Start from `cypress/fixtures/mockCDN/example/demo_annotated/demo.treatments.yaml`. It demonstrates:
   - `templates` for reusing substructures (`topicPrompt`, `crossPartisanDiscussion`).
   - `groupComposition` to match Democrats and Republicans using intro survey data.
   - `gameStages` with timed prompts, timers, submit buttons, and discussion elements.
   - `exitSequence` mixing markdown prompts, dynamic displays, and canned surveys.
2. Duplicate a treatment in your study file and rename it. Adjust the following:
   - `playerCount` and number of `positions` in `groupComposition`.
   - Stage durations and `elements`. Refer to [treatments.md](treatments.md) for all element types (qualtrics, audio cues, separators, timers, etc.).
   - `discussion` settings (`chatType`, `showNickname`, `showTitle`) for video or text chat.
3. Use templates to capture shared structure across conditions. The `templates` doc shows how `14_Templates.js` exercises nested templates and conditional logic.
4. Annotate complex blocks with brief comments—future collaborators benefit from quick orientation when revisiting stages or conditional logic.

## 3. Configure Batches

Create two config files alongside your treatment file:

- `dev.config.json` for local runs (point `cdn` to `test` and omit repos).
- `<study>.config.json` for production (set `cdn: "prod"`, add `dataRepos`, `videoStorageLocation`, etc.).

Reference [batchConfig.md](batchConfig.md) for every field; the cypress config in `cypress/fixtures/mockCDN/tests/15_Breakout_Rooms/test.config.json` is a practical example that enables equipment checks and custom exit codes.

## 4. Host Assets Locally

While you iterate:

```bash
cd deliberation-assets
npx serve -l 9090 --cors
```

Update your batch config to reference `http://localhost:9090/<path>` if you need live edits; once committed to GitHub the production CDN mirrors `projects/<projectName>/...`.

## 5. Validate

- **Static checks**: The Deliberation Lab VS Code extension surfaces schema errors; `npm run lint` keeps the JS/TS codebase healthy.
- **Runtime checks**: Launch local batches regularly. Use multiple browser profiles, or run Cypress suites with custom player keys (`14_Templates.js`, `15_Breakout_Rooms.js`) to simulate complicated flows.
- **Server logs**: Watch `data/empirica.log` while you test. The Cypress helpers clear this file per test run (`cy.exec("truncate -s 0 ../data/empirica.log")`)—mirror this manually if you run flows by hand.

## 6. Prepare for Production

Follow `docs/preflightChecklist.md` once your study passes local validation:

1. Tag and deploy the Docker image via Terraform.
2. Upload treatment and asset files to GitHub (the production CDN syncs from there; allow 5–10 minutes).
3. Update the batch config with production `dataRepos`, `videoStorageLocation`, and AWS region.
4. Create a test batch on the production admin site, verify logs (`Initialized Batch ...`), and run through the study end-to-end.
5. After QA, duplicate the config, adjust `batchName`, and create the sample batch for live participants.

## 7. Monitor & Iterate

During data collection:

- Track AWS CloudWatch logs, Sentry alerts, Daily video dashboards, and S3 object uploads.
- Use the admin console’s batch status to verify lobby sizes and active players.
- If issues arise, capture the exact config JSON, treatment name, and player workflow so the engineering team can reproduce quickly.

With this workflow you can move from idea → prototype → production while fully leveraging the platform’s features.
