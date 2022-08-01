# deliberation-empirica
Empirica V2 framework

to start the container for development, use:
`docker-compose -f docker-compose-dev.yml up`

or if you have trouble and want to clean things up a bit:
`docker-compose -f docker-compose-dev.yml up -V --force-recreate --remove-orphans`


You can access empirica by visiting
```
http://localhost:3000/
```

## Development
The videocall component is disabled by default in the development environment (to save calls to the eyeson API). When you want to check that the videocall is working, you can add `&videoCall=true` to the url parameters, such as:

```
http://localhost:3000/?playerKey=test_8995078598070&videoCall=true
```

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
Docker sometimes gets too messy and says things like 'no space left'. You want to delete old images:
`docker system prune`

Quick get player ids:
`cat .empirica/local/tajriba.json | grep "Participant" | jq ".obj.Identifier"`