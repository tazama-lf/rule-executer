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
  apmURL: process.env.APM_URL as string,
  nodeEnv: process.env.NODE_ENV as string,
  transactionHistoryCertPath: process.env
    .TRANSACTIONHISTORY_DATABASE_CERT_PATH as string,
  transactionHistoryName: process.env.TRANSACTIONHISTORY_DATABASE as string,
  transactionHistoryPassword: process.env
    .TRANSACTIONHISTORY_DATABASE_PASSWORD as string,
  transactionHistoryURL: process.env.TRANSACTIONHISTORY_DATABASE_URL as string,
  transactionHistoryUser: process.env
    .TRANSACTIONHISTORY_DATABASE_USER as string,
  configDb: process.env.CONFIG_DATABASE as string,
  configurationCertPath: process.env.CONFIG_DATABASE_CERT_PATH as string,
  configurationURL: process.env.CONFIG_DATABASE_URL as string,
  configurationPassword: process.env.CONFIG_DATABASE_PASSWORD as string,
  configurationUser: process.env.CONFIG_DATABASE_USER as string,
  graphDb: process.env.PSEUDONYMS_DATABASE as string,
  pseudonymsURL: process.env.PSEUDONYMS_DATABASE_URL as string,
  pseudonymsUser: process.env.PSEUDONYMS_DATABASE_USER as string,
  pseudonymsPassword: process.env.PSEUDONYMS_DATABASE_PASSWORD as string,
  pseudonymsCertPath: process.env.PSEUDONYMS_DATABASE_CERT_PATH as string,
  redis: {
    db: parseInt(process.env.REDIS_DB!, 10) || 0,
    servers: JSON.parse(
      process.env.REDIS_SERVERS! || '[{"hostname": "127.0.0.1", "port":6379}]',
    ),
    password: process.env.REDIS_AUTH!,
    isCluster: process.env.REDIS_IS_CLUSTER === 'true',
  },
  sidecarHost: process.env.SIDECAR_HOST!,
};
