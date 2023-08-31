import { Apm } from '@frmscoe/frms-coe-lib/lib/services/apm';
import { config } from './config';

const apm = new Apm({
  serviceName: config.functionName,
  secretToken: config.apmSecretToken,
  serverUrl: config.apmURL,
  usePathAsTransactionName: true,
  active: Boolean(config.apmLogging),
  transactionIgnoreUrls: ['/health'],
});

export default apm;
