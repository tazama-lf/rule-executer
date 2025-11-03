// SPDX-License-Identifier: Apache-2.0
import { NetworkMap, RuleConfig, RuleRequest, RuleResult } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import { DataCacheSample, NetworkMapSample, Pacs002Sample } from '@tazama-lf/frms-coe-lib/lib/tests/data';
import * as ruleLogic from 'rule/lib';
import { configuration, databaseManager, initializeDB, runServer, server } from '../../src';
import { execute } from '../../src/controllers/execute';
import determineOutcome from '../../src/helpers/determineOutcome';

jest.mock('@tazama-lf/frms-coe-lib/lib/services/dbManager', () => ({
  CreateStorageManager: jest
    .fn()
    .mockReturnValue({ db: { getRuleConfig: jest.fn(), isReadyCheck: jest.fn().mockReturnValue({ nodeEnv: 'test' }) } }),
}));

jest.mock('@tazama-lf/frms-coe-lib/lib/config/processor.config', () => ({
  validateProcessorConfig: jest.fn().mockReturnValue({ functionName: 'test-rule-executor', nodeEnv: 'test', maxCPU: 1 }),
}));

jest.mock('@tazama-lf/frms-coe-startup-lib/lib/interfaces/iStartupConfig', () => ({
  startupConfig: {
    startupType: 'nats',
    consumerStreamName: 'consumer',
    serverUrl: 'server',
    producerStreamName: 'producer',
    functionName: 'producer',
  },
}));

const ruleConfig: RuleConfig = {
  id: 'DEFAULT-001@1.1.0',
  tenantId: 'DEFAULT',
  desc: 'Test Rule',
  cfg: '1.0.0',
  config: {
    parameters: { testParam: 'testParamValue' },
    exitConditions: [{ subRuleRef: '.x01', reason: 'Exit Example x01' }],
    bands: [
      { subRuleRef: '.01', upperLimit: 1, reason: 'Band Example 01' },
      { subRuleRef: '.02', lowerLimit: 1, upperLimit: 2, reason: 'Band Example 02' },
    ],
    cases: {
      expressions: [],
      alternative: {
        subRuleRef: 'case01',
        reason: 'testCaseReason',
      },
    },
    timeframes: [{ threshold: 0 }],
  },
};

const ruleRes: RuleResult = {
  cfg: '1.0',
  id: '003@1.0',
  tenantId: 'DEFAULT',
  subRuleRef: '',
  prcgTm: undefined,
  reason: undefined,
  indpdntVarbl: 0,
};

const getMockRequest = () => {
  const quote: RuleRequest = {
    transaction: Object.assign({}, Pacs002Sample),
    networkMap: NetworkMapSample[0],
    DataCache: Object.assign({}, DataCacheSample),
  };
  return quote;
};

beforeAll(async () => {
  await initializeDB();
  await runServer();
});

afterAll((done) => {
  done();
});

