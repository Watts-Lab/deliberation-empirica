# Setup for Tool Developers

Use this guide if you are going to **modify the Deliberation Lab codebase** (client/server, providers, build tooling) and want to run the development stack locally.

If you only need to run experiments locally to design/test studies, see **Setup for Researchers**.

---

## 1. Install prerequisites

1. **Git + GitHub Desktop.**
   - Install GitHub Desktop from [https://desktop.github.com/download/](https://desktop.github.com/download/) (macOS and Windows). It provides a friendly GUI for commits _and_ installs the Git CLI that VS Code and our scripts rely on.
   - After installing, open a terminal and run `git --version` to ensure the binary is on your PATH. On Linux (or if you prefer not to use GitHub Desktop) install Git via your package manager instead.
2. **Visual Studio Code.**
   - Download from [https://code.visualstudio.com](https://code.visualstudio.com) so you have the editor we use throughout the docs.
   - After VS Code launches, install the **Deliberation Lab Tools** extension from the [Marketplace](https://marketplace.visualstudio.com/items?itemName=deliberation-lab.deliberation-lab-tools); it adds templates, commands, and validations used later in the guide.
3. **Node.js 18+.**
   - macOS/Linux: `curl https://get.volta.sh | bash` then `volta install node@18`.
   - Windows: install via [https://nodejs.org](https://nodejs.org).
     Node includes `npm`, which we’ll use for all remaining commands.
4. **Docker Desktop** _(optional, only needed for Etherpad)_. If you plan to test live-editable shared text entry boxes locally, install Docker from [https://www.docker.com](https://www.docker.com).

---

## 2. Clone the `deliberation-empirica` repository

This repo contains the code for running experiments in deliberation lab.

```bash
git clone https://github.com/Watts-Lab/deliberation-empirica.git
cd deliberation-empirica
```

All remaining commands assume you are in this directory.

---

## 3. Bootstrap tooling and configuration

Run the build helper once per checkout:

```bash
npm run build
```

What this does:

- Installs the Empirica CLI if it is missing.
- Copies `default.env` ➜ `.env` (only if `.env` doesn’t exist). Edit `.env` later with real secrets when you integrate external services.
- Installs the Empirica-managed dependencies inside `server/` and `client/`.

If the command exits cleanly, the codebase is ready to start.

---

## 4. (Optional) Start the local Etherpad service

If you want to test the Etherpad live documents experience locally, launch it in a separate terminal:

```bash
npm run start:etherpad
```

The script:

- Verifies Docker is installed and running (attempting to start it if possible).
- Builds the `deliberation-etherpad` image the first time.
- Runs a container named `deliberation-etherpad-dev` on `http://localhost:9001`.
- Streams logs until you press `Ctrl+C`, then automatically stops and removes the container and image.

Skip this step if you are connecting to a remote Etherpad service or don’t need chat for your demo.

---

## 5. Launch the Deliberation Lab dev stack

In another terminal window, start the main stack:

```bash
npm run start
```

This script:

1. Cleans the `data/` folder so you start from a fresh state.
2. Launches a mock content server on port `9091`.
3. Starts Empirica with the environment variables in `.env`.

Once Empirica finishes booting, you can open the admin app at `http://localhost:3000/admin`.

---

## 6. Create the annotated demo batch

1. Visit `http://localhost:3000/admin` and log in with the credentials you configured in `.env` (defaults to `admin` and `localpwd`).
2. Click **New Batch → Custom**.
3. Open `cypress/fixtures/mockCDN/demo/annotated_demo/dev.config.json` and copy its contents into the JSON editor. This will start the demo study.
4. Click **Create Batch**, then **Start** to open it for participants.

---

## 7. Join as participants

1. Open `http://localhost:3000/` in one or more browser windows (incognito tabs let you simulate multiple players).
2. Walk through the onboarding, intro sequence, and discussion flow.
3. Watch the admin dashboard to confirm participants register and advance through stages as expected.

---

## 8. Inspect logs and data exports

- Deliberation Lab writes a live log to `data/empirica.log`.
- State is stored in `data/tajriba.json`.
- Any prompts, preregistration exports, or mock data files live under `data/*.jsonl`.

Stop the stack with `Ctrl+C` in the terminal running `npm run start`. If you started Etherpad, stop it with `Ctrl+C` in that terminal as well (the helper will clean up the container and Docker image automatically).
