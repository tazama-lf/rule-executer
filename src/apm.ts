// SPDX-License-Identifier: Apache-2.0
import { Apm } from '@tazama-lf/frms-coe-lib/lib/services/apm';
import { validateAPMConfig } from '@tazama-lf/frms-coe-lib/lib/helpers/env/monitoring.config';

const apmConfig = validateAPMConfig();

const apm = new Apm({
  serviceName: apmConfig.apmServiceName,
  secretToken: apmConfig.apmSecretToken,
  serverUrl: apmConfig.apmUrl,
  usePathAsTransactionName: true,
  active: apmConfig.apmActive,
  transactionIgnoreUrls: ['/health'],
});

export default apm;
