import path from 'path';
import { config as dotenv } from 'dotenv';
import { type IConfig } from './interfaces/iConfig';

// Load .env file into process.env if it exists. This is convenient for running locally.
dotenv({
  path: path.resolve(__dirname, '../.env'),
});

export const config: IConfig = {
  ruleName: process.env.RULE_NAME as string,
  logger: {
    logstashHost: process.env.LOGSTASH_HOST as string,
    logstashPort: parseInt(process.env.LOGSTASH_PORT ?? '0', 10),
    logstashLevel: (process.env.LOGSTASH_LEVEL as string) || 'info',
  },
  restPort: parseInt(process.env.REST_PORT || '3000', 10),
  functionName: process.env.FUNCTION_NAME as string,
  apmLogging: process.env.APM_LOGGING === 'true',
  apmSecretToken: process.env.APM_SECRET_TOKEN as string,
  ruleVersion: process.env.RULE_VERSION as string,
  cacheTTL: parseInt(process.env.CACHE_TTL || '3000', 10),
  apmURL: process.env.APM_URL as string,
  nodeEnv: process.env.NODE_ENV as string,
  dbName: process.env.DATABASE_NAME as string,
  dbURL: process.env.DATABASE_URL as string,
  dbUser: process.env.DATABASE_USER as string,
  dbPassword: process.env.DATABASE_PASSWORD as string,
  collectionNamePacs008: process.env.COLLECTION_NAME_PACS008 as string,
  dbCertPath: process.env.DATABASE_CERT_PATH as string,
  configCollection: process.env.CONFIG_COLLECTION as string,
  configDb: process.env.CONFIG_DATABASE as string,
  graphDb: process.env.GRAPH_DATABASE as string,
  graphCollection: process.env.GRAPH_COLLECTION as string,
  redis: {
    db: parseInt(process.env.REDIS_DB!, 10) || 0,
    servers: JSON.parse(
      (process.env.REDIS_SERVERS as string) ||
        '[{"hostname": "127.0.0.1", "port":6379}]',
    ),
    password: process.env.REDIS_AUTH as string,
    isCluster: process.env.REDIS_IS_CLUSTER === 'true',
  },
};
