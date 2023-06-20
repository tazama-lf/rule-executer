import path from 'path';
import { config as dotenv } from 'dotenv';
import { IConfig } from './interfaces/iConfig';

// Load .env file into process.env if it exists. This is convenient for running locally.
dotenv({
  path: path.resolve(__dirname, '../.env'),
});

export const config: IConfig = {
  ruleName: <string>process.env.RULE_NAME,
  logstashHost: <string>process.env.LOGSTASH_HOST,
  logstashPort: parseInt(process.env.LOGSTASH_PORT || '0', 10),
  restPort: parseInt(process.env.REST_PORT || '3000', 10),
  functionName: <string>process.env.FUNCTION_NAME,
  apmLogging: <boolean>(process.env.APM_LOGGING === 'true'),
  apmSecretToken: <string>process.env.APM_SECRET_TOKEN,
  ruleVersion: <string>process.env.RULE_VERSION,
  cacheTTL: parseInt(process.env.CACHE_TTL || '3000', 10),
  apmURL: <string>process.env.APM_URL,
  nodeEnv: <string>process.env.NODE_ENV,
  dbName: <string>process.env.DATABASE_NAME,
  dbURL: <string>process.env.DATABASE_URL,
  dbUser: <string>process.env.DATABASE_USER,
  dbPassword: <string>process.env.DATABASE_PASSWORD,
  collectionNamePacs008: <string>process.env.COLLECTION_NAME_PACS008,
  dbCertPath: <string>process.env.DATABASE_CERT_PATH,
  configCollection: <string>process.env.CONFIG_COLLECTION,
  configDb: <string>process.env.CONFIG_DATABASE,
  graphDb: <string>process.env.GRAPH_DATABASE,
  graphCollection: <string>process.env.GRAPH_COLLECTION,
  redis: {
    auth: <string>process.env.REDIS_AUTH,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    host: <string>process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
};
