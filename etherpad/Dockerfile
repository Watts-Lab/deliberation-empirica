FROM etherpad/etherpad

ARG APIKEY

RUN mkdir /opt/etherpad-lite/data
RUN echo ${APIKEY} > /opt/etherpad-lite/APIKEY.txt
COPY settings.json /opt/etherpad-lite/settings.json

WORKDIR /opt/etherpad-lite/src
RUN npm install better-sqlite3

EXPOSE 9001

WORKDIR /opt/etherpad-lite/
# ENTRYPOINT [ "/bin/bash" ]