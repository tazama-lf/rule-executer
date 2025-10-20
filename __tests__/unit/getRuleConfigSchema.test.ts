// SPDX-License-Identifier: Apache-2.0

jest.mock('rule/lib', () => ({
  handleTransaction: jest.fn(),
  getRuleConfigSchema: jest.fn(),
}));

import { NetworkMap, RuleConfig, RuleRequest, RuleResult } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import { DataCacheSample, Pacs002Sample } from '@tazama-lf/frms-coe-lib/lib/tests/data';
import { handleTransaction, getRuleConfigSchema } from 'rule/lib';
import { configuration, databaseManager, initializeDB, runServer, server } from '../../src';
import { execute } from '../../src/controllers/execute';
import determineOutcome from '../../src/helpers/determineOutcome';
import Ajv from 'ajv';

jest.mock('@tazama-lf/frms-coe-lib/lib/services/dbManager', () => ({
  CreateStorageManager: jest
    .fn()
    .mockReturnValue({ db: { getRuleConfig: jest.fn(), isReadyCheck: jest.fn().mockReturnValue({ nodeEnv: 'test' }) } }),
}));

jest.mock('@tazama-lf/frms-coe-lib/lib/config/processor.config', () => ({
  validateProcessorConfig: jest.fn().mockReturnValue({ functionName: 'test-rule-executor', nodeEnv: 'test', maxCPU: 1 }),
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

const NetworkMapSample: NetworkMap[] = [
  {
    active: true,
    tenantId: 'tenantId',
    cfg: '1.0.0',
    messages: [
      {
        id: '004@1.0.0',
        cfg: '1.0.0',
        txTp: 'pacs.002.001.12',
        typologies: [
          {
            id: 'typology-processor@1.0.0',
            tenantId: 'tenantId',
            cfg: '999@1.0.0',
            rules: [
              {
                id: 'EFRuP@1.0.0',
                cfg: 'none',
              },
              {
                id: '901@1.0.0',
                cfg: '1.0.0',
              },
              {
                id: '902@1.0.0',
                cfg: '1.0.0',
              },
            ],
          },
        ],
      },
    ],
  },
];

const ruleConfig: RuleConfig = {
  id: '901@1.0.0',
  cfg: '1.0.0',
  tenantId: 'tenantId',
  desc: 'Number of outgoing transactions - debtor',
  config: {
    parameters: {
      maxQueryRange: 86400000,
    },
    exitConditions: [
      {
        subRuleRef: '.x00',
        reason: 'Incoming transaction is unsuccessful',
      },
    ],
    bands: [
      {
        subRuleRef: '.01',
        upperLimit: 2,
        reason: 'The debtor has performed one transaction to date',
      },
      {
        subRuleRef: '.02',
        lowerLimit: 2,
        upperLimit: 3,
        reason: 'The debtor has performed two transactions to date',
      },
      {
        subRuleRef: '.03',
        lowerLimit: 3,
        reason: 'The debtor has performed three or more transactions to date',
      },
    ],
  },
};

const ruleRes: RuleResult = {
  id: '901@1.0.0',
  cfg: '1.0.0',
  tenantId: 'tenantId',
  subRuleRef: '.01',
  prcgTm: undefined,
  reason: undefined,
  indpdntVarbl: 1,
};

const getMockRequest = () => {
  const quote: RuleRequest = {
    transaction: Object.assign({}, Pacs002Sample),
    networkMap: NetworkMapSample[0],
    DataCache: Object.assign({}, DataCacheSample),
  };
  return quote;
};

const ajv = new Ajv(); // Initialize Ajv
const rule901Schema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
    },
    cfg: {
      type: 'string',
    },
    config: {
      type: 'object',
      properties: {
        parameters: {
          type: 'object',
          properties: {
            maxQueryRange: {
              type: 'integer',
            },
          },
          required: ['maxQueryRange'],
        },
        exitConditions: {
          type: 'array',
          minItems: 1,
          maxItems: 1,
          items: {
            type: 'object',
            properties: {
              subRuleRef: {
                type: 'string',
                enum: ['.x00'],
              },
              reason: {
                type: 'string',
                enum: ['Incoming transaction is unsuccessful'],
              },
            },
            required: ['subRuleRef', 'reason'],
            additionalProperties: false,
          },
        },
        bands: {
          type: 'array',
          minItems: 2,
          items: {
            type: 'object',
            properties: {
              subRuleRef: {
                type: 'string',
              },
              upperLimit: {
                type: 'integer',
              },
              lowerLimit: {
                type: 'integer',
              },
              reason: {
                type: 'string',
              },
            },
            required: ['subRuleRef', 'reason'],
            additionalProperties: false,
            anyOf: [
              {
                required: ['upperLimit'],
              },
              {
                required: ['lowerLimit'],
              },
            ],
          },
        },
      },
      required: ['parameters', 'exitConditions', 'bands'],
    },
    tenantId: {
      type: 'string',
    },
    desc: {
      type: 'string',
    },
  },
  required: ['id', 'cfg', 'config', 'tenantId'],
};
const validate = ajv.compile(rule901Schema);

