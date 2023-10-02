ARG BUILD_IMAGE=oven/bun
ARG RUN_IMAGE=oven/bun

FROM ${BUILD_IMAGE} AS builder
LABEL stage=build
# TS -> JS stage

WORKDIR /home/app
COPY ./src ./src
COPY ./package*.json ./
COPY ./tsconfig.json ./
COPY bunfig.toml ./
ARG GH_TOKEN
RUN sed -i "s/\${GH_TOKEN}/$GH_TOKEN/g" ./bunfig.toml

RUN bun install --production


# Stage 2 (Remove Unneeded Node Modules)
FROM ${BUILD_IMAGE} AS dep-resolver
LABEL stage=pre-prod
# To filter out dev dependencies from final build

COPY package*.json ./
COPY bunfig.toml ./
ARG GH_TOKEN


# Stage 3 (Run Image - Everything above not included in final build)
FROM ${RUN_IMAGE} AS run-env
#USER nonroot

WORKDIR /home/app
COPY deployment.yaml ./
COPY service.yaml ./
COPY ./src ./src
COPY ./package*.json ./
COPY ./tsconfig.json ./
COPY bunfig.toml ./
RUN bun install --production
# Turn down the verbosity to default level.
ENV NPM_CONFIG_LOGLEVEL warn

ENV FUNCTION_NAME="rule-executer-rel-1-0-0"
ENV RULE_VERSION="1.0.0"
ENV RULE_NAME="901"
ENV NODE_ENV=production

# Apm
ENV APM_ACTIVE=true
ENV APM_URL=http://apm-server.development.svc.cluster.local:8200/
ENV APM_SECRET_TOKEN=

#Logstash
ENV LOGSTASH_HOST=logstash.development.svc.cluster.local
ENV LOGSTASH_PORT=8080
ENV LOGSTASH_LEVEL='info'



# Database
ENV DATABASE_NAME="transactionHistory"
ENV DATABASE_URL=
ENV DATABASE_USER="root"
ENV DATABASE_PASSWORD=
ENV DATABASE_CERT_PATH="/usr/local/share/ca-certificates/ca-certificates.crt"
ENV CONFIG_DATABASE=Configuration
ENV CONFIG_COLLECTION=configuration
ENV GRAPH_DATABASE=pseudonyms
ENV CACHE_TTL=300

# Redis
ENV REDIS_DB=0
ENV REDIS_AUTH=
ENV REDIS_SERVERS=
ENV REDIS_IS_CLUSTER=


#Nats
ENV STARTUP_TYPE=nats
ENV SERVER_URL=0.0.0.0:4222
ENV PRODUCER_STREAM=
ENV CONSUMER_STREAM=
ENV STREAM_SUBJECT=
ENV ACK_POLICY='None'
ENV PRODUCER_STORAGE=File
ENV PRODUCER_RETENTION_POLICY=Workqueue

ENV QUOTING=false

ENV prefix_logs="false"

# Set healthcheck command
HEALTHCHECK --interval=60s CMD [ -e /tmp/.lock ] || exit 1

# Execute watchdog command
CMD ["bun", "src/index.ts"]
