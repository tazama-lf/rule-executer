// SPDX-License-Identifier: Apache-2.0
import path from 'path';
import { config as dotenv } from 'dotenv';
import { type IConfig } from './interfaces/iConfig';

// Load .env file into process.env if it exists. This is convenient for running locally.
dotenv({
  path: path.resolve(__dirname, '../.env'),
});

export const config: IConfig = {
  ruleName: process.env.RULE_NAME!,
  logger: {
    logstashHost: process.env.LOGSTASH_HOST!,
    logstashPort: parseInt(process.env.LOGSTASH_PORT ?? '0', 10),
    logstashLevel: process.env.LOGSTASH_LEVEL! || 'info',
  },
  functionName: process.env.FUNCTION_NAME!,
  apmLogging: process.env.APM_ACTIVE === 'true',
  apmSecretToken: process.env.APM_SECRET_TOKEN!,
  ruleVersion: process.env.RULE_VERSION!,
  cacheTTL: parseInt(process.env.CACHE_TTL || '3000', 10),
  apmURL: process.env.APM_URL!,
  nodeEnv: process.env.NODE_ENV!,
  transactionHistoryCertPath:
    process.env.TRANSACTION_HISTORY_DATABASE_CERT_PATH!,
  transactionHistoryName: process.env.TRANSACTION_HISTORY_DATABASE!,
  transactionHistoryPassword:
    process.env.TRANSACTION_HISTORY_DATABASE_PASSWORD!,
  transactionHistoryURL: process.env.TRANSACTION_HISTORY_DATABASE_URL!,
  transactionHistoryUser: process.env.TRANSACTION_HISTORY_DATABASE_USER!,
  configDb: process.env.CONFIG_DATABASE!,
  configurationCertPath: process.env.CONFIG_DATABASE_CERT_PATH!,
  configurationURL: process.env.CONFIG_DATABASE_URL!,
  configurationPassword: process.env.CONFIG_DATABASE_PASSWORD!,
  configurationUser: process.env.CONFIG_DATABASE_USER!,
  graphDb: process.env.PSEUDONYMS_DATABASE!,
  pseudonymsURL: process.env.PSEUDONYMS_DATABASE_URL!,
  pseudonymsUser: process.env.PSEUDONYMS_DATABASE_USER!,
  pseudonymsPassword: process.env.PSEUDONYMS_DATABASE_PASSWORD!,
  pseudonymsCertPath: process.env.PSEUDONYMS_DATABASE_CERT_PATH!,
  redis: {
    db: parseInt(process.env.REDIS_DB!, 10) || 0,
    servers: JSON.parse(
      process.env.REDIS_SERVERS! || '[{"hostname": "127.0.0.1", "port":6379}]',
    ),
    password: process.env.REDIS_AUTH!,
    isCluster: process.env.REDIS_IS_CLUSTER === 'true',
  },
  sidecarHost: process.env.SIDECAR_HOST!,
  maxCPU: parseInt(process.env.MAX_CPU!, 10) || 1,
};
