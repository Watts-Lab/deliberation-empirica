---
name: Getting Started
about: Onboarding steps for new developers
title: "Onboarding {yourName}"
labels: Admin
assignees: ""
---

Welcome to the team! This template will walk you through everything you need to do to get started contributing to the deliberation project.

# Admin

- [ ] Set up a GitHub account (you should have this set up by the time you can use this template!)
- [ ] Connect with @shapeseas to:
  - [ ] Get added to [the deliberation github team](https://github.com/orgs/Watts-Lab/teams/deliberation/)
  - [ ] Get added to the deliberation slack channel
  - [ ] Complete hiring process through Workday and Onboard@Penn (if applicable)

# Set up tools

We use the following tools in our development workflow to help us collaborate effectively. Even if you have your own preferred tools, such as a git client or IDE (🤓), please make sure to set up and become familiar with the tools that we use as a team. This will allow you to assist others if they encounter problems with these tools.

- [ ] GitHub Desktop [https://desktop.github.com/](https://desktop.github.com/)
- [ ] Docker [https://docs.docker.com/get-docker/](https://docs.docker.com/get-docker/) </br>
- [ ] VS Code [https://code.visualstudio.com/download](https://code.visualstudio.com/download)
- [ ] VS Code extensions
  - [ ] [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) - code formatter
  - [ ] [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) - syntax and formatting checker
  - [ ] [Docker](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-docker) - containter tools
  - [ ] [YAML formatter](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) - syntax highlighting
  - [ ] [WindiCSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=voorjaar.windicss-intellisense) - syntax highlighting
  - [ ] [Live Share](https://marketplace.visualstudio.com/items?itemName=MS-vsliveshare.vsliveshare) - collaborate remotely
  - [ ] [Github Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot)
  - [ ] [Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat)
- [ ] Node https://nodejs.org/en/download/ (even though we develop in containers, we use node for running the test suite)

# Get the code

- [ ] If you're working on a Mac and using iCloud to back up your files, you may find that GitHub version control and iCloud's version control don't play well together. I would recommend creating a folder that isn't backed up to iCloud (for example at `~/github/`) for storing all your repositories.

- [ ] In this directory, use GH desktop to clone the following repository: https://github.com/Watts-Lab/deliberation-empirica.
- [ ] Create a branch of the deliberation-empirica repo, called something like `james-first-test` (but use your own name 🤔). When you make changes to the code, you'll make them in a branch, and submit a pull request to incorporate your changes into the `main` branch.



# Running the code
- [ ] In the `deliberation-empirica` directory, run `npm run build` to install the project dependencies.
- [ ] After building, run `npm run start` to start empirica

# Test

Everything we do, we test!

### End to end tests
- [ ] In the `deliberation-empirica/cypress` directory, run `npm install` to install the cypress testing dependencies.
- [ ] In the `deliberation-empirica` directory, use the command `npm run test` to launch cypress.

### Unit tests
We have some unit tests on the server code for functions that run in the background
- [ ] change to the `server` folder
- [ ] run `npm run test` to start the unit test suite


# Resources

The following describe the deliberation project:

- [ ] [_Is Deliberative Democracy a Falsifiable Theory? (Mutz, 2008)_](https://paperpile.com/shared/2nL9j6) - describes the primary motivation for our work
- [ ] Project outline (Get link or file from James Houghton)

Below are a set of resources for helping you complete the above tasks.

- [Docker overview](https://www.youtube.com/watch?v=gAkwW2tuIqE)
- (James) Here are two videos I used when I was learning docker. They're a bit long, but if you're already spending time on the treadmill or exercise bike (giving away my secrets here) its not too bad. 1. [Docker Tutorial for Beginners [FULL COURSE in 3 Hours]](https://www.youtube.com/watch?v=3c-iBn73dDE) - 2 hr 46 mins, 2. [Docker + ReactJS tutorial: Development to Production workflow + multi-stage builds + docker compose](https://www.youtube.com/watch?v=3xDAU5cvi5E) - 1 hr 25 mins
- Installing [Docker on Ubuntu](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-on-ubuntu-20-04)
