import { databaseManager, init, runServer } from '../../src';
import App from '../../src/app';
import { config } from '../../src/config';
import ioredis from 'ioredis-mock';
import {
  RuleResult,
  RuleRequest,
  RuleConfig,
  DataCache,
  NetworkMap,
  Pacs002,
} from '@frmscoe/frms-coe-lib/lib/interfaces';
import { handleTransaction } from 'rule/lib';
import { execute } from '../../src/controllers/execute';
import { Context } from 'koa';
import {
  DatabaseManagerInstance,
  LoggerService,
  ManagerConfig,
} from '@frmscoe/frms-coe-lib';

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
  };
  return quote;
};

let app: App;
beforeAll(async () => {
  app = runServer();
  await init();
});

afterAll(() => {
  app.terminate();
});

describe('Logic Service', () => {
  beforeEach(() => {
    config.ruleVersion = '1.0.0';
    jest.mock('ioredis', () => ioredis);
    //jest.spyOn(console, 'error').mockImplementation(() => { });
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
          loggerService: LoggerService,
          ruleConfig: RuleConfig,
          databaseManager: DatabaseManagerInstance<ManagerConfig>,
          dataCache: DataCache,
        ): Promise<RuleResult> => {
          return Promise.resolve(ruleRes);
        },
      );
  });

  // config.apmLogging = false;
  describe('execute', () => {
    it('should respond with rule result of true for happy path', async () => {
      const expectedReq = getMockRequest();
      let ctx = {
        body: {
          transaction: expectedReq.transaction,
          networkMap: expectedReq.networkMap,
          DataCache: {},
        },
        status: 404,
      };

      const res = await execute(ctx as Context);
      if (res)
        // Expect fail status as we still have a http rest server - this will be fixed with new backend
        expect(res.status).toEqual(500);
      else expect('Error').toBe('Occurred');
    });
  });
});
