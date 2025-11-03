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
];

export interface ExtendedConfig {
  RULE_NAME: string;
  RULE_VERSION: string;
}

export type RuleExecutorConfig = Required<Pick<ManagerConfig, 'rawHistory' | 'eventHistory' | 'configuration' | 'localCacheConfig'>>;
export type Configuration = ProcessorConfig & RuleExecutorConfig & ExtendedConfig;
