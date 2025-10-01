# Deliberation Lab: Conversation Experiments at the Scale of Surveys

The Deliberation Lab is a virtual laboratory for conducting tightly controlled conversation experiments at the scale of survey research. The platform automates the entire experimental workflow—from participant consent and onboarding, through live video, audio, or text-based conversations, to outcome measurement and debriefing. By removing the logistical bottlenecks of traditional conversation research, the Deliberation Lab enables researchers to run orders of magnitude more trials with less effort, lower cost, and faster turnaround.

Every experiment on the platform is fully documented, replicable, and traceable by design. Each datapoint is recorded with a complete description of its experimental condition, and exports include all relevant metadata—what participants saw, when, and under which conditions. Samples are registered at the moment of randomization and pushed to version-controlled repositories in real time, preserving a full audit trail of the data generation process. Separate audio and video tracks are recorded for each participant, and conversations are featurized using cutting-edge automated analysis tools, enabling structured behavioral comparisons across studies.

Because the platform is remote-first, researchers can recruit participants from anywhere in the world with an internet connection—while maintaining uniform treatment delivery. Every participant receives identical instructions, interventions, and interfaces, regardless of geography or time zone. This approach enhances the external validity of conversation studies, especially in an era when video-based interaction is widespread. And because data is structured consistently across trials, researchers can easily compare results across studies or conduct robust meta-analyses across cultural or contextual boundaries.

The Deliberation Lab is also highly flexible and researcher-friendly. Experiments are defined using human-readable manifest files that function like movie scripts—specifying the flow of stages, conditional logic, and stimuli shown at each point. Prompts and instructions are written in simple markdown, while surveys are selected from a library of pre-built, versioned instruments, scored consistently and comparably across studies. A powerful templating syntax allows researchers to evaluate subtle condition variations, adapt existing paradigms, or develop entirely new designs—all without writing code. The result is a system that supports rapid iteration, low-friction customization, and collaboration across teams.

Together, these features allow researchers to systematically explore the context-dependence of conversational interventions. The platform makes it easy to vary group size and composition, communication format, instructions, and stimuli—while holding other variables constant. Researchers can test hypotheses about mechanisms, conduct cross-cultural comparisons, and build a cumulative, generalizable knowledge base—not just within a single lab, but across the entire field of conversation research. The Deliberation Lab is not just a tool for running experiments—it is infrastructure for a new kind of conversation science, where results are not only reproducible, but meaningfully comparable across studies, teams, and time.

##

Deliberation Empirica is the platform we use to run synchronous and asynchronous deliberation studies. The server in this repository powers the production deployment; you can also run it locally to prototype studies quickly.

## Quick Start

1. **Install tools**
   - VS Code and the Deliberation Lab VS Code extension.
   - Node.js LTS.
   - Empirica CLI (`npm install -g @empirica/cli`).
   - Docker Desktop (only needed for production packaging and full test runs).
   - GitHub Desktop (optional but simplifies cloning/pushing).
2. **Clone repositories**
   ```bash
   git clone https://github.com/Watts-Lab/deliberation-empirica.git
   git clone https://github.com/Watts-Lab/deliberation-assets.git
   ```
   Switch to a working branch for your study inside `deliberation-assets`.
3. **Configure environment**
   - Copy `.env.example` to `.env` at the project root if present, or create `.env` with the keys listed in the “Environment Variables” section below.
   - For local-only runs you can start with the placeholder values shown below.
4. **Install and build**
   ```bash
   npm run build
   ```
5. **Start the local stack**
   ```bash
   npm run start
   ```
   This launches Empirica, the mock CDN, and Etherpad (development-only helpers controlled by `runner.sh`).
6. **Log in to the admin console** at `http://localhost:3000/admin` (default password `localpwd` if you used the placeholder `.env`).

## Running the Annotated Demo Locally

The annotated example in `cypress/fixtures/mockCDN/example/demo_annotated` is a full-featured study that demonstrates conditional matching, video chat, reusable templates, and survey integrations.

1. Serve the assets from `deliberation-assets` if you plan to edit them:
   ```bash
   cd deliberation-assets
   npx serve -l 9090 --cors
   ```
   Leave this running while you work.