describe('Logic Service', () => {
  let responseSpy: jest.SpyInstance;

  beforeEach(() => {
    configuration.RULE_NAME = '003';
    configuration.RULE_VERSION = '1.0';

    jest.spyOn(ruleLogic, 'handleTransaction').mockImplementationOnce(async (): Promise<RuleResult> => {
      return Promise.resolve(ruleRes);
    });

    jest.resetModules();
    jest.mock('@tazama-lf/frms-coe-startup-lib/lib/interfaces/iStartupConfig', () => ({ startupType: 'nats' }));
  });

  describe('execute', () => {
    it('should respond with rule result of true for happy path ', async () => {
      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig> => {
        const rc: RuleConfig = { ...ruleConfig };
        return await Promise.resolve(rc);
      });

      const expectedReq = getMockRequest();

      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

      await execute(expectedReq);

      expect(responseSpy).toHaveBeenCalledWith({ ...expectedReq, metaData: undefined, ruleResult: ruleRes });
    });

    it('should respond with rule result - ruleConfig - exitConditions are undefined ', async () => {
      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig> => {
        const rc: RuleConfig = { ...ruleConfig, config: { exitConditions: undefined } };
        return await Promise.resolve(rc);
      });

      const expectedReq = getMockRequest();

      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

      await execute(expectedReq);

      expect(responseSpy).toHaveBeenCalledWith({ ...expectedReq, metaData: undefined, ruleResult: ruleRes });
    });

    it('should respond with rule result - ruleConfig - bands are undefined ', async () => {
      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig> => {
        const rc: RuleConfig = { ...ruleConfig, config: { bands: undefined } };
        return await Promise.resolve(rc);
      });

      const expectedReq = getMockRequest();

      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

      await execute(expectedReq);

      expect(responseSpy).toHaveBeenCalledWith({ ...expectedReq, metaData: undefined, ruleResult: ruleRes });
    });

    it('should respond with rule result .err - ruleConfig: config is undefined ', async () => {
      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig> => {
        const rc = {
          ...ruleConfig,
          config: undefined,
        };
        return (await Promise.resolve(rc)) as unknown as RuleConfig;
      });

      const errRuleResult: RuleResult = {
        ...ruleRes,
        subRuleRef: '.err',
        reason: 'Rule processor configuration not retrievable',
        indpdntVarbl: ruleRes.indpdntVarbl,
      };

      const expectedReq = getMockRequest();

      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

      await execute(expectedReq);

      expect(responseSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction: expectedReq.transaction,
          networkMap: expectedReq.networkMap,
          ruleResult: expect.objectContaining({
            cfg: '1.0',
            id: '003@1.0',
            subRuleRef: errRuleResult.subRuleRef,
            reason: errRuleResult.reason,
            indpdntVarbl: errRuleResult.indpdntVarbl,
          }),
        }),
      );
    });

    it('should respond with rule result .err - no matching rule cfg ', async () => {
      configuration.RULE_NAME = 'abcdefghijklmnop';
      configuration.RULE_VERSION = '1.99999999999';

      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig> => {
        const rc: RuleConfig = { ...ruleConfig, config: { bands: undefined } };
        return await Promise.resolve(rc);
      });

      const errRuleResult: RuleResult = {
        ...ruleRes,
        subRuleRef: '.err',
        reason: 'Rule not found in network map',
        indpdntVarbl: ruleRes.indpdntVarbl,
      };

      const NoRuleCfg = '';

      const expectedReq = getMockRequest();

      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

      await execute(expectedReq);

      expect(responseSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleResult: expect.objectContaining({
            cfg: NoRuleCfg,
            id: 'abcdefghijklmnop@1.99999999999',
            subRuleRef: errRuleResult.subRuleRef,
            reason: errRuleResult.reason,
            indpdntVarbl: errRuleResult.indpdntVarbl,
          }),
        }),
      );
    });

    it('should fail if unable to parse - missing properties ', async () => {
      jest.spyOn(databaseManager, 'getRuleConfig').mockRejectedValueOnce(async (): Promise<RuleConfig[][]> => {
        return await Promise.reject('BAD');
      });

      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

      type PartialRuleRequest = Partial<RuleRequest>;

      // No transaction in request
      let expectedReq: PartialRuleRequest = getMockRequest();
      delete expectedReq.transaction;
      await execute(expectedReq);

      expect(responseSpy).toHaveBeenCalledTimes(0);

      // No networkMap in request
      expectedReq = getMockRequest();
      delete expectedReq.networkMap;

      await execute(expectedReq);
      expect(responseSpy).toHaveBeenCalledTimes(0);

      // No DataCache in request
      expectedReq = getMockRequest();
      delete expectedReq.DataCache;

      await execute(expectedReq);
      expect(responseSpy).toHaveBeenCalledTimes(0);
    });

    it('should respond with rule result - handleTransaction fail ', async () => {
      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig> => {
        const rc: RuleConfig = { ...ruleConfig };
        return await Promise.resolve(rc);
      });

      const handleTransactionErrMsg = 'BAD';

      jest.spyOn(ruleLogic, 'handleTransaction').mockRestore();
      jest.spyOn(ruleLogic, 'handleTransaction').mockImplementationOnce(() => {
        throw new Error(handleTransactionErrMsg);
      });

      const expectedReq = getMockRequest();

      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

      await execute(expectedReq);

      expect(responseSpy).toHaveBeenCalledWith(
        expect.objectContaining({ ruleResult: expect.objectContaining({ subRuleRef: '.err', reason: handleTransactionErrMsg }) }),
      );
    });

    it('should fail on bad handleResponse', async () => {
      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig> => {
        const rc: RuleConfig = { ...ruleConfig };
        return await Promise.resolve(rc);
      });

      const expectedReq = getMockRequest();

      jest.spyOn(server, 'handleResponse').mockRestore();
      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementation(() => {
        throw new Error('Endpoint down test');
      });

      await execute(expectedReq);

      expect(responseSpy).toThrow();
    });
  });

  describe('determineOutcome', () => {
    it('should complete with happy path', () => {
      const value = 3;

      const localRuleConfig: RuleConfig = {
        id: '003@1.0.0',
        tenantId: 'DEFAULT',
        desc: 'Test Rule',
        cfg: '1.0.0',
        config: {
          exitConditions: [{ subRuleRef: '.x01', reason: 'Exit Example x01' }],
          bands: [
            { subRuleRef: '.01', upperLimit: 1, reason: 'Band Example 01' },
            { subRuleRef: '.02', lowerLimit: 2, upperLimit: 5, reason: 'Band Example 02' },
          ],
        },
      };
      const result = determineOutcome(value, localRuleConfig, ruleRes);

      expect(result).toEqual(
        expect.objectContaining({
          cfg: ruleRes.cfg,
          id: ruleRes.id,
          reason: ruleRes.reason,
          subRuleRef: ruleRes.subRuleRef,
          indpdntVarbl: 3,
        }),
      );
    });

    it('should complete with .err when has bands and has cases', () => {
      const value = 3;

      const localRuleConfig: RuleConfig = {
        id: '003@1.0.0',
        tenantId: 'DEFAULT',
        desc: 'Test Rule',
        cfg: '1.0.0',
        config: {
          exitConditions: [{ subRuleRef: '.x01', reason: 'Exit Example x01' }],
          bands: [
            { subRuleRef: '.01', upperLimit: 1, reason: 'Band Example 01' },
            { subRuleRef: '.02', lowerLimit: 1, upperLimit: 2, reason: 'Band Example 02' },
          ],
          cases: {
            expressions: [],
            alternative: {
              subRuleRef: 'case01',
              reason: 'testCaseReason',
            },
          },
        },
      };
      const result = determineOutcome(value, localRuleConfig, ruleRes);

      expect(result).toEqual(
        expect.objectContaining({
          cfg: ruleRes.cfg,
          id: ruleRes.id,
          reason: 'Rule processor configuration invalid',
          subRuleRef: ruleRes.subRuleRef,
          indpdntVarbl: 3,
        }),
      );
    });
    it('should error when value is bad', () => {
      const value: number = NaN;

      const localRuleConfig: RuleConfig = {
        id: '003@1.0.0',
        tenantId: 'DEFAULT',
        desc: 'Test Rule',
        cfg: '1.0.0',
        config: {
          exitConditions: [{ subRuleRef: '.x01', reason: 'Exit Example x01' }],
          bands: [
            { subRuleRef: '.01', upperLimit: 1, reason: 'Band Example 01' },
            { subRuleRef: '.02', lowerLimit: 1, upperLimit: 2, reason: 'Band Example 02' },
          ],
        },
      };

      try {
        determineOutcome(value, localRuleConfig, ruleRes);
        throw new Error('UNREACHABLE');
      } catch (err) {
        expect(err).toEqual(new Error('Value provided undefined, so cannot determine rule outcome'));
      }
    });
  });
});
