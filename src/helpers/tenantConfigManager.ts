// SPDX-License-Identifier: Apache-2.0
import type { RuleConfig } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import type { DatabaseManagerInstance, LoggerService } from '@tazama-lf/frms-coe-lib';
import { unwrap } from '@tazama-lf/frms-coe-lib/lib/helpers/unwrap';
import type { RuleExecutorConfig } from '../config';

/**
 * Tenant-aware configuration manager for rule configurations
 * Provides caching and retrieval of tenant-specific rule configurations
 */
export class TenantConfigManager {
  private static instance: TenantConfigManager;
  private readonly tenantCache = new Map<string, RuleConfig>();
  private readonly cacheExpiry = new Map<string, number>();
  private readonly cacheTTL = 300000; // 5 minutes in milliseconds

  private constructor(
    private readonly databaseManager: DatabaseManagerInstance<RuleExecutorConfig>,
    private readonly loggerService: LoggerService,
  ) {}

  static getInstance(databaseManager: DatabaseManagerInstance<RuleExecutorConfig>, loggerService: LoggerService): TenantConfigManager {
    TenantConfigManager.instance ||= new TenantConfigManager(databaseManager, loggerService);
    return TenantConfigManager.instance;
  }

  /**
   * Gets rule configuration with tenant-specific caching
   * @param ruleId Rule identifier
   * @param cfg Configuration version
   * @param tenantId Optional tenant identifier
   * @returns Promise<RuleConfig | undefined>
   */
  async getRuleConfig(ruleId: string, cfg: string, tenantId?: string): Promise<RuleConfig | undefined> {
    const cacheKey = this.buildCacheKey(ruleId, cfg, tenantId);
    const context = 'TenantConfigManager.getRuleConfig';

    // Check cache first
    const cachedConfig = this.getFromCache(cacheKey);
    if (cachedConfig) {
      this.loggerService.trace(`Retrieved rule config from cache: ${cacheKey}`, context);
      return cachedConfig;
    }

    try {
      let sRuleConfig;

      if (tenantId) {
        // Try tenant-specific configuration first
        const tenantSpecificRuleId = ruleId.startsWith(tenantId) ? ruleId : `${tenantId}-${ruleId}`;
        const filter = `doc.id == "${tenantSpecificRuleId}" AND doc.cfg == "${cfg}" AND doc.tenantId == "${tenantId}"`;

        this.loggerService.log(`Querying tenant-specific rule config: ${tenantSpecificRuleId} for tenant: ${tenantId}`, context);
        sRuleConfig = await this.databaseManager.queryConfigurationDB('ruleConfiguration', filter, 1);

        // If no tenant-specific config found, fall back to default
        if (!sRuleConfig || (Array.isArray(sRuleConfig) && sRuleConfig.length === 0)) {
          this.loggerService.log(`No tenant-specific rule config found, falling back to default for rule: ${ruleId}`, context);
          sRuleConfig = await this.databaseManager.getRuleConfig(ruleId, cfg);
        }
      } else {
        // No tenantId, use standard method
        sRuleConfig = await this.databaseManager.getRuleConfig(ruleId, cfg);
      }

      const ruleConfig = unwrap<RuleConfig>(sRuleConfig as RuleConfig[][]);

      if (ruleConfig?.config) {
        // Cache the result
        this.setInCache(cacheKey, ruleConfig);
        this.loggerService.log(`Cached rule configuration: ${cacheKey}`, context);
        return ruleConfig;
      } else {
        throw new Error('Rule processor configuration not retrievable');
      }
    } catch (error) {
      this.loggerService.error(`Error retrieving rule configuration for ${cacheKey}`, error, context);
      throw error;
    }
  }

  /**
   * Builds cache key for tenant-specific configurations
   */
  private buildCacheKey(ruleId: string, cfg: string, tenantId?: string): string {
    return tenantId ? `tenant:${tenantId}:rule:${ruleId}:cfg:${cfg}` : `rule:${ruleId}:cfg:${cfg}`;
  }

  /**
   * Gets configuration from cache if not expired
   */
  private getFromCache(cacheKey: string): RuleConfig | undefined {
    const expiry = this.cacheExpiry.get(cacheKey);
    if (expiry && Date.now() > expiry) {
      // Cache expired, remove it
      this.tenantCache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
      return undefined;
    }
    return this.tenantCache.get(cacheKey);
  }

  /**
   * Sets configuration in cache with expiry
   */
  private setInCache(cacheKey: string, config: RuleConfig): void {
    this.tenantCache.set(cacheKey, config);
    this.cacheExpiry.set(cacheKey, Date.now() + this.cacheTTL);
  }

  /**
   * Clears cache for a specific tenant
   */
  clearTenantCache(tenantId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.tenantCache.keys()) {
      if (key.startsWith(`tenant:${tenantId}:`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => {
      this.tenantCache.delete(key);
      this.cacheExpiry.delete(key);
    });

    this.loggerService.log(`Cleared cache for tenant: ${tenantId}`, 'TenantConfigManager.clearTenantCache');
  }

  /**
   * Gets cache statistics for monitoring
   */
  getCacheStats(): { totalEntries: number; tenantEntries: number; defaultEntries: number } {
    let tenantEntries = 0;
    let defaultEntries = 0;

    for (const key of this.tenantCache.keys()) {
      if (key.startsWith('tenant:')) {
        tenantEntries++;
      } else {
        defaultEntries++;
      }
    }

    return {
      totalEntries: this.tenantCache.size,
      tenantEntries,
      defaultEntries,
    };
  }
}
