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