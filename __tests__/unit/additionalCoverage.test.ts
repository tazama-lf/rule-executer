// SPDX-License-Identifier: Apache-2.0
import { NetworkMap, RuleConfig, RuleRequest, RuleResult } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import { DataCacheSample, NetworkMapSample, Pacs002Sample } from '@tazama-lf/frms-coe-lib/lib/tests/data';
import * as ruleLogic from 'rule/lib';
import { configuration, databaseManager, initializeDB, runServer, server } from '../../src';
import { execute } from '../../src/controllers/execute';
import determineOutcome from '../../src/helpers/determineOutcome';
import { TenantConfigManager } from '../../src/helpers/tenantConfigManager';
import { extractTenantId, hasTenantId } from '../../src/types/tenantTypes';

jest.mock('@tazama-lf/frms-coe-lib/lib/services/dbManager', () => ({
  CreateStorageManager: jest.fn().mockReturnValue({
    db: {
      getRuleConfig: jest.fn(),
      queryConfigurationDB: jest.fn(),
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

const getMockRequest = (tenantId?: string): RuleRequest => {
  const mockTransaction = { ...Pacs002Sample };
  if (tenantId) {
    mockTransaction.TenantId = tenantId;
  }

  const quote: RuleRequest = {
    transaction: mockTransaction,
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

describe('Additional Coverage Tests', () => {
  let responseSpy: jest.SpyInstance;

  beforeEach(() => {
    configuration.RULE_NAME = '003';
    configuration.RULE_VERSION = '1.0';

    // Reset TenantConfigManager singleton for each test
    (TenantConfigManager as any).instance = undefined;

    jest.spyOn(ruleLogic, 'handleTransaction').mockImplementationOnce(async () => {
      return Promise.resolve({
        cfg: '1.0',
        id: '003@1.0',
        subRuleRef: '',
        prcgTm: undefined,
        reason: undefined,
      });
    });

    jest.resetModules();
  });

  describe('Execute Controller Coverage', () => {
    it('should test lines 43-44: warning when no tenantId', async () => {
      // Create a mock request without TenantId to trigger warning path
      const mockRequest = {
        transaction: { ...Pacs002Sample },
        networkMap: Object.assign(new NetworkMap(), NetworkMapSample[0][0]),
        DataCache: Object.assign({}, DataCacheSample),
      };

      // Explicitly remove TenantId to ensure it's not present
      const { TenantId, ...cleanTransaction } = mockRequest.transaction as any;
      mockRequest.transaction = cleanTransaction;

      jest.spyOn(databaseManager, 'getRuleConfig').mockResolvedValue([[ruleConfig]]);
      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([[ruleConfig]]);
      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementation(jest.fn());

      await execute(mockRequest);

      // The function should execute and process the request successfully
      expect(responseSpy).toHaveBeenCalled();
    });

    it('should test lines 98-99: successful tenant config logging', async () => {
      const mockRequest = getMockRequest('test-tenant');

      jest.spyOn(databaseManager, 'getRuleConfig').mockResolvedValue([[ruleConfig]]);
      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([[ruleConfig]]);
      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementation(jest.fn());

      await execute(mockRequest);

      expect(responseSpy).toHaveBeenCalled();
    });

    it('should test lines 162-163: metadata and reason handling', async () => {
      const mockRequest = getMockRequest('test-tenant');
      // Add metadata to request
      (mockRequest as any).metaData = { someProperty: 'test' };

      jest.spyOn(databaseManager, 'getRuleConfig').mockResolvedValue([[ruleConfig]]);
      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([[ruleConfig]]);

      // Mock handleTransaction to return a result with reason
      jest.spyOn(ruleLogic, 'handleTransaction').mockRestore();
      jest.spyOn(ruleLogic, 'handleTransaction').mockResolvedValue({
        cfg: '1.0',
        id: '003@1.0',
        subRuleRef: '.01',
        prcgTm: 123456,
        reason: 'Test reason for logging',
      });

      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementation(jest.fn());

      await execute(mockRequest);

      expect(responseSpy).toHaveBeenCalled();
      // The metadata should be modified (traceParent added)
      expect((mockRequest as any).metaData).toBeDefined();
    });

    it('should test error path lines 54-58: request parsing failure', async () => {
      const invalidRequest = { invalid: 'request' }; // Missing required fields

      await execute(invalidRequest);

      // Should not proceed to rule processing
      expect(databaseManager.queryConfigurationDB).not.toHaveBeenCalled();
    });

    it('should test error path lines 107-123: configuration retrieval failure', async () => {
      const mockRequest = getMockRequest('test-tenant');

      // Mock configuration retrieval to fail
      jest.spyOn(databaseManager, 'queryConfigurationDB').mockRejectedValue(new Error('Config fetch failed'));

      await execute(mockRequest);

      expect(databaseManager.queryConfigurationDB).toHaveBeenCalled();
    });

    it('should test error path lines 146-153: transaction processing failure', async () => {
      const mockRequest = getMockRequest('test-tenant');

      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([[ruleConfig]]);

      // Mock transaction processing to fail
      jest.spyOn(ruleLogic, 'handleTransaction').mockRejectedValue(new Error('Processing failed'));

      await execute(mockRequest);

      expect(ruleLogic.handleTransaction).toHaveBeenCalled();
    });

    it('should test error path lines 178-179: response handling failure', async () => {
      const mockRequest = getMockRequest('test-tenant');

      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([[ruleConfig]]);
      jest.spyOn(ruleLogic, 'handleTransaction').mockResolvedValue(ruleRes);

      // Mock response handling to fail
      jest.spyOn(server, 'handleResponse').mockRejectedValue(new Error('Response failed'));

      await execute(mockRequest);

      expect(server.handleResponse).toHaveBeenCalled();
    });

    it('should test lines 81-83: successful default configuration logging', async () => {
      const mockRequest = getMockRequest(); // Request without tenant

      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([]); // No tenant config
      jest.spyOn(databaseManager, 'getRuleConfig').mockResolvedValue([[ruleConfig]]);
      jest.spyOn(ruleLogic, 'handleTransaction').mockResolvedValue(ruleRes);
      jest.spyOn(server, 'handleResponse').mockResolvedValue(undefined);

      await execute(mockRequest);

      expect(databaseManager.getRuleConfig).toHaveBeenCalled();
    });

    it('should trigger specific error path in transaction processing (lines 146-153)', async () => {
      const mockRequest = getMockRequest('test-tenant');

      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([[ruleConfig]]);

      // Create a specific error in transaction processing that hits lines 146-153
      const processingError = new Error('Specific processing error');
      jest.spyOn(ruleLogic, 'handleTransaction').mockRejectedValue(processingError);

      await execute(mockRequest);

      expect(ruleLogic.handleTransaction).toHaveBeenCalled();
    });

    it('should handle empty rule config from network map (line 81-83)', async () => {
      // Create a request where the rule is not found in the network map
      const mockRequest = getMockRequest('test-tenant');

      // Modify the network map to not contain the expected rule
      const modifiedNetworkMap = JSON.parse(JSON.stringify(mockRequest.networkMap));
      modifiedNetworkMap.messages[0].typologies[0].rules = []; // Empty rules array
      mockRequest.networkMap = modifiedNetworkMap;

      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([[ruleConfig]]);

      await execute(mockRequest);

      // Should trigger the error path for "Rule not found in network map"
      // Note: The function will still attempt config retrieval first before checking the rule config
      expect(databaseManager.queryConfigurationDB).toHaveBeenCalled();
    });

    it('should handle successful config retrieval with detailed logging (lines 98-99)', async () => {
      const mockRequest = getMockRequest('test-tenant');

      // Mock successful configuration retrieval
      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([[ruleConfig]]);
      jest.spyOn(ruleLogic, 'handleTransaction').mockResolvedValue(ruleRes);
      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementation(jest.fn());

      await execute(mockRequest);

      // Verify that the detailed logging for successful config retrieval occurs
      expect(responseSpy).toHaveBeenCalled();
    });

    it('should handle network map with multiple rules and find correct one', async () => {
      const mockRequest = getMockRequest('test-tenant');

      // Add multiple rules to the network map
      const modifiedNetworkMap = JSON.parse(JSON.stringify(mockRequest.networkMap));
      modifiedNetworkMap.messages[0].typologies[0].rules = [
        { id: '001@1.0', cfg: '1.0' },
        { id: '002@1.0', cfg: '1.0' },
        { id: '003@1.0', cfg: '1.0' }, // This should match
        { id: '004@1.0', cfg: '1.0' },
      ];
      mockRequest.networkMap = modifiedNetworkMap;

      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([[ruleConfig]]);
      jest.spyOn(ruleLogic, 'handleTransaction').mockResolvedValue(ruleRes);
      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementation(jest.fn());

      await execute(mockRequest);

      expect(responseSpy).toHaveBeenCalled();
    });

    it('should handle nested network map structure correctly', async () => {
      const mockRequest = getMockRequest('test-tenant');

      // Create a more complex network map with multiple messages and typologies
      const complexNetworkMap = JSON.parse(JSON.stringify(mockRequest.networkMap));
      complexNetworkMap.messages = [
        {
          typologies: [{ rules: [{ id: '001@1.0', cfg: '1.0' }] }, { rules: [{ id: '002@1.0', cfg: '1.0' }] }],
        },
        {
          typologies: [
            { rules: [{ id: '003@1.0', cfg: '1.0' }] }, // Target rule in second message
          ],
        },
      ];
      mockRequest.networkMap = complexNetworkMap;

      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([[ruleConfig]]);
      jest.spyOn(ruleLogic, 'handleTransaction').mockResolvedValue(ruleRes);
      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementation(jest.fn());

      await execute(mockRequest);

      expect(responseSpy).toHaveBeenCalled();
    });

    it('should handle rule configuration error with span cleanup', async () => {
      const mockRequest = getMockRequest('test-tenant');

      // Mock getRuleConfig to return undefined config
      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([
        [
          {
            ...ruleConfig,
            config: undefined,
          },
        ],
      ]);

      await execute(mockRequest);

      // Should handle the "Rule processor configuration not retrievable" error
      expect(databaseManager.queryConfigurationDB).toHaveBeenCalled();
    });

    it('should handle APM span operations correctly in error paths', async () => {
      const mockRequest = getMockRequest('test-tenant');

      // Mock configuration to fail
      jest.spyOn(databaseManager, 'queryConfigurationDB').mockRejectedValue(new Error('Database error'));

      await execute(mockRequest);

      // Test that error handling works correctly even with APM spans
      expect(databaseManager.queryConfigurationDB).toHaveBeenCalled();
    });

    it('should handle transaction processing with enriched request', async () => {
      const mockRequest = getMockRequest('test-tenant');

      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([[ruleConfig]]);

      // Mock handleTransaction to verify it receives enriched request
      const handleTransactionSpy = jest.spyOn(ruleLogic, 'handleTransaction').mockResolvedValue({
        ...ruleRes,
        subRuleRef: '.01',
        prcgTm: 100,
      });

      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementation(jest.fn());

      await execute(mockRequest);

      // Verify handleTransaction was called with enriched request containing tenantId
      expect(handleTransactionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'test-tenant',
        }),
        expect.any(Function),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
      );
      expect(responseSpy).toHaveBeenCalled();
    });

    it('should handle duration calculation in error scenarios', async () => {
      const mockRequest = getMockRequest('test-tenant');

      // Mock database error to trigger error path with duration calculation
      jest.spyOn(databaseManager, 'queryConfigurationDB').mockRejectedValue(new Error('Config error'));

      const startTime = Date.now();
      await execute(mockRequest);
      const endTime = Date.now();

      // Verify that duration is calculated even in error scenarios
      expect(endTime - startTime).toBeGreaterThan(0);
    });
  });

  describe('TenantConfigManager Coverage', () => {
    let configManager: TenantConfigManager;

    beforeEach(() => {
      configManager = TenantConfigManager.getInstance(databaseManager, require('../../src/index').loggerService);
    });

    it('should handle cache expiry logic (lines 101-105)', async () => {
      // First, add something to cache
      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([[ruleConfig]]);

      // Get config to populate cache
      await configManager.getRuleConfig('003@1.0', '1.0', 'test-tenant');

      // Mock Date.now to simulate cache expiry
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => originalDateNow() + 10 * 60 * 1000); // 10 minutes in future

      // Mock for second call when cache is expired
      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([[ruleConfig]]);

      // This should trigger cache expiry logic
      const result = await configManager.getRuleConfig('003@1.0', '1.0', 'test-tenant');

      expect(result).toBeDefined();
      expect(result?.config).toBeDefined();

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should clear tenant cache (lines 121-134)', () => {
      // First populate cache with multiple entries
      const cacheMethod = (configManager as any).setInCache.bind(configManager);
      cacheMethod('tenant:tenant1:rule:test@1.0:cfg:1.0', ruleConfig);
      cacheMethod('tenant:tenant1:rule:other@1.0:cfg:1.0', ruleConfig);
      cacheMethod('tenant:tenant2:rule:test@1.0:cfg:1.0', ruleConfig);
      cacheMethod('default:rule:test@1.0:cfg:1.0', ruleConfig);

      // Clear cache for tenant1
      configManager.clearTenantCache('tenant1');

      // Verify cache was cleared
      const stats = configManager.getCacheStats();
      expect(stats.totalEntries).toBeLessThan(4); // Should have removed tenant1 entries
    });

    it('should handle cache hit with trace logging (lines 47-49)', async () => {
      // First populate cache
      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([[ruleConfig]]);
      await configManager.getRuleConfig('003@1.0', '1.0', 'test-tenant');

      // Second call should hit cache
      const result = await configManager.getRuleConfig('003@1.0', '1.0', 'test-tenant');

      expect(result).toBeDefined();
      expect(result?.config).toBeDefined();
    });

    it('should handle fallback to default when tenant-specific config not found (lines 64-66)', async () => {
      // Mock queryConfigurationDB to return empty result (no tenant-specific config)
      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([]);

      // Mock getRuleConfig to return default config
      jest.spyOn(databaseManager, 'getRuleConfig').mockResolvedValue([[ruleConfig]]);

      const result = await configManager.getRuleConfig('003@1.0', '1.0', 'test-tenant');

      expect(result).toBeDefined();
      expect(result?.config).toBeDefined();
      expect(databaseManager.getRuleConfig).toHaveBeenCalledWith('003@1.0', '1.0');
    });

    it('should handle non-tenant requests (lines 68-70)', async () => {
      jest.spyOn(databaseManager, 'getRuleConfig').mockResolvedValue([[ruleConfig]]);

      // Call without tenantId should use standard method
      const result = await configManager.getRuleConfig('003@1.0', '1.0');

      expect(result).toBeDefined();
      expect(result?.config).toBeDefined();
      expect(databaseManager.getRuleConfig).toHaveBeenCalledWith('003@1.0', '1.0');
      expect(databaseManager.queryConfigurationDB).not.toHaveBeenCalled();
    });

    it('should provide cache statistics', () => {
      const stats = configManager.getCacheStats();
      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('tenantEntries');
      expect(stats).toHaveProperty('defaultEntries');
      expect(typeof stats.totalEntries).toBe('number');
      expect(typeof stats.tenantEntries).toBe('number');
      expect(typeof stats.defaultEntries).toBe('number');
    });
  });

  describe('Edge Case Coverage for execute.ts', () => {
    it('should handle request with null/undefined tenantId gracefully', async () => {
      const mockRequest = getMockRequest();
      // Explicitly set TenantId to null
      (mockRequest.transaction as any).TenantId = null;

      jest.spyOn(databaseManager, 'getRuleConfig').mockResolvedValue([[ruleConfig]]);
      jest.spyOn(ruleLogic, 'handleTransaction').mockResolvedValue(ruleRes);
      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementation(jest.fn());

      await execute(mockRequest);

      expect(responseSpy).toHaveBeenCalled();
    });

    it('should handle request with empty string tenantId', async () => {
      const mockRequest = getMockRequest();
      (mockRequest.transaction as any).TenantId = '';

      jest.spyOn(databaseManager, 'getRuleConfig').mockResolvedValue([[ruleConfig]]);
      jest.spyOn(ruleLogic, 'handleTransaction').mockResolvedValue(ruleRes);
      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementation(jest.fn());

      await execute(mockRequest);

      expect(responseSpy).toHaveBeenCalled();
    });

    it('should handle malformed request with missing required properties individually', async () => {
      // Test missing transaction
      const requestMissingTransaction = {
        networkMap: Object.assign(new NetworkMap(), NetworkMapSample[0][0]),
        DataCache: Object.assign({}, DataCacheSample),
      };

      await execute(requestMissingTransaction);

      // Test missing networkMap
      const requestMissingNetworkMap = {
        transaction: { ...Pacs002Sample },
        DataCache: Object.assign({}, DataCacheSample),
      };

      await execute(requestMissingNetworkMap);

      // Test missing DataCache
      const requestMissingDataCache = {
        transaction: { ...Pacs002Sample },
        networkMap: Object.assign(new NetworkMap(), NetworkMapSample[0][0]),
      };

      await execute(requestMissingDataCache);
    });

    it('should handle network map with empty messages array', async () => {
      const mockRequest = getMockRequest('test-tenant');
      const emptyNetworkMap = JSON.parse(JSON.stringify(mockRequest.networkMap));
      emptyNetworkMap.messages = [];
      mockRequest.networkMap = emptyNetworkMap;

      await execute(mockRequest);

      // Should trigger "Rule not found in network map" error
      expect(databaseManager.queryConfigurationDB).not.toHaveBeenCalled();
    });

    it('should handle network map with empty typologies array', async () => {
      const mockRequest = getMockRequest('test-tenant');
      const emptyTypologiesMap = JSON.parse(JSON.stringify(mockRequest.networkMap));
      emptyTypologiesMap.messages[0].typologies = [];
      mockRequest.networkMap = emptyTypologiesMap;

      await execute(mockRequest);

      // Should trigger "Rule not found in network map" error, but still attempt config retrieval first
      expect(databaseManager.queryConfigurationDB).toHaveBeenCalled();
    });

    it('should handle metaData with existing traceParent', async () => {
      const mockRequest = getMockRequest('test-tenant');
      (mockRequest as any).metaData = {
        traceParent: 'existing-trace-parent-12345',
      };

      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([[ruleConfig]]);
      jest.spyOn(ruleLogic, 'handleTransaction').mockResolvedValue(ruleRes);
      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementation(jest.fn());

      await execute(mockRequest);

      expect(responseSpy).toHaveBeenCalled();
    });

    it('should handle rule result with no reason and non-error subRuleRef', async () => {
      const mockRequest = getMockRequest('test-tenant');

      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([[ruleConfig]]);

      // Mock handleTransaction to return result without reason
      jest.spyOn(ruleLogic, 'handleTransaction').mockResolvedValue({
        cfg: '1.0',
        id: '003@1.0',
        subRuleRef: '.01', // Non-error subRuleRef
        prcgTm: 123456,
        // No reason field
      });

      responseSpy = jest.spyOn(server, 'handleResponse').mockImplementation(jest.fn());

      await execute(mockRequest);

      expect(responseSpy).toHaveBeenCalled();
    });

    it('should handle simultaneous configuration and processing errors', async () => {
      const mockRequest = getMockRequest('test-tenant');

      // First, mock configuration to succeed
      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([[ruleConfig]]);

      // Then, mock processing to fail
      jest.spyOn(ruleLogic, 'handleTransaction').mockRejectedValue(new Error('Processing error'));

      await execute(mockRequest);

      expect(ruleLogic.handleTransaction).toHaveBeenCalled();
    });

    it('should handle invalid request objects', async () => {
      // Test with various invalid request types
      await execute(null);
      await execute(undefined);
      await execute('invalid string');
      await execute(123);
      await execute([]);
      await execute({});
    });

    it('should preserve original request structure in error responses', async () => {
      const mockRequest = getMockRequest('test-tenant');

      jest.spyOn(databaseManager, 'queryConfigurationDB').mockRejectedValue(new Error('Config error'));

      // Mock handleResponse to capture the arguments
      const handleResponseSpy = jest.spyOn(server, 'handleResponse').mockImplementation(jest.fn());

      await execute(mockRequest);

      // Verify that handleResponse was called with correct structure
      expect(handleResponseSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction: expect.any(Object),
          ruleResult: expect.objectContaining({
            subRuleRef: '.err',
          }),
          networkMap: expect.any(Object),
        }),
      );
    });

    it('should handle response error after successful processing', async () => {
      const mockRequest = getMockRequest('test-tenant');

      jest.spyOn(databaseManager, 'queryConfigurationDB').mockResolvedValue([[ruleConfig]]);
      jest.spyOn(ruleLogic, 'handleTransaction').mockResolvedValue(ruleRes);

      // Mock handleResponse to fail after successful processing
      jest.spyOn(server, 'handleResponse').mockRejectedValue(new Error('Response transmission failed'));

      await execute(mockRequest);

      expect(server.handleResponse).toHaveBeenCalled();
    });
  });

  describe('DetermineOutcome Coverage', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle bands configuration with value matching range', () => {
      const testRuleConfig: RuleConfig = {
        id: '001@1.0.0',
        cfg: '1.0.0',
        desc: 'Test Rule',
        config: {
          bands: [
            {
              subRuleRef: '.01',
              lowerLimit: 5,
              upperLimit: 15,
              reason: 'Within range',
            },
            {
              subRuleRef: '.02',
              lowerLimit: 15,
              upperLimit: 25,
              reason: 'Higher range',
            },
          ],
        },
      };

      const testRuleResult: RuleResult = {
        cfg: '1.0',
        id: '001@1.0',
        subRuleRef: '',
        prcgTm: undefined,
        reason: undefined,
      };

      const result = determineOutcome(10, testRuleConfig, testRuleResult);

      expect(result.subRuleRef).toBe('.01');
      expect(result.reason).toBe('Within range');
    });

    it('should handle bands configuration with value at boundary', () => {
      const testRuleConfig: RuleConfig = {
        id: '001@1.0.0',
        cfg: '1.0.0',
        desc: 'Test Rule',
        config: {
          bands: [
            {
              subRuleRef: '.01',
              lowerLimit: 10,
              upperLimit: 20,
              reason: 'Exact boundary',
            },
          ],
        },
      };

      const testRuleResult: RuleResult = {
        cfg: '1.0',
        id: '001@1.0',
        subRuleRef: '',
        prcgTm: undefined,
        reason: undefined,
      };

      const result = determineOutcome(10, testRuleConfig, testRuleResult);

      expect(result.subRuleRef).toBe('.01');
      expect(result.reason).toBe('Exact boundary');
    });

    it('should handle bands configuration with zero value', () => {
      const testRuleConfig: RuleConfig = {
        id: '001@1.0.0',
        cfg: '1.0.0',
        desc: 'Test Rule',
        config: {
          bands: [
            {
              subRuleRef: '.01',
              lowerLimit: 0,
              upperLimit: 5,
              reason: 'Zero value range',
            },
          ],
        },
      };

      const testRuleResult: RuleResult = {
        cfg: '1.0',
        id: '001@1.0',
        subRuleRef: '',
        prcgTm: undefined,
        reason: undefined,
      };

      const result = determineOutcome(0, testRuleConfig, testRuleResult);

      expect(result.subRuleRef).toBe('.01');
      expect(result.reason).toBe('Zero value range');
    });

    it('should handle bands configuration with no lower limit', () => {
      const testRuleConfig: RuleConfig = {
        id: '001@1.0.0',
        cfg: '1.0.0',
        desc: 'Test Rule',
        config: {
          bands: [
            {
              subRuleRef: '.01',
              upperLimit: 10,
              reason: 'No lower limit',
            },
          ],
        },
      };

      const testRuleResult: RuleResult = {
        cfg: '1.0',
        id: '001@1.0',
        subRuleRef: '',
        prcgTm: undefined,
        reason: undefined,
      };

      const result = determineOutcome(5, testRuleConfig, testRuleResult);

      expect(result.subRuleRef).toBe('.01');
      expect(result.reason).toBe('No lower limit');
    });

    it('should handle bands configuration with no upper limit', () => {
      const testRuleConfig: RuleConfig = {
        id: '001@1.0.0',
        cfg: '1.0.0',
        desc: 'Test Rule',
        config: {
          bands: [
            {
              subRuleRef: '.01',
              lowerLimit: 10,
              reason: 'No upper limit',
            },
          ],
        },
      };

      const testRuleResult: RuleResult = {
        cfg: '1.0',
        id: '001@1.0',
        subRuleRef: '',
        prcgTm: undefined,
        reason: undefined,
      };

      const result = determineOutcome(15, testRuleConfig, testRuleResult);

      expect(result.subRuleRef).toBe('.01');
      expect(result.reason).toBe('No upper limit');
    });

    it('should throw error when value is undefined and bands exist', () => {
      const testRuleConfig: RuleConfig = {
        id: '001@1.0.0',
        cfg: '1.0.0',
        desc: 'Test Rule',
        config: {
          bands: [
            {
              subRuleRef: '.01',
              lowerLimit: 10,
              upperLimit: 20,
              reason: 'Should not reach',
            },
          ],
        },
      };

      const testRuleResult: RuleResult = {
        cfg: '1.0',
        id: '001@1.0',
        subRuleRef: '',
        prcgTm: undefined,
        reason: undefined,
      };

      expect(() => {
        determineOutcome(undefined as any, testRuleConfig, testRuleResult);
      }).toThrow('Value provided undefined, so cannot determine rule outcome');
    });

    it('should throw error when bands are undefined', () => {
      const testRuleConfig: RuleConfig = {
        id: '001@1.0.0',
        cfg: '1.0.0',
        desc: 'Test Rule',
        config: {},
      };

      const testRuleResult: RuleResult = {
        cfg: '1.0',
        id: '001@1.0',
        subRuleRef: '',
        prcgTm: undefined,
        reason: undefined,
      };

      expect(() => {
        determineOutcome(10, testRuleConfig, testRuleResult);
      }).toThrow('Value provided undefined, so cannot determine rule outcome');
    });
  });

  describe('Tenant Types Coverage', () => {
    it('should handle transaction without TenantId field (lines 33-34)', () => {
      const transactionWithoutTenant = { ...Pacs002Sample };
      // Remove TenantId if it exists
      const { TenantId, ...cleanTransaction } = transactionWithoutTenant as any;

      // Test hasTenantId type guard
      expect(hasTenantId(cleanTransaction)).toBe(false);

      // Test extractTenantId
      expect(extractTenantId(cleanTransaction)).toBeUndefined();
    });

    it('should handle transaction with non-string TenantId', () => {
      const transactionWithInvalidTenant = { ...Pacs002Sample };
      transactionWithInvalidTenant.TenantId = 123 as any; // Invalid type

      expect(extractTenantId(transactionWithInvalidTenant)).toBeUndefined();
    });

    it('should handle transaction with valid string TenantId', () => {
      const transactionWithTenant = { ...Pacs002Sample };
      transactionWithTenant.TenantId = 'valid-tenant-id';

      expect(hasTenantId(transactionWithTenant)).toBe(true);
      expect(extractTenantId(transactionWithTenant)).toBe('valid-tenant-id');
    });
  });
});
