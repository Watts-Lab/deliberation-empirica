# Getting Started

This guide walks you from zero to a running local copy of Deliberation Empirica using the annotated demo assets.

## 1. Install Prerequisites

| Tool | Purpose | Link |
| ---- | ------- | ---- |
| VS Code | Editor with integrated debugging and extension support | https://code.visualstudio.com/ |
| Deliberation Lab VS Code extension | Treatment linting and helper snippets | https://marketplace.visualstudio.com/items?itemName=deliberation-lab.deliberation-lab-tools |
| Node.js LTS | JavaScript runtime for client/server tooling | https://nodejs.org/en |
| Empirica CLI | Required to run the Empirica core | `npm install -g @empirica/cli` |
| Docker Desktop | Needed for the bundled Etherpad container | https://www.docker.com/ |
| GitHub Desktop (optional) | Simplifies cloning and branch management | https://desktop.github.com/ |

Mac users can install most tools via Homebrew:

```bash
brew install --cask visual-studio-code docker github
brew install node
npm install -g @empirica/cli
```

## 2. Clone the Repositories

```bash
git clone https://github.com/Watts-Lab/deliberation-empirica.git
git clone https://github.com/Watts-Lab/deliberation-assets.git
```

If you were given a feature branch (e.g., `santoro-dev`), check it out in `deliberation-assets`:

```bash
cd deliberation-assets
git checkout santoro-dev
```

## 3. Configure Environment Variables

Create `.env` in the root of `deliberation-empirica`. For local testing you may use:

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

These placeholders disable external integrations so you can explore the UI safely.

## 4. Install Dependencies

From the `deliberation-empirica` folder:

```bash
npm run build
```

This installs Node packages, prepares the client bundle, and ensures the local Etherpad image is ready.

## 5. Start the Development Environment

```bash
npm run start
```

The helper script (`runner.sh`) launches:

- Empirica server on port 3000.
- Mock CDN on port 8080 (serving `cypress/fixtures/mockCDN`).
- Etherpad container for collaborative text editing.

Visit `http://localhost:3000/admin` and log in with the password from `.env`.

## 6. Launch the Annotated Demo

1. In the admin console choose *New batch* → *Custom*.
2. Paste the contents of `cypress/fixtures/mockCDN/example/demo_annotated/dev.config.json`.
3. Click **Create**, wait for validation, then click **Start**.
4. Open two browser windows at `http://localhost:3000`, complete the intro once as a Democrat and once as a Republican (per `demo_annotated/README.md`), and explore the synchronized stages.

If you prefer a single-player walkthrough, use one of the configs in `cypress/fixtures/mockCDN/projects/example/README.md`.

## 7. Next Steps

- Try editing copy in `demo_annotated/game/` and refresh the active stage to see changes.
- Explore the Cypress tests (`cypress/e2e/14_Templates.js`, `15_Breakout_Rooms.js`) for scripted examples of intro sequences, template-driven treatments, and breakout flows.
- Move on to [Building a Study](study-development.md) when you’re ready to adapt the demo to your research design.
