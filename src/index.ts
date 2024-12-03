// SPDX-License-Identifier: Apache-2.0
import {
  LoggerService,
  type DatabaseManagerInstance,
} from '@tazama-lf/frms-coe-lib';
import { Database } from '@tazama-lf/frms-coe-lib/lib/config/database.config';
import { validateProcessorConfig } from '@tazama-lf/frms-coe-lib/lib/config/processor.config';
import { Cache } from '@tazama-lf/frms-coe-lib/lib/config/redis.config';
import {
  CreateStorageManager,
  type ManagerConfig,
} from '@tazama-lf/frms-coe-lib/lib/services/dbManager';
import {
  StartupFactory,
  type IStartupService,
} from '@tazama-lf/frms-coe-startup-lib';
import cluster from 'cluster';
import os from 'os';
import './apm';
import { additionalEnvironmentVariables, type Configuration } from './config';
import { execute } from './controllers/execute';

let configuration = validateProcessorConfig(
  additionalEnvironmentVariables,
) as Configuration;

export const loggerService: LoggerService = new LoggerService(configuration);
export let server: IStartupService;

let databaseManager: DatabaseManagerInstance<ManagerConfig>;
const logContext = 'startup';

const runServer = async (): Promise<void> => {
  server = new StartupFactory();
  if (configuration.nodeEnv !== 'test') {
    let isConnected = false;
    for (let retryCount = 0; retryCount < 10; retryCount++) {
      loggerService.log(
        'Connecting to nats server...',
        logContext,
        configuration.functionName,
      );
      if (
        !(await server.init(
          execute,
          loggerService,
          [`sub-rule-${configuration.RULE_NAME}@${configuration.RULE_VERSION}`],
          `pub-rule-${configuration.RULE_NAME}@${configuration.RULE_VERSION}`,
        ))
      ) {
        loggerService.warn(
          `Unable to connect, retry count: ${retryCount}`,
          logContext,
          configuration.functionName,
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        loggerService.log(
          'Connected to nats',
          logContext,
          configuration.functionName,
        );
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
  os.cpus().length > configuration.maxCPU
    ? configuration.maxCPU + 1
    : os.cpus().length + 1;

export const initializeDB = async (): Promise<void> => {
  const auth = configuration.nodeEnv === 'production';
  const { config, db } = await CreateStorageManager(
    [
      Database.CONFIGURATION,
      Database.PSEUDONYMS,
      Database.TRANSACTION_HISTORY,
      Cache.LOCAL,
    ],
    auth,
  );
  databaseManager = db;
  configuration = { ...configuration, ...config };
  loggerService.log(
    JSON.stringify(databaseManager.isReadyCheck()),
    logContext,
    configuration.functionName,
  );
};

process.on('uncaughtException', (err) => {
  loggerService.error(
    `process on uncaughtException error: ${JSON.stringify(err)}`,
    logContext,
    configuration.functionName,
  );
});

process.on('unhandledRejection', (err) => {
  loggerService.error(
    `process on unhandledRejection error: ${JSON.stringify(err)}`,
    logContext,
    configuration.functionName,
  );
});

if (cluster.isPrimary && configuration.maxCPU !== 1) {
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
          configuration.functionName,
        );
        process.exit(1);
      }
    })();
  }
}

export { configuration, databaseManager, runServer };
