FROM etherpad/etherpad

# taken from base image
WORKDIR "${EP_DIR}"  

# Install Caddy for reverse proxy
USER root
RUN apk add caddy

# Copy entrypoint script and caddy config
COPY entrypoint.sh /scripts/entrypoint.sh
RUN chmod +x /scripts/entrypoint.sh
COPY Caddyfile /scripts/Caddyfile

# Set up etherpad settings
RUN mkdir /opt/etherpad-lite/data
COPY settings.json /opt/etherpad-lite/settings.json



# Install better-sqlite3
WORKDIR /opt/etherpad-lite/src
RUN npm install better-sqlite3

USER etherpad

EXPOSE 80

ENTRYPOINT ["/scripts/entrypoint.sh"]
# ENTRYPOINT [ "/bin/bash" ]