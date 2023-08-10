import apm from 'elastic-apm-node';
import { config } from './config';

if (config.apmLogging) {
  apm.start({
    serviceName: config.functionName,
    secretToken: config.apmSecretToken,
    serverUrl: config.apmURL,
    usePathAsTransactionName: true,
    transactionIgnoreUrls: ['/health'],
  });
}
