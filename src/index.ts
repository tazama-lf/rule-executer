import { config } from './config';
import NodeCache from 'node-cache';
import { StartupFactory, IStartupService } from 'startup';
import apm from 'elastic-apm-node';
import {
  CreateDatabaseManager,
  DatabaseManagerInstance,
  LoggerService,
} from '@frmscoe/frms-coe-lib';
import { execute } from './controllers/execute';

export const loggerService: LoggerService = new LoggerService();
export let server: IStartupService;
if (config.apmLogging) {
  apm.start({
    serviceName: config.functionName,
    secretToken: config.apmSecretToken,
    serverUrl: config.apmURL,
    usePathAsTransactionName: true,
    transactionIgnoreUrls: ['/health'],
  });
}

const databaseManagerConfig = {
  redisConfig: {
    db: config.redis.db,
    host: config.redis.host,
    password: config.redis.auth,
    port: config.redis.port,
  },
  transactionHistory: {
    certPath: config.dbCertPath,
    databaseName: config.dbName,
    user: config.dbUser,
    password: config.dbPassword,
    url: config.dbURL,
  },
  configuration: {
    url: config.dbURL,
    user: config.dbUser,
    password: config.dbPassword,
    databaseName: config.configDb,
    certPath: config.dbCertPath,
    localCacheEnabled: !!config.cacheTTL,
    localCacheTTL: config.cacheTTL,
  },
  pseudonyms: {
    url: config.dbURL,
    user: config.dbUser,
    password: config.dbPassword,
    databaseName: config.graphDb,
    certPath: config.dbCertPath,
    localCacheEnabled: !!config.cacheTTL,
    localCacheTTL: config.cacheTTL,
  },
};

let databaseManager: DatabaseManagerInstance<typeof databaseManagerConfig>;

const runServer = async () => {
  server = new StartupFactory();
  if (config.nodeEnv !== 'test')
    for (let retryCount = 0; retryCount < 10; retryCount++) {
      loggerService.log(`Connecting to nats server...`);
      if (!(await server.init(execute))) {
        loggerService.warn(`Unable to connect, retry count: ${retryCount}`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        loggerService.log(`Connected to nats`);
        break;
      }
    }
};

export const initializeDB = async () => {
  const manager = await CreateDatabaseManager(databaseManagerConfig);
  databaseManager = manager;
  loggerService.log(JSON.stringify(databaseManager.isReadyCheck()));
};

process.on('uncaughtException', (err) => {
  loggerService.error(`process on uncaughtException error: ${err}`);
});

process.on('unhandledRejection', (err) => {
  loggerService.error(`process on unhandledRejection error: ${err}`);
});

try {
  if (process.env.NODE_ENV !== 'test') {
    (async () => {
      await initializeDB();
      runServer();
    })();
  }
} catch (err) {
  loggerService.error('Error while starting HTTP server', err as Error);
}

export const cache = new NodeCache();
export { databaseManager, runServer };
