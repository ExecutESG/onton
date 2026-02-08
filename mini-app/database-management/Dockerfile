FROM python:3.11-alpine as base

ARG backup=digital-ocean-ontonbot.sql

WORKDIR /app

COPY . .

 #install neede dependency for image
RUN pip install python-dotenv && apk --update add postgresql-client

EXPOSE 8080

# RUN PGPASSWORD=AVNS_SF-V9s5GCKbRRhY9aL9 \
#     pg_dump -a \
#     -U doadmin \
#     -h modules-postgresql-fra1-96017-do-user-16430870-0.c.modules.ondigitalocean.com \
#     -p 25060 -d defaultdb -F p \ 
#     > ${backup}


FROM base AS dev

# RUN ping postgres

# ENTRYPOINT PGPASSWORD=8tVRRvb \
#     pg_restore -c \
#     -d ontondb \
#     -U onton \
#     -h postgres \
#     -p 5432 -F t -x --no-owner ${backup}



CMD [ "python3", "migrator_script.py" ]
