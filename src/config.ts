// SPDX-License-Identifier: Apache-2.0
import path from 'path';
import { config as dotenv } from 'dotenv';
import { type IConfig } from './interfaces/iConfig';
import { validateProcessorConfig } from '@tazama-lf/frms-coe-lib/lib/helpers/env/processor.config';
import { validateRedisConfig } from '@tazama-lf/frms-coe-lib/lib/helpers/env/redis.config';
import {
  Database,
  validateDatabaseConfig,
} from '@tazama-lf/frms-coe-lib/lib/helpers/env/database.config';
import { validateEnvVar } from '@tazama-lf/frms-coe-lib/lib/helpers/env';

const generalConfig = validateProcessorConfig();
const authEnabled = generalConfig.nodeEnv === 'production';
const redisConfig = validateRedisConfig(authEnabled);
const configDBConfig = validateDatabaseConfig(
  authEnabled,
  Database.CONFIGURATION,
);
const pseudonymsDBConfig = validateDatabaseConfig(
  authEnabled,
  Database.PSEUDONYMS,
);
const transactionHistoryConfig = validateDatabaseConfig(
  authEnabled,
  Database.TRANSACTION_HISTORY,
);

// Load .env file into process.env if it exists. This is convenient for running locally.
dotenv({
  path: path.resolve(__dirname, '../.env'),
});

const ruleName = validateEnvVar<string>('RULE_NAME', 'string');
const ruleVersion = validateEnvVar<string>('RULE_VERSION', 'string');

export const config: IConfig = {
  ruleName,
  logstashLevel: 'info',
  functionName: generalConfig.functionName,
  ruleVersion,
  cacheTTL: validateEnvVar('CACHETTL', 'number'),
  nodeEnv: generalConfig.nodeEnv,
  transactionHistoryCertPath: transactionHistoryConfig.certPath,
  transactionHistoryName: transactionHistoryConfig.name,
  transactionHistoryPassword: transactionHistoryConfig.password ?? '',
  transactionHistoryURL: transactionHistoryConfig.url,
  transactionHistoryUser: transactionHistoryConfig.user,
  configDb: configDBConfig.name,
  configurationCertPath: configDBConfig.certPath,
  configurationURL: configDBConfig.url,
  configurationPassword: configDBConfig.password ?? '',
  configurationUser: configDBConfig.user,
  graphDb: pseudonymsDBConfig.name,
  pseudonymsURL: pseudonymsDBConfig.url,
  pseudonymsUser: pseudonymsDBConfig.user,
  pseudonymsPassword: pseudonymsDBConfig.password ?? '',
  pseudonymsCertPath: pseudonymsDBConfig.certPath,
  redis: redisConfig,
  sidecarHost: process.env.SIDECAR_HOST,
  maxCPU: generalConfig.maxCPU,
};
