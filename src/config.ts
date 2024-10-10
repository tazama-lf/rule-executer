// SPDX-License-Identifier: Apache-2.0
import path from 'path';
import { config as dotenv } from 'dotenv';
import { type IConfig } from './interfaces/iConfig';
import {
  validateDatabaseConfig,
  validateProcessorConfig,
  validateRedisConfig,
  validateEnvVar,
  validateLocalCacheConfig,
} from '@tazama-lf/frms-coe-lib/lib/helpers/env';
import { Database } from '@tazama-lf/frms-coe-lib/lib/helpers/env/database.config';

const generalConfig = validateProcessorConfig();
const authEnabled = generalConfig.nodeEnv === 'production';
const redisConfig = validateRedisConfig(authEnabled);
const configuration = validateDatabaseConfig(
  authEnabled,
  Database.CONFIGURATION,
);
const pseudonyms = validateDatabaseConfig(authEnabled, Database.PSEUDONYMS);
const transactionHistory = validateDatabaseConfig(
  authEnabled,
  Database.TRANSACTION_HISTORY,
);
const localCacheConfig = validateLocalCacheConfig();

// Load .env file into process.env if it exists. This is convenient for running locally.
dotenv({
  path: path.resolve(__dirname, '../.env'),
});

const ruleName = validateEnvVar<string>('RULE_NAME', 'string');
const ruleVersion = validateEnvVar<string>('RULE_VERSION', 'string');

export const config: IConfig = {
  ruleName,
  ruleVersion,
  functionName: generalConfig.functionName,
  nodeEnv: generalConfig.nodeEnv,
  maxCPU: generalConfig.maxCPU,
  sidecarHost: validateEnvVar('SIDECAR_HOST', 'string', true),
  logstashLevel: validateEnvVar('LOGSTASH_LEVEL', 'string'),
  db: {
    transactionHistory,
    configuration,
    pseudonyms,
    redisConfig,
    localCacheConfig,
  },
};