2. In the Empirica admin console (`/admin` → _New batch_ → _Custom_), paste the contents of `cypress/fixtures/mockCDN/example/demo_annotated/dev.config.json`. This config points to the annotated treatment file and enables the async intro/exit sequences.
3. After the batch shows a green **Start** button, click it and open two browser windows at `http://localhost:3000`.
4. Walk through the intro questionnaire once as a Democrat and once as a Republican as described in `demo_annotated/README.md`. You’ll see the cross-party matching, timed discussion stage, partner-specific prompts, and exit surveys called out in the treatment file.

For additional single-player demos (e.g., quick UI tours) use the configs in `cypress/fixtures/mockCDN/projects/example/README.md`.

## Developing Your Own Study

1. **Work from `deliberation-assets`**
   - Copy `example/demo_annotated` to a new folder (e.g., `santoro/partner_swap/v1`) or use the skeleton already created in your branch.
   - Author markdown prompts in `intro/`, `game/`, and `exit/` folders to keep asynchronous and synchronous content organized.
   - Define your study flow in `*.treatments.yaml`. Start by editing the annotated template: duplicate a treatment, rename it, and adjust `playerCount`, `groupComposition`, `gameStages`, and `exitSequence`.
2. **Reference key docs**
   - `docs/treatments.md` (element catalog and schema details)
   - `docs/templates.md` (reusable treatment pieces)
   - `docs/batchConfig.md` (fields accepted by batch configs)
   - `docs/preflightChecklist.md` (production checklist)
3. **Validate frequently**
   - `npm run lint` catches common client/server issues with ESLint.
   - The Deliberation Lab VS Code extension surfaces schema errors inside treatment files.
   - The “mock CDN” served by `npx serve` mirrors production hosting, so you can catch missing/incorrect asset paths early.
4. **Test with Cypress flows**
   - The E2E suites in `cypress/e2e` cover templates, breakout rooms, video checks, and more. Use them as executable examples—e.g., `14_Templates.js` demonstrates how templated treatments map to player assignments, while `15_Breakout_Rooms.js` walks through a four-player video check.
   - To run specific tests locally: `npm run cypress -- --spec cypress/e2e/14_Templates.js`.
5. **Prepare for production**
   - Update `*.config.json` to point at your study’s assets on GitHub/S3.
   - Follow `docs/preflightChecklist.md` for Terraform/ECS rollout, CDN validation, and monitoring.
   - Keep the `batchName`, `dataRepos`, and `videoStorage` fields distinct between staging tests and live data collection.

## Environment Variables

Create `.env` at the project root:

```
DAILY_APIKEY=none
QUALTRICS_API_TOKEN=none
QUALTRICS_DATACENTER=none
ETHERPAD_API_KEY=none
ETHERPAD_BASE_URL=none
DELIBERATION_MACHINE_USER_TOKEN=none
EMPIRICA_ADMIN_PW=localpwd
TEST_CONTROLS=enabled
GITHUB_PRIVATE_DATA_OWNER=none
GITHUB_PUBLIC_DATA_OWNER=none
GITHUB_PRIVATE_DATA_REPO=none
GITHUB_PRIVATE_DATA_BRANCH=none
GITHUB_PUBLIC_DATA_REPO=none
GITHUB_PUBLIC_DATA_BRANCH=none
```

Replace the placeholder values as soon as you integrate video chat, Qualtrics surveys, or GitHub data export.

## Repository Tour

- `server/` – Empirica server code: batch setup, random assignment, data export.
- `client/` – Participant UI built with React; intro checks, video call, stage rendering.
- `cypress/` – Test harness, reusable commands, mock CDN fixtures (see `projects/example` and `example/demo_annotated` for canonical study assets).
- `docs/` – Reference documentation. Start with `docs/index.md` (overview), then dive into treatments, batch config, and preflight guides.
- `runner.sh` – Development launcher used by `npm run start`.

## Troubleshooting

- Reset a corrupted local Empirica DB by deleting `empirica/local/tajriba.json`.
- Logs live in `data/empirica.log`; Cypress suites truncate this file automatically before each run.
- If `npm run start` fails, confirm Docker Desktop is running (needed for the bundled Etherpad container).
- For video-call issues, verify `DAILY_APIKEY` is set and that browsers meet the support table in `docs/index.md`.

---

Need help? Ask in Slack or open an issue—include config JSON, treatment file path, and relevant log excerpts for fastest triage.
