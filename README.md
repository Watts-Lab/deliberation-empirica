# deliberation-empirica
Empirica V2 framework

to start the container for development, use:
`docker-compose -f docker-compose-dev.yml up -V --force-recreate --remove-orphans`

this will launch both Empirica and Storybook. If you only want empirica, you can type

`docker-compose -f docker-compose-dev.yml up -V --force-recreate --remove-orphans empirica`

or for storybook alone:

`docker-compose -f docker-compose-dev.yml up -V --force-recreate --remove-orphans storybook`

You can access storybook by visiting in your browser:
```
http://localhost:6006
```


You can access empirica by visiting
```
http://localhost:3000/
```


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


## Storybook
Storybook has no access to the usePlayer, useRound hooks. What this means is that we should build up our components to push the use of these hooks to the highest level possible (probably to the Stage.jsx level) and pass player and round down to the components as properties, so that we can make simple mocks for the player and round object in stories for the *pages* and on down.


## Ngrok
To launch an empirica version accessible over the web using ngrok, 
first create an ngrok configuration file called `ngrok.yml` in the
root directory of this repo, using `ngrok.yml.template` as a template.  Populate the template with your ngrok togen from 
https://dashboard.ngrok.com/get-started/setup 
(you'll need to make an ngrok account). 

then, use:
`docker-compose -f docker-compose-ngrok.yml up`

This still doesn't handle websockets properly...