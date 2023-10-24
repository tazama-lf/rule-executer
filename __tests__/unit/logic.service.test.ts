// SPDX-License-Identifier: Apache-2.0
import {
  DatabaseManagerInstance,
  LoggerService,
  ManagerConfig,
} from '@frmscoe/frms-coe-lib';
import {
  NetworkMap,
  RuleConfig,
  RuleRequest,
  RuleResult,
} from '@frmscoe/frms-coe-lib/lib/interfaces';
import ioredis from 'ioredis-mock';
import { handleTransaction } from 'rule/lib';
import { initializeDB, runServer, server } from '../../src';
import { config } from '../../src/config';
import { execute } from '../../src/controllers/execute';

const getMockRequest = () => {
  const quote: RuleRequest = {
    transaction: Object.assign(
      {},
      JSON.parse(
        `{"TxTp":"pacs.002.001.12","FIToFIPmtSts":{"GrpHdr":{"MsgId":"6b444365119746c5be7dfb5516ba67c4","CreDtTm":"${new Date().toISOString()}"},"TxInfAndSts":{"OrgnlInstrId":"5ab4fc7355de4ef8a75b78b00a681ed2","OrgnlEndToEndId":"2c516801007642dfb892944dde1cf845","TxSts":"ACCC","ChrgsInf":[{"Amt":{"Amt":307.14,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}}},{"Amt":{"Amt":153.57,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}}},{"Amt":{"Amt":30.71,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}}}],"AccptncDtTm":"2021-12-03T15:36:16.000Z","InstgAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}},"InstdAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}}}}}`,
      ),
    ),
    networkMap: Object.assign(
      new NetworkMap(),
      JSON.parse(
        '{"_key":"26345403","_id":"networkConfiguration/26345403","_rev":"_cxc-1vO---","messages":[{"id":"001@1.0","host":"http://openfaas:8080","cfg":"1.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0","host":"http://openfaas:8080","cfg":"1.0","typologies":[{"id":"028@1.0","host":"https://frmfaas.sybrin.com/function/off-typology-processor","cfg":"028@1.0","rules":[{"id":"017@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"028@1.0","host":"http://openfaas:8080","cfg":"1.0"}]},{"id":"029@1.0","host":"https://frmfaas.sybrin.com/function/off-typology-processor","cfg":"029@1.0","rules":[{"id":"003@1.0","host":"http://openfaas:8080","cfg":"1.0"},{"id":"005@1.0","host":"http://openfaas:8080","cfg":"1.0"}]}]},{"id":"002@1.0","host":"http://openfaas:8080","cfg":"1.0","typologies":[{"id":"030@1.0","host":"https://frmfaas.sybrin.com/function/off-typology-processor","cfg":"030@1.0","rules":[{"id":"003@1.0","host":"http://openfaas:8080","cfg":"1.0"},{"id":"006@1.0","host":"http://openfaas:8080","cfg":"1.0"}]},{"id":"031@1.0","host":"https://frmfaas.sybrin.com/function/off-typology-processor","cfg":"031@1.0","rules":[{"id":"003@1.0","host":"http://openfaas:8080","cfg":"1.0"},{"id":"007@1.0","host":"http://openfaas:8080","cfg":"1.0"}]}]}]}]}',
      ),
    ),
    DataCache: Object.assign(
      {},
      JSON.parse(
        '{"dbtrId": "dbtr_11f7c7310fb84649b9fe52672d3e2047","cdtrId": "cdtr_7d030a7af12f491c81e7d61b05ad2fb6","dbtrAcctId": "dbtrAcct_4f55ee2369d0480fb246ce23267baa84","cdtrAcctId": "cdtrAcct_c231f4170a4746e0a03674cc1e2f6487"}',
      ),
    ),
  };
  return quote;
};

const loggerService: LoggerService = new LoggerService();

beforeAll(async () => {
  await initializeDB();
  runServer();
});

afterAll(() => {});

describe('Logic Service', () => {
  beforeEach(() => {
    config.ruleVersion = '1.0.0';
    jest.mock('ioredis', () => ioredis);
    jest
      .fn(handleTransaction)
      .mockImplementation(
        (
          req: RuleRequest,
          determineOutcome: (
            value: number,
            ruleConfig: RuleConfig,
            ruleResult: RuleResult,
          ) => RuleResult,
          ruleRes: RuleResult,
          loggerService,
          ruleConfig: RuleConfig,
          databaseManager: DatabaseManagerInstance<ManagerConfig>,
        ): Promise<RuleResult> => {
          return Promise.resolve(ruleRes);
        },
      );
  });

  describe('execute', () => {
    it('should respond with rule result of true for happy path', async () => {
      const expectedReq = getMockRequest();
      let resString: string = '';
      server.handleResponse = (reponse: unknown): Promise<void> => {
        resString = reponse as string;
        return Promise.resolve();
      };

      const res = await execute(expectedReq as any);
      expect(resString).toBeTruthy();
    });
  });
});
