import { config } from './config';
import NodeCache from 'node-cache';
import App from './app';
import apm from 'elastic-apm-node';
import {
  CreateDatabaseManager,
  DatabaseManagerInstance,
  LoggerService,
} from '@frmscoe/frms-coe-lib';

export const loggerService: LoggerService = new LoggerService();

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

const runServer = () => {
  /**
   * KOA Rest Server
   */
  const app = new App();

  app.listen(config.restPort, () => {
    loggerService.log(`Rest Server listening on port ${config.restPort}`);
  });
  return app;
};

export const init = async () => {
  const manager = await CreateDatabaseManager(databaseManagerConfig);
  databaseManager = manager;
};

process.on('uncaughtException', (err) => {
  loggerService.error(`process on uncaughtException error: ${err}`);
});

process.on('unhandledRejection', (err) => {
  loggerService.error(`process on unhandledRejection error: ${err}`);
});

try {
  if (process.env.NODE_ENV !== 'test') {
    runServer();
    (async () => {
      await init();
    })();
  }
} catch (err) {
  loggerService.error('Error while starting HTTP server', err as Error);
}

export const cache = new NodeCache();
export { databaseManager, runServer };
