// SPDX-License-Identifier: Apache-2.0
// config settings, env variables

import type { ManagerConfig } from '@tazama-lf/frms-coe-lib';
import type { AdditionalConfig, ProcessorConfig } from '@tazama-lf/frms-coe-lib/lib/config/processor.config';

export const additionalEnvironmentVariables: AdditionalConfig[] = [
  {
    name: 'RULE_NAME',
    type: 'string',
  },
  {
    name: 'RULE_VERSION',
    type: 'string',
  },
  {
    name: 'ENRICHMENT_ENABLED',
    type: 'boolean',
    optional: true,
  },
];

export interface ExtendedConfig {
  RULE_NAME: string;
  RULE_VERSION: string;
  ENRICHMENT_ENABLED?: boolean | '';
}

// 'enrichment' is part of the database contract handed to rule processors (e.g. Rule Studio rules
// query databaseManager._enrichment), but the connection is only opened when ENRICHMENT_ENABLED=true.
export type RuleExecutorConfig = Required<
  Pick<ManagerConfig, 'rawHistory' | 'eventHistory' | 'configuration' | 'enrichment' | 'localCacheConfig'>
>;
export type Configuration = ProcessorConfig & RuleExecutorConfig & ExtendedConfig;
