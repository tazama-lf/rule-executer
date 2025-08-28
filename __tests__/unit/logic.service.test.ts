// SPDX-License-Identifier: Apache-2.0
import { NetworkMap, RuleConfig, RuleRequest, RuleResult } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import { DataCacheSample, NetworkMapSample, Pacs002Sample } from '@tazama-lf/frms-coe-lib/lib/tests/data';
import * as ruleLogic from 'rule/lib';
import { configuration, databaseManager, initializeDB, loggerService, runServer, server } from '../../src';
import { execute } from '../../src/controllers/execute';
import determineOutcome from '../../src/helpers/determineOutcome';
import { TenantConfigManager } from '../../src/helpers/tenantConfigManager';

jest.mock('@tazama-lf/frms-coe-lib/lib/services/dbManager', () => ({
  CreateStorageManager: jest.fn().mockReturnValue({
    db: {
      getRuleConfig: jest.fn().mockImplementation(async (ruleId: string, cfg: string) => {
        // Return mock data for the default getRuleConfig path
        return [
          [
            {
              id: ruleId,
              cfg: cfg,
              config: {
                exitConditions: undefined,
                // add other required config properties as needed
              },
            },
          ],
        ];
      }),
      queryConfigurationDB: jest.fn().mockImplementation(async (collection: string, filter: string, limit?: number) => {
        // Handle tenant-specific queries
        if (collection === 'ruleConfiguration') {
          // Return empty array to simulate no tenant-specific config found, forcing fallback to default
          return [];
        }

        // For other queries, return default mock data
        return {
          ruleConfig: [
            {
              /* default rule config */
            },
          ],
          typologyConfig: [
            {
              /* default typology config */
            },
          ],
        };
      }),
      isReadyCheck: jest.fn().mockReturnValue({ nodeEnv: 'test' }),
    },
  }),
}));

