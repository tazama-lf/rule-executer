// SPDX-License-Identifier: Apache-2.0
import {
  CreateDatabaseManager,
  LoggerService,
  type DatabaseManagerInstance,
} from '@frmscoe/frms-coe-lib';
import {
  StartupFactory,
  type IStartupService,
} from '@frmscoe/frms-coe-startup-lib';
import cluster from 'cluster';
import NodeCache from 'node-cache';
import os from 'os';
import './apm';
import { config } from './config';
import { execute } from './controllers/execute';

export const loggerService: LoggerService = new LoggerService(
  config.sidecarHost,
);
export let server: IStartupService;

const databaseManagerConfig = {
  redisConfig: {
    db: config.redis.db,
    servers: config.redis.servers,
    password: config.redis.password,
    isCluster: config.redis.isCluster,
  },
  transactionHistory: {
    certPath: config.transactionHistoryCertPath,
    databaseName: config.transactionHistoryName,
    user: config.transactionHistoryUser,
    password: config.transactionHistoryPassword,
    url: config.transactionHistoryURL,
  },
  configuration: {
    url: config.configurationURL,
    user: config.configurationUser,
    password: config.configurationPassword,
    databaseName: config.configDb,
    certPath: config.configurationCertPath,
    localCacheEnabled: !!config.cacheTTL,
    localCacheTTL: config.cacheTTL,
  },
  pseudonyms: {
    url: config.pseudonymsURL,
    user: config.pseudonymsUser,
    password: config.pseudonymsPassword,
    databaseName: config.graphDb,
    certPath: config.pseudonymsCertPath,
    localCacheEnabled: !!config.cacheTTL,
    localCacheTTL: config.cacheTTL,
  },
};

let databaseManager: DatabaseManagerInstance<typeof databaseManagerConfig>;
const logContext = 'startup';

const runServer = async (): Promise<void> => {
  server = new StartupFactory();
  if (config.nodeEnv !== 'test') {
    let isConnected = false;
    for (let retryCount = 0; retryCount < 10; retryCount++) {
      loggerService.log(
        'Connecting to nats server...',
        logContext,
        config.functionName,
      );
      if (
        !(await server.init(
          execute,
          loggerService,
          [`sub-rule-${config.ruleName}@${config.ruleVersion}`],
          `pub-rule-${config.ruleName}@${config.ruleVersion}`,
        ))
      ) {
        loggerService.warn(
          `Unable to connect, retry count: ${retryCount}`,
          logContext,
          config.functionName,
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        loggerService.log('Connected to nats', logContext, config.functionName);
        isConnected = true;
        break;
      }
    }

    if (!isConnected) {
      throw new Error('Unable to connect to nats after 10 retries');
    }
  }
};
const numCPUs =
  os.cpus().length > config.maxCPU ? config.maxCPU + 1 : os.cpus().length + 1;

export const initializeDB = async (): Promise<void> => {
  const manager = await CreateDatabaseManager(databaseManagerConfig);
  databaseManager = manager;
  loggerService.log(
    JSON.stringify(databaseManager.isReadyCheck()),
    logContext,
    config.functionName,
  );
};

process.on('uncaughtException', (err) => {
  loggerService.error(
    `process on uncaughtException error: ${JSON.stringify(err)}`,
    logContext,
    config.functionName,
  );
});

process.on('unhandledRejection', (err) => {
  loggerService.error(
    `process on unhandledRejection error: ${JSON.stringify(err)}`,
    logContext,
    config.functionName,
  );
});

if (cluster.isPrimary && config.maxCPU !== 1) {
  loggerService.log(`Primary ${process.pid} is running`);

  // Fork workers.
  for (let i = 1; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    loggerService.log(
      `worker ${Number(worker.process.pid)} died, starting another worker`,
    );
    cluster.fork();
  });
} else {
  if (process.env.NODE_ENV !== 'test') {
    (async () => {
      try {
        await initializeDB();
        await runServer();
      } catch (err) {
        loggerService.error(
          'Error while starting services',
          err as Error,
          logContext,
          config.functionName,
        );
        process.exit(1);
      }
    })();
  }
}

export const cache = new NodeCache();
export { databaseManager, runServer };
