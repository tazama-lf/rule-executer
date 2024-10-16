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
import { configuration } from '../../src';
import { execute } from '../../src/controllers/execute';
import {
  Pacs002Sample,
  NetworkMapSample,
  DataCacheSample,
} from '@tazama-lf/frms-coe-lib/lib/tests/data';
import cluster from 'cluster';

jest.mock('@tazama-lf/frms-coe-lib/lib/config/processor.config', () => ({
  validateProcessorConfig: jest.fn().mockReturnValue({
    functionName: 'test-ed',
    nodeEnv: 'test',
  }),
}));

jest.mock('@tazama-lf/frms-coe-lib/lib/services/dbManager', () => ({
  CreateStorageManager: jest.fn().mockReturnValue({
    db: {
      set: jest.fn(),
      quit: jest.fn(),
      isReadyCheck: jest.fn().mockReturnValue({ nodeEnv: 'test' }),
    },
    config: {
      RULE_NAME: 'test-101',
      RULE_VERSION: '1.0.1',
    },
  }),
}));

jest.mock('@tazama-lf/frms-coe-lib/lib/services/apm', () => ({
  Apm: jest.fn().mockReturnValue({
    startSpan: jest.fn(),
    getCurrentTraceparent: jest.fn().mockReturnValue(''),
    startTransaction: jest.fn(),
  }),
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

const loggerService: LoggerService = new LoggerService(configuration);

beforeAll(async () => {
  await initializeDB();
  runServer();
});

afterAll(() => {
  if (cluster.isPrimary) {
    // Kill all workers

    Object.values(cluster.workers ?? {}).forEach((worker) => worker?.kill());
    console.log(cluster.workers);
  }
});

describe('Logic Service', () => {
  beforeEach(() => {
    configuration.RULE_VERSION = '1.0.0';
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
      server.handleResponse = (response: unknown): Promise<void> => {
        resString = response as string;
        return Promise.resolve();
      };

      const res = await execute(expectedReq as any);
      expect(resString).toBeTruthy();
    });
  });
});
