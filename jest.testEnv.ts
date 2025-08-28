// SPDX-License-Identifier: Apache-2.0
process.env.MAX_CPU = '1';
process.env.STARTUP_TYPE = 'nats';
process.env.SERVER_URL = 'http://localhost:3000';
process.env.FUNCTION_NAME = 'test-rule-executor';
process.env.RULE_NAME = '003';
process.env.RULE_VERSION = '1.0';

process.env.APM_ACTIVE = 'false';
process.env.APM_SERVICE_NAME = 'test';
process.env.APM_URL = 'test';
