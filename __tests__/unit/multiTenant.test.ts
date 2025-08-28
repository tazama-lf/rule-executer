// SPDX-License-Identifier: Apache-2.0
import { TenantConfigManager } from '../../src/helpers/tenantConfigManager';
import { extractTenantId, hasTenantId } from '../../src/types/tenantTypes';
import type { RuleConfig } from '@tazama-lf/frms-coe-lib/lib/interfaces';

// Mock database manager
const mockDatabaseManager = {
  getRuleConfig: jest.fn(),
  queryConfigurationDB: jest.fn(),
} as any;

// Mock logger service
const mockLoggerService = {
  log: jest.fn(),
  trace: jest.fn(),
  error: jest.fn(),
} as any;

describe('Multi-Tenant Functionality', () => {
  let configManager: TenantConfigManager;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create a fresh instance for each test by clearing the singleton
    (TenantConfigManager as any).instance = undefined;
    configManager = TenantConfigManager.getInstance(mockDatabaseManager, mockLoggerService);
  });

  describe('TenantConfigManager', () => {
    it('should retrieve tenant-specific configuration when available', async () => {
      const tenantConfig: RuleConfig = {
        id: 'tenant1-901@1.0.0',
        cfg: '1.0.0',
        desc: 'Tenant-specific rule config',
        config: {
          bands: [{ subRuleRef: '.01', lowerLimit: 5, upperLimit: 25, reason: 'Tenant threshold' }],
        },
      };

      mockDatabaseManager.queryConfigurationDB.mockResolvedValueOnce([[tenantConfig]]);

      const result = await configManager.getRuleConfig('901@1.0.0', '1.0.0', 'tenant1');

      expect(mockDatabaseManager.queryConfigurationDB).toHaveBeenCalledWith(
        'ruleConfiguration',
        'doc.id == "tenant1-901@1.0.0" AND doc.cfg == "1.0.0" AND doc.tenantId == "tenant1"',
        1,
      );
      expect(result).toEqual(tenantConfig);
    });

    it('should fall back to default configuration when tenant-specific not found', async () => {
      const defaultConfig: RuleConfig = {
        id: '901@1.0.0',
        cfg: '1.0.0',
        desc: 'Default rule config',
        config: {
          bands: [{ subRuleRef: '.01', lowerLimit: 10, upperLimit: 50, reason: 'Default threshold' }],
        },
      };

      // Mock tenant-specific query returning empty result
      mockDatabaseManager.queryConfigurationDB.mockResolvedValueOnce([]);
      // Mock default config query
      mockDatabaseManager.getRuleConfig.mockResolvedValueOnce([[defaultConfig]]);

      const result = await configManager.getRuleConfig('901@1.0.0', '1.0.0', 'tenant1');

      expect(mockDatabaseManager.queryConfigurationDB).toHaveBeenCalled();
      expect(mockDatabaseManager.getRuleConfig).toHaveBeenCalledWith('901@1.0.0', '1.0.0');
      expect(result).toEqual(defaultConfig);
    });

    it('should use default method when no tenantId provided', async () => {
      const defaultConfig: RuleConfig = {
        id: '901@1.0.0',
        cfg: '1.0.0',
        desc: 'Default rule config',
        config: {
          bands: [{ subRuleRef: '.01', lowerLimit: 10, upperLimit: 50, reason: 'Default threshold' }],
        },
      };

      mockDatabaseManager.getRuleConfig.mockResolvedValueOnce([[defaultConfig]]);

      const result = await configManager.getRuleConfig('901@1.0.0', '1.0.0');

      expect(mockDatabaseManager.getRuleConfig).toHaveBeenCalledWith('901@1.0.0', '1.0.0');
      expect(mockDatabaseManager.queryConfigurationDB).not.toHaveBeenCalled();
      expect(result).toEqual(defaultConfig);
    });

    it('should cache configurations with tenant-specific keys', async () => {
      const tenantConfig: RuleConfig = {
        id: 'tenant1-901@1.0.0',
        cfg: '1.0.0',
        desc: 'Tenant-specific rule config',
        config: {
          bands: [{ subRuleRef: '.01', lowerLimit: 5, upperLimit: 25, reason: 'Tenant threshold' }],
        },
      };

      mockDatabaseManager.queryConfigurationDB.mockResolvedValue([[tenantConfig]]);

      // First call - should hit database
      await configManager.getRuleConfig('901@1.0.0', '1.0.0', 'tenant1');

      // Second call - should hit cache
      const result = await configManager.getRuleConfig('901@1.0.0', '1.0.0', 'tenant1');

      expect(mockDatabaseManager.queryConfigurationDB).toHaveBeenCalledTimes(1);
      expect(result).toEqual(tenantConfig);
    });

    it('should provide correct cache statistics', async () => {
      // Mock responses for different calls
      mockDatabaseManager.queryConfigurationDB.mockResolvedValue([
        [
          {
            id: 'tenant1-901@1.0.0',
            cfg: '1.0.0',
            config: { bands: [] },
          },
        ],
      ]);
      mockDatabaseManager.getRuleConfig.mockResolvedValue([
        [
          {
            id: '902@1.0.0',
            cfg: '1.0.0',
            config: { bands: [] },
          },
        ],
      ]);

      await configManager.getRuleConfig('901@1.0.0', '1.0.0', 'tenant1');
      await configManager.getRuleConfig('902@1.0.0', '1.0.0');

      const stats = configManager.getCacheStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.tenantEntries).toBe(1);
      expect(stats.defaultEntries).toBe(1);
    });
  });

  describe('Tenant Utilities', () => {
    it('should extract tenantId from transaction with TenantId field', () => {
      const transaction = {
        TxTp: 'pacs.002.001.12',
        TenantId: 'tenant-123',
        FIToFIPmtSts: {},
      };

      const tenantId = extractTenantId(transaction);
      expect(tenantId).toBe('tenant-123');
    });

    it('should return undefined for transaction without TenantId', () => {
      const transaction = {
        TxTp: 'pacs.002.001.12',
        FIToFIPmtSts: {},
      };

      const tenantId = extractTenantId(transaction);
      expect(tenantId).toBeUndefined();
    });

    it('should return undefined for empty string TenantId', () => {
      const transaction = {
        TxTp: 'pacs.002.001.12',
        TenantId: '',
        FIToFIPmtSts: {},
      };

      const tenantId = extractTenantId(transaction);
      expect(tenantId).toBeUndefined();
    });

    it('should return undefined for whitespace-only TenantId', () => {
      const transaction = {
        TxTp: 'pacs.002.001.12',
        TenantId: '   ',
        FIToFIPmtSts: {},
      };

      const tenantId = extractTenantId(transaction);
      expect(tenantId).toBeUndefined();
    });

    it('should trim and return valid TenantId with whitespace', () => {
      const transaction = {
        TxTp: 'pacs.002.001.12',
        TenantId: '  tenant-123  ',
        FIToFIPmtSts: {},
      };

      const tenantId = extractTenantId(transaction);
      expect(tenantId).toBe('tenant-123');
    });

    it('should cache default config with default key when tenant config not found (cache consistency fix)', async () => {
      const defaultConfig: RuleConfig = {
        id: '901@1.0.0',
        cfg: '1.0.0',
        desc: 'Default rule config',
        config: {
          bands: [{ subRuleRef: '.01', lowerLimit: 10, upperLimit: 50, reason: 'Default threshold' }],
        },
      };

      // First request: tenant-specific not found, should fallback to default
      mockDatabaseManager.queryConfigurationDB.mockResolvedValueOnce([]); // No tenant config
      mockDatabaseManager.getRuleConfig.mockResolvedValueOnce([[defaultConfig]]); // Default config

      const result1 = await configManager.getRuleConfig('901@1.0.0', '1.0.0', 'tenant1');

      expect(result1).toEqual(defaultConfig);
      expect(mockDatabaseManager.queryConfigurationDB).toHaveBeenCalledTimes(1);
      expect(mockDatabaseManager.getRuleConfig).toHaveBeenCalledTimes(1);

      // Verify cache statistics show both default and tenant entries appropriately
      const stats = configManager.getCacheStats();
      expect(stats.totalEntries).toBeGreaterThan(0);

      // Second request for same tenant should still check database for tenant config
      // This verifies the fix: default config should NOT be cached with tenant key
      const tenantConfig: RuleConfig = {
        id: 'tenant1-901@1.0.0',
        cfg: '1.0.0',
        desc: 'Tenant-specific rule config (newly added)',
        config: {
          bands: [{ subRuleRef: '.01', lowerLimit: 5, upperLimit: 25, reason: 'Tenant threshold' }],
        },
      };

      // Mock that tenant config is now available
      mockDatabaseManager.queryConfigurationDB.mockResolvedValueOnce([[tenantConfig]]);

      const result2 = await configManager.getRuleConfig('901@1.0.0', '1.0.0', 'tenant1');

      // Should get the new tenant-specific config, proving cache consistency fix works
      expect(result2).toEqual(tenantConfig);
      expect(mockDatabaseManager.queryConfigurationDB).toHaveBeenCalledTimes(2); // Second database check occurred
    });

    it('should correctly identify transaction with TenantId', () => {
      const transactionWithTenant = {
        TxTp: 'pacs.002.001.12',
        TenantId: 'tenant-123',
      };

      const transactionWithoutTenant = {
        TxTp: 'pacs.002.001.12',
      };

      expect(hasTenantId(transactionWithTenant)).toBe(true);
      expect(hasTenantId(transactionWithoutTenant)).toBe(false);
      expect(hasTenantId(null)).toBe(false);
      expect(hasTenantId(undefined)).toBe(false);
    });
  });
});
