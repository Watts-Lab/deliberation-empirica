FROM etherpad/etherpad

# Set up Caddy for reverse proxy
USER root
RUN apk add caddy
COPY Caddyfile /scripts/Caddyfile



# Copy entrypoint script
COPY entrypoint.sh /scripts/entrypoint.sh
RUN chmod +x /scripts/entrypoint.sh

# Set up etherpad settings
RUN mkdir /opt/etherpad-lite/data
COPY settings.json /opt/etherpad-lite/settings.json

USER etherpad

# Install better-sqlite3
WORKDIR /opt/etherpad-lite/src
RUN npm install better-sqlite3

WORKDIR /opt/etherpad-lite
EXPOSE 80

ENTRYPOINT ["/scripts/entrypoint.sh"]
# ENTRYPOINT [ "/bin/bash" ]