beforeAll(async () => {
  await initializeDB();
  await runServer();
});

afterAll((done) => {
  done();
});

describe('AJV Schema Validation', () => {
  let responseSpy: jest.SpyInstance;

  beforeEach(() => {
    configuration.RULE_NAME = '901';
    configuration.RULE_VERSION = '1.0.0';
  });

  it('should return true for valid data', () => {
    const validData = ruleConfig;
    expect(validate(validData)).toBe(true);
    expect(validate.errors).toBeNull(); // No errors for valid data
  });

  it('should pass schema validation with valid config', async () => {
    jest.spyOn(require('rule/lib'), 'getRuleConfigSchema').mockReturnValue(rule901Schema);

    jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig> => {
      return await Promise.resolve(ruleConfig);
    });

    jest.spyOn(require('rule/lib'), 'handleTransaction').mockResolvedValue(ruleRes);

    const expectedReq = getMockRequest();
    responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

    await execute(expectedReq);

    expect(responseSpy).toHaveBeenCalledWith({ ...expectedReq, metaData: undefined, ruleResult: ruleRes });
  });

  it('should respond with error when schema validation fails', async () => {
    jest.spyOn(require('rule/lib'), 'getRuleConfigSchema').mockReturnValue(rule901Schema);

    const { id, ...invalidRuleConfig } = ruleConfig;

    jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<any> => {
      return await Promise.resolve(invalidRuleConfig); // This will fail validation
    });

    const errRuleResult: RuleResult = {
      ...ruleRes,
      subRuleRef: '.err',
      indpdntVarbl: 0,
      prcgTm: expect.any(Number), // Accepts any number
      reason: "Rule configuration validation failed: data must have required property 'id'",
    };

    const expectedReq = getMockRequest();
    responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

    await execute(expectedReq);

    expect(responseSpy).toHaveBeenCalledWith({
      transaction: expectedReq.transaction,
      ruleResult: expect.objectContaining(errRuleResult),
      networkMap: expectedReq.networkMap,
    });
  });

  it('should handle error when getRuleConfigSchema is not available', async () => {
    jest.spyOn(require('rule/lib'), 'getRuleConfigSchema').mockImplementation(() => {
      throw new Error('getRuleConfigSchema is not a function');
    });

    jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig> => {
      return await Promise.resolve(ruleConfig);
    });

    jest.spyOn(require('rule/lib'), 'handleTransaction').mockResolvedValue(ruleRes);

    const expectedReq = getMockRequest();
    responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

    await execute(expectedReq);

    expect(responseSpy).toHaveBeenCalledWith({ ...expectedReq, metaData: undefined, ruleResult: ruleRes });
  });

  it('should skip schema validation when getRuleConfigSchema is not a function', async () => {
    Object.defineProperty(require('rule/lib'), 'getRuleConfigSchema', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    jest.spyOn(databaseManager, 'getRuleConfig').mockImplementationOnce(async (): Promise<RuleConfig> => {
      return await Promise.resolve(ruleConfig);
    });

    jest.spyOn(require('rule/lib'), 'handleTransaction').mockResolvedValue(ruleRes);

    const expectedReq = getMockRequest();
    responseSpy = jest.spyOn(server, 'handleResponse').mockImplementationOnce(jest.fn());

    await execute(expectedReq);

    expect(responseSpy).toHaveBeenCalledWith({ ...expectedReq, metaData: undefined, ruleResult: ruleRes });
  });
});
