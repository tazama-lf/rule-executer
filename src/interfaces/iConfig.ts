import { type RedisConfig } from '@frmscoe/frms-coe-lib/lib/interfaces';
export interface IConfig {
  logger: {
    logstashHost: string;
    logstashPort: number;
    logstashLevel: string;
  };
  functionName: string;
  ruleName: string;
  apmLogging: boolean;
  apmSecretToken: string;
  ruleVersion: string;
  cacheTTL: number;
  apmURL: string;
  nodeEnv: string;
  dbURL: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbCertPath: string;
  configDb: string;
  graphDb: string;
  redis: RedisConfig;
}
