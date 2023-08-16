ARG BUILD_IMAGE=node:20-bullseye
ARG RUN_IMAGE=gcr.io/distroless/nodejs20-debian11:nonroot

# Stage 1 (Build with Dev Deps)
FROM ${BUILD_IMAGE} AS builder
LABEL stage=build
# TS -> JS stage

WORKDIR /home/app
COPY ./src ./src
COPY ./package*.json ./
COPY ./tsconfig.json ./
COPY .npmrc ./
ARG GH_TOKEN

RUN npm ci --ignore-scripts
RUN npm run build

# Stage 2 (Remove Unneeded Node Modules)
FROM ${BUILD_IMAGE} AS dep-resolver
LABEL stage=pre-prod
# To filter out dev dependencies from final build

COPY package*.json ./
COPY .npmrc ./
ARG GH_TOKEN
RUN npm ci --omit=dev --ignore-scripts

# Stage 3 (Run Image - Everything above not included in final build)
FROM ${RUN_IMAGE} AS run-env
USER nonroot

WORKDIR /home/app
COPY --from=dep-resolver /node_modules ./node_modules
COPY --from=builder /home/app/build ./build
COPY package.json ./
COPY deployment.yaml ./
COPY service.yaml ./

# Turn down the verbosity to default level.
ENV NPM_CONFIG_LOGLEVEL warn

ENV REST_PORT=3000
ENV FUNCTION_NAME="rule-executer-rel-1-0-0"
ENV RULE_VERSION="1.0.0"
ENV RULE_NAME="901"
ENV NODE_ENV="production"
ENV APM_LOGGING=true
ENV APM_URL=http://apm-server.development:8200
ENV APM_SECRET_TOKEN=
ENV LOGSTASH_HOST="logstash.development:8080"
ENV LOGSTASH_PORT=8080
ENV LOGSTASH_LEVEL='info'
ENV CACHE_TTL=300
ENV DATABASE_NAME="transactionHistory"
ENV DATABASE_URL=
ENV DATABASE_USER="root"
ENV DATABASE_PASSWORD=
ENV DATABASE_CERT_PATH="/usr/local/share/ca-certificates/ca-certificates.crt"
ENV COLLECTION_NAME_PACS008=transactionHistoryPacs008
ENV CONFIG_DATABASE=Configuration
ENV CONFIG_COLLECTION=configuration
ENV GRAPH_DATABASE=pseudonyms
ENV GRAPH_COLLECTION=transactionRelationship

ENV REDIS_DB=0
ENV REDIS_AUTH=
ENV REDIS_SERVERS=
ENV REDIS_IS_CLUSTER=

ENV STARTUP_TYPE=nats
ENV SERVER_URL=0.0.0.0:4222
ENV PRODUCER_STREAM=
ENV CONSUMER_STREAM=
ENV STREAM_SUBJECT=
ENV ACK_POLICY=Explicit
ENV PRODUCER_STORAGE=File
ENV PRODUCER_RETENTION_POLICY=Workqueue

ENV prefix_logs="false"

# Set healthcheck command
HEALTHCHECK --interval=60s CMD [ -e /tmp/.lock ] || exit 1
EXPOSE 4222

# Execute watchdog command
CMD ["build/index.js"]
