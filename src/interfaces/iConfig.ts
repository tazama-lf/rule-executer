export interface IConfig {
  restPort: number;
  logstashHost: string;
  logstashPort: number;
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
  collectionNamePacs008: string;
  dbCertPath: string;
  configDb: string;
  configCollection: string;
  graphDb: string;
  graphCollection: string;
  redis: {
    auth: string;
    db: number;
    host: string;
    port: number;
  };
}
