# Creating a new study

This page walks you through setting the scaffolding for your first custom study.

> ### Prerequisites
>
> - Read the [Overview](overview.md) to understand the Deliberation Lab's basic functionality and design model.
> - Complete the [Setup](setup.md) steps, to launch the Deliberation Lab server locally and run a demo study.

In the setup steps, you worked only within the `deliberation-empirica` repository, which houses the code needed to run the Deliberation Lab server, and the test and demo experiments it ships with. In this stage, you'll work within the `deliberation-assets` repository which contains all of the code needed to run true studies in production.

In the current phase of Deliberation Lab's development, all experiments are hosted out of this repository. In addition to making it simpler to coordinate, this means that you can look to other studies run by other researchers as examples of how to set up your own study. I

---

## 1. Clone `deliberation-assets` and create a branch

First you'll need a local copy of the repository to work in. You can run the following commands to do this, or use github desktop.

Replace `my-name/my-new-study` in the commands below with a name that will help you keep track of your branch.

```bash
git clone https://github.com/Watts-Lab/deliberation-assets.git
cd deliberation-assets
git checkout -b my-name/my-new-study
```

---

## 2. Understand the design model

Deliberation Lab separates **content** (Markdown prompts, surveys, media) from **logic** (`*.treatments.yaml` files that orchestrate timing, chat, and assignment). Keeping them apart lets you iterate copy without touching control flow and reuse components across studies. When in doubt about syntax, refer to the Planning docs (`planning/treatments.md`, `planning/prompts.md`, etc.).

---

## 3. Prepare your study folder structure

Create a working folder inside `deliberation-assets` to house your study code. A common pattern is:

```
projects/
  <your-name>/
    <project-name>/
      v1/
        <files and subfolders>
```

Guidelines:

1. **Personal folder** (`demo/<your-name>/`) keeps all of your work separated from other contributors.
2. **Project folder** (`<project-name>/`) groups files for a single study (e.g., `democracy-forum`).
3. **Version folder** (`v1`, `v2`, …) lets you archive major changes without overwriting earlier iterations.

---

## 4. Start the local assets server

When run locally, the Deliberation Lab server looks for study content on port **9090**. To provide this content, we'll set up a static file server pointed at the root of `deliberation-assets`. From inside that repo run one of the following:

```bash
# Preferred (supports SPA routing + CORS)
npx serve -l 9090 --cors

# Fallbacks if you hit CORS/glob issues
npx http-server --cors -a localhost -p 9090
npx http-server --cors -a 127.0.0.1 -p 9090
```

Leave this terminal running while you work. Any time you edit assets, the server immediately serves the new files; no rebuild is needed.

---

## 5. Copy a demo template

Copy the contents of `/demo/simple_demo/` into your working folder. You should end up with a file structure that looks like:

```
projects/
  <your-name>/
    <project-name>/
      v1/
        exit/
          exit_question.md
        game/
          discussion_prompt.md
        intro/
          introduction.md
        dev.config.json
        simple_demo.treatments.yaml
```

---

## 6. Create and test a batch

1. Ensure your assets server (step 4) and Empirica stack (`npm run start` in `deliberation-empirica`) are both running.
2. Open `http://localhost:3000/admin`.
3. Create a new batch via **New Batch → Custom**, then paste the JSON from your study’s config file (for example `projects/<your-name>/<project-name>/v1/dev.config.json`).
4. Start the batch.
5. In a separate tab, visit `http://localhost:3000` in two separate browsers to play as the two participants in the study.

---

## 7. Customize your study

Now you're ready to customize your own study. Read through the documentation in the study design section to understand how to build out custom prompt files, structure treatment manifests, and use canned surveys and other features.
