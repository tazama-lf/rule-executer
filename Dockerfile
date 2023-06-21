FROM --platform=${TARGETPLATFORM:-linux/amd64} ghcr.io/openfaas/of-watchdog:0.8.4 as watchdog
FROM --platform=${TARGETPLATFORM:-linux/amd64} node:16.17-alpine as ship

ARG TARGETPLATFORM
ARG BUILDPLATFORM

COPY --from=watchdog /fwatchdog /usr/bin/fwatchdog
RUN chmod +x /usr/bin/fwatchdog

RUN addgroup -S app && adduser -S -g app app

# Turn down the verbosity to default level.
ENV NPM_CONFIG_LOGLEVEL warn

# Create a folder named function
RUN mkdir -p /home/app

# Wrapper/boot-strapper
WORKDIR /home/app

COPY ./package.json ./
COPY ./package-lock.json ./
COPY ./tsconfig.json ./

# Install dependencies
RUN npm install

COPY ./src ./src

# Build the project
RUN npm run build

# Environment variables for openfaas
ENV cgi_headers="true"
ENV fprocess="node ./build/index.js"
ENV mode="http"
ENV upstream_url="http://127.0.0.1:3000"

ENV exec_timeout="10s"
ENV write_timeout="15s"
ENV read_timeout="15s"

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
ENV REDIS_HOST=
ENV REDIS_PORT=6379

ENV prefix_logs="false"

HEALTHCHECK --interval=60s CMD [ -e /tmp/.lock ] || exit 1

# Execute watchdog command
CMD ["fwatchdog"]
