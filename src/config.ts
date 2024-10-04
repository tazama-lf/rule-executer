// SPDX-License-Identifier: Apache-2.0
import path from 'path';
import { config as dotenv } from 'dotenv';
import { type IConfig } from './interfaces/iConfig';
import {
  validateDatabaseConfig,
  validateProcessorConfig,
  validateRedisConfig,
  validateEnvVar,
} from '@tazama-lf/frms-coe-lib/lib/helpers/env';
import { Database } from '@tazama-lf/frms-coe-lib/lib/helpers/env/database.config';

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
const transactionHistoryDBConfig = validateDatabaseConfig(
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
  logstashLevel: validateEnvVar('LOGSTASH_LEVEL', 'string'),
  functionName: generalConfig.functionName,
  ruleVersion,
  cacheTTL: validateEnvVar('CACHETTL', 'number'),
  nodeEnv: generalConfig.nodeEnv,
  transactionHistoryDBConfig,
  configDBConfig,
  pseudonymsDBConfig,
  redis: redisConfig,
  sidecarHost: validateEnvVar('SIDECAR_HOST', 'string', true),
  maxCPU: generalConfig.maxCPU,
};
