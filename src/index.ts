import { config } from './config';
import NodeCache from 'node-cache';
import {
  StartupFactory,
  type IStartupService,
} from '@frmscoe/frms-coe-startup-lib';
import apm from 'elastic-apm-node';
import {
  CreateDatabaseManager,
  type DatabaseManagerInstance,
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
    servers: config.redis.servers,
    password: config.redis.password,
    isCluster: config.redis.isCluster,
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

const runServer = async (): Promise<void> => {
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

export const initializeDB = async (): Promise<void> => {
  const manager = await CreateDatabaseManager(databaseManagerConfig);
  databaseManager = manager;
  loggerService.log(JSON.stringify(databaseManager.isReadyCheck()));
};

process.on('uncaughtException', (err) => {
  loggerService.error(
    `process on uncaughtException error: ${JSON.stringify(err)}`,
  );
});

process.on('unhandledRejection', (err) => {
  loggerService.error(
    `process on unhandledRejection error: ${JSON.stringify(err)}`,
  );
});

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      await initializeDB();
      runServer();
    } catch (err) {
      loggerService.error('Error while starting HTTP server', err as Error);
    }
  })();
}

export const cache = new NodeCache();
export { databaseManager, runServer };
