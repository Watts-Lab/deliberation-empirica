# deliberation-empirica
Empirica V2 framework

to start the container for development, use:
`docker-compose -f docker-compose-dev.yml up`

to rebuild the container use:
`docker-compose -f docker-compose-dev.yml build --no-cache`

## Repo Structure
This repository contains two submodules:
- /client/src/components/surveys
- /client/src/components/empirica-videocall

These components are pieces of shared infrastructure that we expect other projects in the lab and beyond the
lab may wish to take advantage of outside the context of our deliberation experiments. Structuring them
as separate repositories that can be included into other projects means that we can easily share these 
components, while also keeping them closely attached to the bulk of our code. This also means that 
other people can collaborate with us to develop these components without needing to make changes to 
our larger empirica project.

This design choice does  increase the project complexity somewhat, though, as changes to these components 
will need to be committed in separate commits to their own repository. 