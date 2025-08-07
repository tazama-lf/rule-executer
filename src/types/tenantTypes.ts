// SPDX-License-Identifier: Apache-2.0
import type { RuleRequest as BaseRuleRequest } from '@tazama-lf/frms-coe-lib/lib/interfaces';

/**
 * Extended RuleRequest interface that includes tenant information
 */
export interface TenantAwareRuleRequest extends BaseRuleRequest {
  tenantId?: string;
}

/**
 * Utility type to extract TenantId from transaction objects
 */
export interface TransactionWithTenant {
  TenantId?: string;
  [key: string]: unknown;
}

/**
 * Type guard to check if transaction has TenantId
 */
export function hasTenantId(transaction: unknown): transaction is TransactionWithTenant {
  return transaction !== null && transaction !== undefined && typeof transaction === 'object' && 'TenantId' in transaction;
}

/**
 * Extract tenant ID from transaction payload
 */
export function extractTenantId(transaction: unknown): string | undefined {
  if (hasTenantId(transaction) && typeof transaction.TenantId === 'string') {
    return transaction.TenantId;
  }
  return undefined;
}
