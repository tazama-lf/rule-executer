// SPDX-License-Identifier: Apache-2.0
import {
  DatabaseManagerInstance,
  LoggerService,
  ManagerConfig,
} from '@tazama-lf/frms-coe-lib';
import {
  NetworkMap,
  RuleConfig,
  RuleRequest,
  RuleResult,
} from '@tazama-lf/frms-coe-lib/lib/interfaces';
import ioredis from 'ioredis-mock';
import { handleTransaction } from 'rule/lib';
import { initializeDB, runServer, server } from '../../src';
import { config } from '../../src/config';
import { execute } from '../../src/controllers/execute';
import {
  Pacs002Sample,
  NetworkMapSample,
  DataCacheSample,
} from '@tazama-lf/frms-coe-lib/lib/tests/data';

jest.mock('@tazama-lf/frms-coe-lib/lib/helpers/env', () => ({
  validateAPMConfig: jest.fn().mockReturnValue({
    apmServiceName: '',
  }),
  validateLogConfig: jest.fn().mockReturnValue({}),
  validateProcessorConfig: jest.fn().mockReturnValue({
    functionName: 'test-rule-exec',
    nodeEnv: 'test',
    maxCPU: 0,
  }),
  validateEnvVar: jest.fn().mockReturnValue(''),
  validateRedisConfig: jest.fn().mockReturnValue({
    db: 0,
    servers: [
      {
        host: 'redis://localhost',
        port: 6379,
      },
    ],
    password: '',
    isCluster: false,
  }),
  validateDatabaseConfig: jest.fn().mockReturnValue({}),
}));

jest.mock('@tazama-lf/frms-coe-lib/lib/helpers/env/database.config', () => ({
  Database: {
    CONFIGURATION: 'MOCK_DB',
    TRANSACTION_HISTORY: 'MOCK_DB',
    PSEUDONYMS: 'MOCK_DB',
  },
}));

jest.mock(
  '@tazama-lf/frms-coe-startup-lib/lib/interfaces/iStartupConfig',
  () => ({
    startupConfig: {
      startupType: 'nats',
      consumerStreamName: 'consumer',
      serverUrl: 'server',
      producerStreamName: 'producer',
      functionName: 'producer',
    },
  }),
);

const getMockRequest = () => {
  const quote: RuleRequest = {
    transaction: Object.assign({}, Pacs002Sample),
    networkMap: Object.assign(new NetworkMap(), NetworkMapSample),
    DataCache: Object.assign({}, DataCacheSample),
  };
  return quote;
};

const loggerService: LoggerService = new LoggerService();

beforeAll(async () => {
  await initializeDB();
  runServer();
});

afterAll(() => {});

describe('Logic Service', () => {
  beforeEach(() => {
    config.ruleVersion = '1.0.0';
    jest.mock('ioredis', () => ioredis);
    jest
      .fn(handleTransaction)
      .mockImplementation(
        (
          req: RuleRequest,
          determineOutcome: (
            value: number,
            ruleConfig: RuleConfig,
            ruleResult: RuleResult,
          ) => RuleResult,
          ruleRes: RuleResult,
          loggerService,
          ruleConfig: RuleConfig,
          databaseManager: DatabaseManagerInstance<ManagerConfig>,
        ): Promise<RuleResult> => {
          return Promise.resolve(ruleRes);
        },
      );
  });

  describe('execute', () => {
    it('should respond with rule result of true for happy path', async () => {
      const expectedReq = getMockRequest();
      let resString: string = '';
      server.handleResponse = (reponse: unknown): Promise<void> => {
        resString = reponse as string;
        return Promise.resolve();
      };

      const res = await execute(expectedReq as any);
      expect(resString).toBeTruthy();
    });
  });
});
