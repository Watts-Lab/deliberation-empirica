# Production Dockerfile

FROM node:16-bullseye

WORKDIR /app

# Get empirica tools
RUN curl https://get.empirica.dev | sh

COPY . .

# install client dependencies
WORKDIR /app/client
RUN npm install

## install server dependencies
WORKDIR /app/server
RUN npm install

WORKDIR /app
CMD ["empirica"]