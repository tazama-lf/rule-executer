// SPDX-License-Identifier: Apache-2.0
import {
  DatabaseManagerInstance,
  LoggerService,
  ManagerConfig,
} from '@frmscoe/frms-coe-lib';
import {
  NetworkMap,
  RuleConfig,
  RuleRequest,
  RuleResult,
} from '@frmscoe/frms-coe-lib/lib/interfaces';
import ioredis from 'ioredis-mock';
import { handleTransaction } from 'rule/lib';
import { initializeDB, runServer, server } from '../../src';
import { config } from '../../src/config';
import { execute } from '../../src/controllers/execute';
import {
  Pacs002Sample,
  NetworkMapSample,
  DataCacheSample,
} from '@frmscoe/frms-coe-lib/lib/tests/data';

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