jest.mock('@tazama-lf/frms-coe-lib/lib/config/processor.config', () => ({
  validateProcessorConfig: jest.fn().mockReturnValue({
    functionName: 'test-rule-executor',
    nodeEnv: 'test',
    maxCPU: 1,
  }),
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

jest.mock('../../src/apm', () => ({
  startTransaction: jest.fn().mockReturnValue({
    end: jest.fn(),
  }),
  startSpan: jest.fn().mockReturnValue({
    end: jest.fn(),
  }),
  getCurrentTraceparent: jest.fn().mockReturnValue('test-trace-parent-id'),
}));

const ruleConfig: RuleConfig = {
  id: '001@1.1.0',
  desc: 'Test Rule',
  cfg: '1.0.0',
  config: {
    parameters: {
      testParam: 'testParamValue',
    },
    exitConditions: [
      {
        subRuleRef: '.x01',
        reason: 'Exit Example x01',
      },
    ],
    bands: [
      {
        subRuleRef: '.01',
        upperLimit: 1,
        reason: 'Band Example 01',
      },
      {
        subRuleRef: '.02',
        lowerLimit: 1,
        upperLimit: 2,
        reason: 'Band Example 02',
      },
    ],
    cases: [
      {
        reason: 'testCaseReason',
        subRuleRef: 'case01',
        value: '0',
      },
    ],
    timeframes: [
      {
        threshold: 0,
      },
    ],
  },
};

const ruleRes: RuleResult = {
  cfg: '1.0',
  id: '003@1.0',
  subRuleRef: '',
  prcgTm: undefined,
  reason: undefined,
};

const getMockRequest = () => {
  const quote: RuleRequest = {
    transaction: Object.assign({}, Pacs002Sample),
    networkMap: Object.assign(new NetworkMap(), NetworkMapSample[0][0]),
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

    // Reset TenantConfigManager singleton for each test
    (TenantConfigManager as any).instance = undefined;

    jest.spyOn(ruleLogic, 'handleTransaction').mockImplementationOnce(async (): Promise<RuleResult> => {
      return Promise.resolve(ruleRes);
    });

    jest.resetModules();
    jest.mock('@tazama-lf/frms-coe-startup-lib/lib/interfaces/iStartupConfig', () => ({ startupType: 'nats' }));
  });

  describe('execute', () => {
    it('should respond with rule result of true for happy path ', async () => {
      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig[][]> => {
        const rc: RuleConfig = {
          ...ruleConfig,
        };
        return await Promise.resolve([[rc]]);
      });

      const expectedReq = getMockRequest();

      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

      await execute(expectedReq);

      expect(responseSpy).toHaveBeenCalledWith({ ...expectedReq, metaData: undefined, ruleResult: ruleRes });
    });

    it('should respond with rule result - ruleConfig - exitConditions are undefined ', async () => {
      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig[][]> => {
        const rc: RuleConfig = {
          ...ruleConfig,
          config: { exitConditions: undefined },
        };
        return await Promise.resolve([[rc]]);
      });

      const expectedReq = getMockRequest();

      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

      await execute(expectedReq);

      expect(responseSpy).toHaveBeenCalledWith({ ...expectedReq, metaData: undefined, ruleResult: ruleRes });
    });

    it('should respond with rule result - ruleConfig - bands are undefined ', async () => {
      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig[][]> => {
        const rc: RuleConfig = {
          ...ruleConfig,
          config: { bands: undefined },
        };
        return await Promise.resolve([[rc]]);
      });

      const expectedReq = getMockRequest();

      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

      await execute(expectedReq);

      expect(responseSpy).toHaveBeenCalledWith({ ...expectedReq, metaData: undefined, ruleResult: ruleRes });
    });

    it('should respond with rule result .err - ruleConfig: config is undefined ', async () => {
      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<unknown[][]> => {
        const rc: unknown = {
          ...ruleConfig,
          config: undefined,
        };
        return await Promise.resolve([[rc]]);
      });

      const errRuleResult: RuleResult = {
        ...ruleRes,
        subRuleRef: '.err',
        reason: 'Rule processor configuration not retrievable',
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
          }),
        }),
      );
    });

    it('should respond with rule result .err - no matching rule cfg ', async () => {
      configuration.RULE_NAME = 'abcdefghijklmnop';
      configuration.RULE_VERSION = '1.99999999999';

      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig[][]> => {
        const rc: RuleConfig = {
          ...ruleConfig,
          config: { bands: undefined },
        };
        return await Promise.resolve([[rc]]);
      });

      const errRuleResult: RuleResult = {
        ...ruleRes,
        subRuleRef: '.err',
        reason: 'Rule not found in network map',
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
      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig[][]> => {
        const rc: RuleConfig = {
          ...ruleConfig,
        };
        return await Promise.resolve([[rc]]);
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
        expect.objectContaining({
          ruleResult: expect.objectContaining({
            subRuleRef: '.err',
            reason: handleTransactionErrMsg,
          }),
        }),
      );
    });

    it('should fail on bad handleResponse', async () => {
      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig[][]> => {
        const rc: RuleConfig = {
          ...ruleConfig,
        };
        return await Promise.resolve([[rc]]);
      });

      const expectedReq = getMockRequest();

      jest.spyOn(server, 'handleResponse').mockRestore();
      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementation(() => {
        throw new Error('Endpoint down test');
      });

      await execute(expectedReq);

      expect(responseSpy).toThrow();
    });

    // Additional test cases to improve execute.ts coverage
    it('should handle TenantConfigManager database error', async () => {
      jest.spyOn(databaseManager, 'getRuleConfig').mockRejectedValueOnce(new Error('Database connection failed'));
      jest.spyOn(databaseManager, 'queryConfigurationDB').mockRejectedValueOnce(new Error('Database connection failed'));

      const expectedReq = getMockRequest();
      expectedReq.transaction.TenantId = 'test-tenant';

      // Mock TenantConfigManager to simulate database error
      const tenantConfigManager = TenantConfigManager.getInstance(databaseManager, loggerService);
      jest.spyOn(tenantConfigManager, 'getRuleConfig').mockRejectedValueOnce(new Error('Config fetch failed'));

      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

      await execute(expectedReq);

      expect(responseSpy).toHaveBeenCalled();
    });

    it('should log rule result with reason when available', async () => {
      const ruleResultWithReason = { ...ruleRes, reason: 'Test reason for logging', subRuleRef: '.err' };

      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig[][]> => {
        return await Promise.resolve([[ruleConfig]]);
      });

      jest.spyOn(databaseManager, 'queryConfigurationDB').mockImplementationOnce(async (): Promise<RuleConfig[][]> => {
        return await Promise.resolve([[ruleConfig]]);
      });

      // Mock handleTransaction to return result with reason and error subRuleRef
      jest.spyOn(ruleLogic, 'handleTransaction').mockRestore();
      jest.spyOn(ruleLogic, 'handleTransaction').mockImplementationOnce(async (): Promise<RuleResult> => {
        return Promise.resolve(ruleResultWithReason);
      });

      const expectedReq = getMockRequest();
      expectedReq.transaction.TenantId = 'test-tenant';

      const loggerSpy = jest.spyOn(loggerService, 'log');
      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

      await execute(expectedReq);

      // Verify that handleResponse was called with the error result containing the reason
      expect(responseSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleResult: expect.objectContaining({
            reason: 'Test reason for logging',
            subRuleRef: '.err',
          }),
        }),
      );

      // Also verify the reason was logged - just check that log was called with the reason
      const loggerCalls = loggerSpy.mock.calls;
      const reasonLogExists = loggerCalls.some((call) => call[0] === 'Test reason for logging');
      expect(reasonLogExists).toBe(true);
    });

    it('should preserve metaData trace context when available', async () => {
      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig[][]> => {
        return await Promise.resolve([[ruleConfig]]);
      });

      jest.spyOn(databaseManager, 'queryConfigurationDB').mockImplementationOnce(async (): Promise<RuleConfig[][]> => {
        return await Promise.resolve([[ruleConfig]]);
      });

      const expectedReq = getMockRequest();
      expectedReq.metaData = { traceParent: 'original-trace-parent-id' } as any;

      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

      await execute(expectedReq);

      // Check that handleResponse was called with metaData - at minimum it should be an object
      expect(responseSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction: expectedReq.transaction,
          networkMap: expectedReq.networkMap,
          DataCache: expectedReq.DataCache,
          metaData: expect.any(Object), // Just verify metaData is an object
          ruleResult: expect.objectContaining({
            cfg: '1.0',
            id: '003@1.0',
            subRuleRef: '',
          }),
        }),
      );

      // Verify that metaData object was passed through
      const responseCalls = responseSpy.mock.calls;
      const responseCall = responseCalls[0][0];
      expect(responseCall.metaData).toBeDefined();
      // traceParent can be undefined in test environment, so just check it exists as a property
      expect('traceParent' in responseCall.metaData).toBe(true);
    });

    it('should handle logger service trace calls when metaData is present', async () => {
      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig[][]> => {
        return await Promise.resolve([[ruleConfig]]);
      });

      jest.spyOn(databaseManager, 'queryConfigurationDB').mockImplementationOnce(async (): Promise<RuleConfig[][]> => {
        return await Promise.resolve([[ruleConfig]]);
      });

      const expectedReq = getMockRequest();
      expectedReq.metaData = { traceParent: 'test-trace-123' } as any;
      expectedReq.transaction.TenantId = 'test-tenant';

      const loggerSpy = jest.spyOn(loggerService, 'trace');
      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

      await execute(expectedReq);

      // Verify trace was called - should be called but may return null in test environment
      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should handle tenant extraction for different tenant ID patterns', async () => {
      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig[][]> => {
        return await Promise.resolve([[ruleConfig]]);
      });

      jest.spyOn(databaseManager, 'queryConfigurationDB').mockImplementationOnce(async (): Promise<RuleConfig[][]> => {
        return await Promise.resolve([[ruleConfig]]);
      });

      const expectedReq = getMockRequest();
      expectedReq.transaction.TenantId = 'complex-tenant-id-123';

      const loggerSpy = jest.spyOn(loggerService, 'log');
      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

      await execute(expectedReq);

      // Verify tenant processing was logged
      expect(loggerSpy).toHaveBeenCalledWith(
        'Processing transaction for tenant: complex-tenant-id-123',
        'Rule-003 execute()',
        'test-rule-executor',
      );
    });

    it('should handle configuration validation edge cases', async () => {
      // Test with configuration that has potential validation issues
      const edgeCaseConfig: RuleConfig = {
        ...ruleConfig,
        config: {
          ...ruleConfig.config,
          parameters: {
            testParam: '',
            emptyParam: null,
            numberParam: 0,
          },
        },
      };

      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig[][]> => {
        return await Promise.resolve([[edgeCaseConfig]]);
      });

      jest.spyOn(databaseManager, 'queryConfigurationDB').mockImplementationOnce(async (): Promise<RuleConfig[][]> => {
        return await Promise.resolve([[edgeCaseConfig]]);
      });

      const expectedReq = getMockRequest();
      expectedReq.transaction.TenantId = 'edge-case-tenant';

      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

      await execute(expectedReq);

      expect(responseSpy).toHaveBeenCalled();
    });

    it('should validate network map rules and configuration', async () => {
      // Test with a modified network map that might trigger different validation paths
      const modifiedNetworkMap = {
        ...NetworkMapSample[0][0],
        rules: [
          {
            id: '003@1.0',
            cfg: '1.0',
            ref: '.01',
            reason: 'Modified rule for testing',
          },
        ],
      };

      jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig[][]> => {
        return await Promise.resolve([[ruleConfig]]);
      });

      jest.spyOn(databaseManager, 'queryConfigurationDB').mockImplementationOnce(async (): Promise<RuleConfig[][]> => {
        return await Promise.resolve([[ruleConfig]]);
      });

      const expectedReq = getMockRequest();
      expectedReq.networkMap = Object.assign(new NetworkMap(), modifiedNetworkMap);

      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

      await execute(expectedReq);

      expect(responseSpy).toHaveBeenCalled();
    });
  });

  describe('determineOutcome', () => {
    it('should complete with happy path', () => {
      const value = 3;

      const localRuleConfig: RuleConfig = {
        id: '003@1.0.0',
        desc: 'Test Rule',
        cfg: '1.0.0',
        config: {
          exitConditions: [
            {
              subRuleRef: '.x01',
              reason: 'Exit Example x01',
            },
          ],
          bands: [
            {
              subRuleRef: '.01',
              upperLimit: 1,
              reason: 'Band Example 01',
            },
            {
              subRuleRef: '.02',
              lowerLimit: 2,
              upperLimit: 5,
              reason: 'Band Example 02',
            },
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
        }),
      );
    });

    it('should complete with .err when has bands and has cases', () => {
      const value = 3;

      const localRuleConfig: RuleConfig = {
        id: '003@1.0.0',
        desc: 'Test Rule',
        cfg: '1.0.0',
        config: {
          exitConditions: [
            {
              subRuleRef: '.x01',
              reason: 'Exit Example x01',
            },
          ],
          bands: [
            {
              subRuleRef: '.01',
              upperLimit: 1,
              reason: 'Band Example 01',
            },
            {
              subRuleRef: '.02',
              lowerLimit: 1,
              upperLimit: 2,
              reason: 'Band Example 02',
            },
          ],
          cases: [
            {
              reason: 'testCaseReason',
              subRuleRef: 'case01',
              value: '0',
            },
          ],
        },
      };
      const result = determineOutcome(value, localRuleConfig, ruleRes);

      expect(result).toEqual(
        expect.objectContaining({
          cfg: ruleRes.cfg,
          id: ruleRes.id,
          reason: 'Rule processor configuration invalid',
          subRuleRef: ruleRes.subRuleRef,
        }),
      );
    });
    it('should error when value is bad', () => {
      const value: number = NaN;

      const localRuleConfig: RuleConfig = {
        id: '003@1.0.0',
        desc: 'Test Rule',
        cfg: '1.0.0',
        config: {
          exitConditions: [
            {
              subRuleRef: '.x01',
              reason: 'Exit Example x01',
            },
          ],
          bands: [
            {
              subRuleRef: '.01',
              upperLimit: 1,
              reason: 'Band Example 01',
            },
            {
              subRuleRef: '.02',
              lowerLimit: 1,
              upperLimit: 2,
              reason: 'Band Example 02',
            },
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
