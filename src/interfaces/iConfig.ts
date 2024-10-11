import { type ManagerConfig } from '@tazama-lf/frms-coe-lib/lib/services/dbManager';

export interface IConfig {
  logstashLevel: string;
  functionName: string;
  ruleName: string;
  ruleVersion: string;
  nodeEnv: string;
  sidecarHost?: string;
  maxCPU: number;
  db: ManagerConfig;
}
