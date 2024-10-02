// SPDX-License-Identifier: Apache-2.0
import { type RedisConfig } from '@tazama-lf/frms-coe-lib/lib/interfaces';

export interface IConfig {
  logstashLevel: string;
  functionName: string;
  ruleName: string;
  ruleVersion: string;
  cacheTTL: number;
  nodeEnv: string;
  configurationURL: string;
  configurationUser: string;
  configurationPassword: string;
  configDb: string;
  configurationCertPath: string;
  pseudonymsURL: string;
  pseudonymsUser: string;
  pseudonymsPassword: string;
  graphDb: string;
  pseudonymsCertPath: string;
  transactionHistoryCertPath: string;
  transactionHistoryName: string;
  transactionHistoryUser: string;
  transactionHistoryPassword: string;
  transactionHistoryURL: string;
  redis: RedisConfig;
  sidecarHost?: string;
  maxCPU: number;
}
