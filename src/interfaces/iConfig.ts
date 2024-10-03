// SPDX-License-Identifier: Apache-2.0
import { type RedisConfig } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import { type DBConfig } from '@tazama-lf/frms-coe-lib/lib/services/dbManager';

export interface IConfig {
  logstashLevel: string;
  functionName: string;
  ruleName: string;
  ruleVersion: string;
  cacheTTL: number;
  nodeEnv: string;
  configDBConfig: DBConfig;
  pseudonymsDBConfig: DBConfig;
  transactionHistoryDBConfig: DBConfig;
  redis: RedisConfig;
  sidecarHost?: string;
  maxCPU: number;
}
