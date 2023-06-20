import { databaseManager, init, runServer } from '../../src';
import App from '../../src/app';
import { IPacs002Message } from '../../src/classes/iPacs002';
import { NetworkMap } from '../../src/classes/network-map';
import { RuleRequest } from '../../src/classes/rule-request';
import {
  Rule017Config,
  ruleDescriptionErrorMsg,
} from '../../src/classes/ruleConfig';
import { config } from '../../src/config';
import { handleTransaction } from '../../src/services/logic.service';
import ioredis from 'ioredis-mock';

const getMockRequest = () => {
  const quote = new RuleRequest(
    Object.assign(
      new IPacs002Message(),
      JSON.parse(
        `{"TxTp":"pacs.002.001.12","FIToFIPmtSts":{"GrpHdr":{"MsgId":"6b444365119746c5be7dfb5516ba67c4","CreDtTm":"${new Date().toISOString()}"},"TxInfAndSts":{"OrgnlInstrId":"5ab4fc7355de4ef8a75b78b00a681ed2","OrgnlEndToEndId":"2c516801007642dfb892944dde1cf845","TxSts":"ACCC","ChrgsInf":[{"Amt":{"Amt":307.14,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}}},{"Amt":{"Amt":153.57,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}}},{"Amt":{"Amt":30.71,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}}}],"AccptncDtTm":"2021-12-03T15:36:16.000Z","InstgAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}},"InstdAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}}}}}`,
      ),
    ),
    Object.assign(
      new NetworkMap(),
      JSON.parse(
        '{"_key":"26345403","_id":"networkConfiguration/26345403","_rev":"_cxc-1vO---","messages":[{"id":"001@1.0","host":"http://openfaas:8080","cfg":"1.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0","host":"http://openfaas:8080","cfg":"1.0","typologies":[{"id":"028@1.0","host":"https://frmfaas.sybrin.com/function/off-typology-processor","cfg":"028@1.0","rules":[{"id":"017@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"028@1.0","host":"http://openfaas:8080","cfg":"1.0"}]},{"id":"029@1.0","host":"https://frmfaas.sybrin.com/function/off-typology-processor","cfg":"029@1.0","rules":[{"id":"003@1.0","host":"http://openfaas:8080","cfg":"1.0"},{"id":"005@1.0","host":"http://openfaas:8080","cfg":"1.0"}]}]},{"id":"002@1.0","host":"http://openfaas:8080","cfg":"1.0","typologies":[{"id":"030@1.0","host":"https://frmfaas.sybrin.com/function/off-typology-processor","cfg":"030@1.0","rules":[{"id":"003@1.0","host":"http://openfaas:8080","cfg":"1.0"},{"id":"006@1.0","host":"http://openfaas:8080","cfg":"1.0"}]},{"id":"031@1.0","host":"https://frmfaas.sybrin.com/function/off-typology-processor","cfg":"031@1.0","rules":[{"id":"003@1.0","host":"http://openfaas:8080","cfg":"1.0"},{"id":"007@1.0","host":"http://openfaas:8080","cfg":"1.0"}]}]}]}]}',
      ),
    ),
  );
  return quote;
};

let app: App;
beforeAll(async () => {
  app = runServer();
  await init();
});

afterAll(() => {
  databaseManager.quit();
  app.terminate();
});

const ruleDescriptionField = (ruleDesc?: string) => {
  return ruleDesc ? `,"desc":"${ruleDesc}"` : '';
};

describe('Logic Service', () => {
  let getTransactionSpy: jest.SpyInstance;
  let getRuleConfigSpy: jest.SpyInstance;
  let getDebtorPacs002EdgesSpy: jest.SpyInstance;
  let getDebtorPacs002EdgesSpy2: jest.SpyInstance;

  beforeEach(() => {
    config.ruleVersion = '1.0.0';
    jest.mock('ioredis', () => ioredis);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  // config.apmLogging = false;
  describe('Handle Transaction', () => {
    it('should respond with rule result of true for happy path', async () => {
      getRuleConfigSpy = jest
        .spyOn(databaseManager, 'getRuleConfig')
        .mockImplementationOnce((ruleId: string) => {
          return new Promise((resolve, reject) => {
            const sRuleConfig = JSON.parse(
              `[[{"id":"002@1.0.0","cfg":"1.0.0"${ruleDescriptionField()},"config":{"timeframes":[{"threshold":86400000}],"bands":[{"subRuleRef":".01","lowerLimit":5,"outcome":true,"reason":"Transaction divergence detected on source account"},{"subRuleRef":".00","upperLimit":5,"outcome":false,"reason":"No Transaction divergence detected on source account"}]}}]]`,
            );
            resolve(Object.assign(new Rule017Config(), sRuleConfig));
          });
        });
      getTransactionSpy = jest
        .spyOn(databaseManager, 'getTransactionPacs008')
        .mockImplementationOnce(async (endToEndId: string) => {
          return new Promise((resolve, reject) => {
            resolve(
              JSON.parse(
                '[[{"_key":"3527012","_id":"transactionHistory/3527012","_rev":"_dVnvweG---","TxTp":"pacs.008.001.10","FIToFICstmrCdt":{"GrpHdr":{"MsgId":"5e74d27d-02ce-4db3-8254-e0161b8258f6","CreDtTm":"2021-12-02T10:05:09.000Z","NbOfTxs":1,"SttlmInf":{"SttlmMtd":"CLRG"}},"CdtTrfTxInf":{"PmtId":{"InstrId":"fa2ed11e-7a2b-4fc6-a3b6-9338b6c0a503","EndToEndId":"5036fa4f-0cb1-442c-b1a8-be0a3ce66365"},"IntrBkSttlmAmt":{"Amt":{"Amt":74371.24,"Ccy":"USD"}},"InstdAmt":{"Amt":{"Amt":74371.24,"Ccy":"USD"}},"ChrgBr":"DEBT","ChrgsInf":{"Amt":{"Amt":736.35,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}}},"InitgPty":{"Nm":"HildaGlenGrant","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1929-06-02","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27765784647","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-765784647"}},"Dbtr":{"Nm":"HildaGlenGrant","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1929-06-02","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27765784647","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-765784647"}},"DbtrAcct":{"Id":{"Othr":{"Id":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954e90","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"HildaGrant"},"DbtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}},"CdtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}},"Cdtr":{"Nm":"FeliciaManfrey","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1965-07-04","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27827537492","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-827537492"}},"CdtrAcct":{"Id":{"Othr":{"Id":"+27827537492","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"FeliciaManfrey"},"Purp":{"Cd":"MP2P"}},"RgltryRptg":{"Dtls":{"Tp":"BALANCEOFPAYMENTS","Cd":"100"}},"RmtInf":{"Ustrd":"PaymentofUSD73634.89fromHildatoFelicia"},"SplmtryData":{"Envlp":{"Doc":{"Xprtn":"2021-12-02T10:10:05.000Z"}}}}}]]',
              ),
            );
          });
        });

      getDebtorPacs002EdgesSpy2 = jest
        .spyOn(databaseManager, 'getIncomingPacs002Edges')
        .mockImplementationOnce(() => {
          return new Promise((resolve) => {
            resolve(
              JSON.parse(
                `[[{"_key":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954e90","_from":"accounts/e2fa05b6a56ceedb37581703b98590b44194a8c0d2799f4319ebbece5e20ecc1","_to":"accounts/af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954e90","TxTp":"pacs.002.001.12","TxSts":"ACCC","CreDtTm": "${new Date().toISOString()}","PmtInfId":"2f68ae16-467a-4ac4-ba32-eb518646aa1d","EndToEndId":"5cb8a2db-5c32-41bb-ac27-2597125d50fd"},{"_key":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954e","_from":"accounts/e2fa05b6a56ceedb37581703b98590b44194a8c0d2799f4319ebbece5e20ecc1","_to":"accounts/af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954e","TxTp":"pacs.002.001.12","TxSts":"ACCC","CreDtTm": "${new Date().toISOString()}","PmtInfId":"2f68ae16-467a-4ac4-ba32-eb518646aa1d","EndToEndId":"5cb8a2db-5c32-41bb-ac27-2597125d50de"},{"_key":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954","_from":"accounts/e2fa05b6a56ceedb37581703b98590b44194a8c0d2799f4319ebbece5e20ecc1","_to":"accounts/af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954","TxTp":"pacs.002.001.12","TxSts":"ACCC","CreDtTm": "${new Date().toISOString()}","PmtInfId":"2f68ae16-467a-4ac4-ba32-eb518646aa1d","EndToEndId":"5cb8a2db-5c32-41bb-ac27-2597125d50u4"},{"_key":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab195","_from":"accounts/e2fa05b6a56ceedb37581703b98590b44194a8c0d2799f4319ebbece5e20ecc1","_to":"accounts/af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab195","TxTp":"pacs.002.001.12","TxSts":"ACCC","CreDtTm": "${new Date().toISOString()}","PmtInfId":"2f68ae16-467a-4ac4-ba32-eb518646aa1d","EndToEndId":"5cb8a2db-5c32-41bb-ac27-2597125d50vm"},{"_key":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab","_from":"accounts/e2fa05b6a56ceedb37581703b98590b44194a8c0d2799f4319ebbece5e20ecc1","_to":"accounts/af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab","TxTp":"pacs.002.001.12","TxSts":"ACCC","CreDtTm":"2022-01-20T15:41:55.229Z","PmtInfId":"2f68ae16-467a-4ac4-ba32-eb518646aa1d","EndToEndId":"5cb8a2db-5c32-41bb-ac27-2597125d50ws"},{"_key":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab195","_from":"accounts/e2fa05b6a56ceedb37581703b98590b44194a8c0d2799f4319ebbece5e20ecc1","_to":"accounts/af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab195","TxTp":"pacs.002.001.12","TxSts":"ACCC","CreDtTm": "${new Date().toISOString()}","PmtInfId":"2f68ae16-467a-4ac4-ba32-eb518646aa1d","EndToEndId":"5cb8a2db-5c32-41bb-ac27-2597125d50vm"},{"_key":"af36cfd29dd05eb483358899055a552af93cd7ae36093","_from":"accounts/e2fa05b6a56ceedb37581703b98590b44194a8c0d2799f4319ebbece5e20ecc1","_to":"accounts/af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab","TxTp":"pacs.002.001.12","TxSts":"ACCC","CreDtTm": "${new Date().toISOString()}","PmtInfId":"2f68ae16-467a-4ac4-ba32-eb518646aa1d","EndToEndId":"5cb8a2db-5c32-41bb-ac27-2597125d50vm"}]]`,
              ),
            );
          });
        });

      const expectedReq = getMockRequest();
      const res = await handleTransaction(expectedReq);
      expect(res).toEqual(
        JSON.parse(
          `{"id":"017@1.0.0", "cfg": "1.0.0","desc":"${ruleDescriptionErrorMsg}","result":true,"subRuleRef":".01","reason":"Transaction divergence detected on source account"}`,
        ),
      );
    });

    it('should respond with rule result of false, with no config', async () => {
      getRuleConfigSpy = jest
        .spyOn(databaseManager, 'getRuleConfig')
        .mockImplementation((ruleId: string) => {
          return new Promise((resolve, reject) => {
            resolve('');
          });
        });

      getTransactionSpy = jest
        .spyOn(databaseManager, 'getTransactionPacs008')
        .mockImplementation(async (endToEndId: string) => {
          return new Promise((resolve, reject) => {
            resolve(
              JSON.parse(
                '[[{"_key":"3527012","_id":"transactionHistory/3527012","_rev":"_dVnvweG---","TxTp":"pacs.008.001.10","FIToFICstmrCdt":{"GrpHdr":{"MsgId":"5e74d27d-02ce-4db3-8254-e0161b8258f6","CreDtTm":"2021-12-02T10:05:09.000Z","NbOfTxs":1,"SttlmInf":{"SttlmMtd":"CLRG"}},"CdtTrfTxInf":{"PmtId":{"InstrId":"fa2ed11e-7a2b-4fc6-a3b6-9338b6c0a503","EndToEndId":"5036fa4f-0cb1-442c-b1a8-be0a3ce66365"},"IntrBkSttlmAmt":{"Amt":{"Amt":74371.24,"Ccy":"USD"}},"InstdAmt":{"Amt":{"Amt":74371.24,"Ccy":"USD"}},"ChrgBr":"DEBT","ChrgsInf":{"Amt":{"Amt":736.35,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}}},"InitgPty":{"Nm":"HildaGlenGrant","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1929-06-02","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27765784647","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-765784647"}},"Dbtr":{"Nm":"HildaGlenGrant","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1929-06-02","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27765784647","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-765784647"}},"DbtrAcct":{"Id":{"Othr":{"Id":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954e90","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"HildaGrant"},"DbtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}},"CdtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}},"Cdtr":{"Nm":"FeliciaManfrey","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1965-07-04","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27827537492","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-827537492"}},"CdtrAcct":{"Id":{"Othr":{"Id":"+27827537492","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"FeliciaManfrey"},"Purp":{"Cd":"MP2P"}},"RgltryRptg":{"Dtls":{"Tp":"BALANCEOFPAYMENTS","Cd":"100"}},"RmtInf":{"Ustrd":"PaymentofUSD73634.89fromHildatoFelicia"},"SplmtryData":{"Envlp":{"Doc":{"Xprtn":"2021-12-02T10:10:05.000Z"}}}}}]]',
              ),
            );
          });
        });

      getDebtorPacs002EdgesSpy = jest
        .spyOn(databaseManager, 'getIncomingPacs002Edges')
        .mockImplementation(async (debtorId: string) => {
          return new Promise((resolve, reject) => {
            resolve(
              JSON.parse(
                '[[{"_key":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954e90","_from":"accounts/e2fa05b6a56ceedb37581703b98590b44194a8c0d2799f4319ebbece5e20ecc1","_to":"accounts/af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954e90","TxTp":"pacs.002.001.12","TxSts":"ACCC","CreDtTm": "2022-01-17T16:11:13.968Z","PmtInfId":"2f68ae16-467a-4ac4-ba32-eb518646aa1d","EndToEndId":"5cb8a2db-5c32-41bb-ac27-2597125d50fd"},{"_key":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954e","_from":"accounts/e2fa05b6a56ceedb37581703b98590b44194a8c0d2799f4319ebbece5e20ecc1","_to":"accounts/af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954e","TxTp":"pacs.002.001.12","TxSts":"ACCC","CreDtTm":"2022-01-17T16:11:13.968Z).toISOString()","PmtInfId":"2f68ae16-467a-4ac4-ba32-eb518646aa1d","EndToEndId":"5cb8a2db-5c32-41bb-ac27-2597125d50de"},{"_key":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954","_from":"accounts/e2fa05b6a56ceedb37581703b98590b44194a8c0d2799f4319ebbece5e20ecc1","_to":"accounts/af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954","TxTp":"pacs.002.001.12","TxSts":"ACCC","CreDtTm":"2022-01-16T22:13:13.968Z).toISOString()","PmtInfId":"2f68ae16-467a-4ac4-ba32-eb518646aa1d","EndToEndId":"5cb8a2db-5c32-41bb-ac27-2597125d50u4"},{"_key":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab195","_from":"accounts/e2fa05b6a56ceedb37581703b98590b44194a8c0d2799f4319ebbece5e20ecc1","_to":"accounts/af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab195","TxTp":"pacs.002.001.12","TxSts":"ACCC","CreDtTm":"2022-01-16T22:13:13.968Z","PmtInfId":"2f68ae16-467a-4ac4-ba32-eb518646aa1d","EndToEndId":"5cb8a2db-5c32-41bb-ac27-2597125d50vm"},{"_key":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab","_from":"accounts/e2fa05b6a56ceedb37581703b98590b44194a8c0d2799f4319ebbece5e20ecc1","_to":"accounts/af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab","TxTp":"pacs.002.001.12","TxSts":"ACCC","CreDtTm":"2022-01-16T22:13:13.968Z).toISOString()","PmtInfId":"2f68ae16-467a-4ac4-ba32-eb518646aa1d","EndToEndId":"5cb8a2db-5c32-41bb-ac27-2597125d50ws"}]]',
              ),
            );
          });
        });

      const expectedReq = getMockRequest();
      const res = await handleTransaction(expectedReq);
      expect(res).toEqual(
        JSON.parse(
          `{"id":"017@1.0.0","desc":"${ruleDescriptionErrorMsg}","cfg": "1.0.0","result":false,"subRuleRef":"","reason":""}`,
        ),
      );
    });

    it('should respond with readable rule description for whitespace-only strings', async () => {
      getRuleConfigSpy = jest
        .spyOn(databaseManager, 'getRuleConfig')
        .mockImplementation((ruleId: string) => {
          return new Promise((resolve, reject) => {
            const sRuleConfig = JSON.parse(
              `[[{"id":"002@1.0.0","cfg":"1.0.0"${ruleDescriptionField(
                '     ',
              )},"config":{"timeframes":[{"threshold":86400000}],"bands":[{"subRuleRef":".01","lowerLimit":5,"outcome":true,"reason":"No Transaction divergence detected on source account"},{"subRuleRef":".00","upperLimit":5,"outcome":false,"reason":"No Transaction divergence detected on source account"}]}}]]`,
            );
            resolve(Object.assign(new Rule017Config(), sRuleConfig));
          });
        });

      getTransactionSpy = jest
        .spyOn(databaseManager, 'getTransactionPacs008')
        .mockImplementation(async (endToEndId: string) => {
          return new Promise((resolve, reject) => {
            resolve(
              JSON.parse(
                '[[{"_key":"3527012","_id":"transactionHistory/3527012","_rev":"_dVnvweG---","TxTp":"pacs.008.001.10","FIToFICstmrCdt":{"GrpHdr":{"MsgId":"5e74d27d-02ce-4db3-8254-e0161b8258f6","CreDtTm":"2021-12-02T10:05:09.000Z","NbOfTxs":1,"SttlmInf":{"SttlmMtd":"CLRG"}},"CdtTrfTxInf":{"PmtId":{"InstrId":"fa2ed11e-7a2b-4fc6-a3b6-9338b6c0a503","EndToEndId":"5036fa4f-0cb1-442c-b1a8-be0a3ce66365"},"IntrBkSttlmAmt":{"Amt":{"Amt":74371.24,"Ccy":"USD"}},"InstdAmt":{"Amt":{"Amt":74371.24,"Ccy":"USD"}},"ChrgBr":"DEBT","ChrgsInf":{"Amt":{"Amt":736.35,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}}},"InitgPty":{"Nm":"HildaGlenGrant","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1929-06-02","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27765784647","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-765784647"}},"Dbtr":{"Nm":"HildaGlenGrant","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1929-06-02","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27765784647","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-765784647"}},"DbtrAcct":{"Id":{"Othr":{"Id":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954e90","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"HildaGrant"},"DbtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}},"CdtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}},"Cdtr":{"Nm":"FeliciaManfrey","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1965-07-04","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27827537492","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-827537492"}},"CdtrAcct":{"Id":{"Othr":{"Id":"+27827537492","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"FeliciaManfrey"},"Purp":{"Cd":"MP2P"}},"RgltryRptg":{"Dtls":{"Tp":"BALANCEOFPAYMENTS","Cd":"100"}},"RmtInf":{"Ustrd":"PaymentofUSD73634.89fromHildatoFelicia"},"SplmtryData":{"Envlp":{"Doc":{"Xprtn":"2021-12-02T10:10:05.000Z"}}}}}]]',
              ),
            );
          });
        });
      getDebtorPacs002EdgesSpy = jest
        .spyOn(databaseManager, 'getIncomingPacs002Edges')
        .mockImplementation((debtorId: string) => {
          return new Promise((resolve, reject) => {
            resolve([[]]);
          });
        });

      const expectedReq = getMockRequest();
      const res = await handleTransaction(expectedReq);
      expect(res).toEqual(
        JSON.parse(
          `{"id":"017@1.0.0","cfg":"1.0.0","desc": "${ruleDescriptionErrorMsg}","result":false,"subRuleRef":".00","reason":"No Transaction divergence detected on source account"}`,
        ),
      );
    });

    it('should respond with readable rule description for empty strings', async () => {
      getRuleConfigSpy = jest
        .spyOn(databaseManager, 'getRuleConfig')
        .mockImplementation((ruleId: string) => {
          return new Promise((resolve, reject) => {
            const sRuleConfig = JSON.parse(
              `[[{"id":"002@1.0.0","cfg":"1.0.0"${ruleDescriptionField(
                '',
              )},"config":{"timeframes":[{"threshold":86400000}],"bands":[{"subRuleRef":".01","lowerLimit":5,"outcome":true,"reason":"No Transaction divergence detected on source account"},{"subRuleRef":".00","upperLimit":5,"outcome":false,"reason":"No Transaction divergence detected on source account"}]}}]]`,
            );
            resolve(Object.assign(new Rule017Config(), sRuleConfig));
          });
        });

      getTransactionSpy = jest
        .spyOn(databaseManager, 'getTransactionPacs008')
        .mockImplementation(async (endToEndId: string) => {
          return new Promise((resolve, reject) => {
            resolve(
              JSON.parse(
                '[[{"_key":"3527012","_id":"transactionHistory/3527012","_rev":"_dVnvweG---","TxTp":"pacs.008.001.10","FIToFICstmrCdt":{"GrpHdr":{"MsgId":"5e74d27d-02ce-4db3-8254-e0161b8258f6","CreDtTm":"2021-12-02T10:05:09.000Z","NbOfTxs":1,"SttlmInf":{"SttlmMtd":"CLRG"}},"CdtTrfTxInf":{"PmtId":{"InstrId":"fa2ed11e-7a2b-4fc6-a3b6-9338b6c0a503","EndToEndId":"5036fa4f-0cb1-442c-b1a8-be0a3ce66365"},"IntrBkSttlmAmt":{"Amt":{"Amt":74371.24,"Ccy":"USD"}},"InstdAmt":{"Amt":{"Amt":74371.24,"Ccy":"USD"}},"ChrgBr":"DEBT","ChrgsInf":{"Amt":{"Amt":736.35,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}}},"InitgPty":{"Nm":"HildaGlenGrant","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1929-06-02","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27765784647","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-765784647"}},"Dbtr":{"Nm":"HildaGlenGrant","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1929-06-02","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27765784647","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-765784647"}},"DbtrAcct":{"Id":{"Othr":{"Id":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954e90","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"HildaGrant"},"DbtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}},"CdtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}},"Cdtr":{"Nm":"FeliciaManfrey","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1965-07-04","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27827537492","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-827537492"}},"CdtrAcct":{"Id":{"Othr":{"Id":"+27827537492","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"FeliciaManfrey"},"Purp":{"Cd":"MP2P"}},"RgltryRptg":{"Dtls":{"Tp":"BALANCEOFPAYMENTS","Cd":"100"}},"RmtInf":{"Ustrd":"PaymentofUSD73634.89fromHildatoFelicia"},"SplmtryData":{"Envlp":{"Doc":{"Xprtn":"2021-12-02T10:10:05.000Z"}}}}}]]',
              ),
            );
          });
        });
      getDebtorPacs002EdgesSpy = jest
        .spyOn(databaseManager, 'getIncomingPacs002Edges')
        .mockImplementation((debtorId: string) => {
          return new Promise((resolve, reject) => {
            resolve([[]]);
          });
        });

      const expectedReq = getMockRequest();
      const res = await handleTransaction(expectedReq);
      expect(res).toEqual(
        JSON.parse(
          `{"id":"017@1.0.0","cfg":"1.0.0","desc": "${ruleDescriptionErrorMsg}","result":false,"subRuleRef":".00","reason":"No Transaction divergence detected on source account"}`,
        ),
      );
    });

    it('should respond with provided rule description', async () => {
      getRuleConfigSpy = jest
        .spyOn(databaseManager, 'getRuleConfig')
        .mockImplementation((ruleId: string) => {
          return new Promise((resolve, reject) => {
            const sRuleConfig = JSON.parse(
              `[[{"id":"002@1.0.0","cfg":"1.0.0"${ruleDescriptionField(
                'custom message',
              )},"config":{"timeframes":[{"threshold":86400000}],"bands":[{"subRuleRef":".01","lowerLimit":5,"outcome":true,"reason":"No Transaction divergence detected on source account"},{"subRuleRef":".00","upperLimit":5,"outcome":false,"reason":"No Transaction divergence detected on source account"}]}}]]`,
            );
            resolve(Object.assign(new Rule017Config(), sRuleConfig));
          });
        });

      getTransactionSpy = jest
        .spyOn(databaseManager, 'getTransactionPacs008')
        .mockImplementation(async (endToEndId: string) => {
          return new Promise((resolve, reject) => {
            resolve(
              JSON.parse(
                '[[{"_key":"3527012","_id":"transactionHistory/3527012","_rev":"_dVnvweG---","TxTp":"pacs.008.001.10","FIToFICstmrCdt":{"GrpHdr":{"MsgId":"5e74d27d-02ce-4db3-8254-e0161b8258f6","CreDtTm":"2021-12-02T10:05:09.000Z","NbOfTxs":1,"SttlmInf":{"SttlmMtd":"CLRG"}},"CdtTrfTxInf":{"PmtId":{"InstrId":"fa2ed11e-7a2b-4fc6-a3b6-9338b6c0a503","EndToEndId":"5036fa4f-0cb1-442c-b1a8-be0a3ce66365"},"IntrBkSttlmAmt":{"Amt":{"Amt":74371.24,"Ccy":"USD"}},"InstdAmt":{"Amt":{"Amt":74371.24,"Ccy":"USD"}},"ChrgBr":"DEBT","ChrgsInf":{"Amt":{"Amt":736.35,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}}},"InitgPty":{"Nm":"HildaGlenGrant","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1929-06-02","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27765784647","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-765784647"}},"Dbtr":{"Nm":"HildaGlenGrant","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1929-06-02","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27765784647","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-765784647"}},"DbtrAcct":{"Id":{"Othr":{"Id":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954e90","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"HildaGrant"},"DbtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}},"CdtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}},"Cdtr":{"Nm":"FeliciaManfrey","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1965-07-04","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27827537492","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-827537492"}},"CdtrAcct":{"Id":{"Othr":{"Id":"+27827537492","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"FeliciaManfrey"},"Purp":{"Cd":"MP2P"}},"RgltryRptg":{"Dtls":{"Tp":"BALANCEOFPAYMENTS","Cd":"100"}},"RmtInf":{"Ustrd":"PaymentofUSD73634.89fromHildatoFelicia"},"SplmtryData":{"Envlp":{"Doc":{"Xprtn":"2021-12-02T10:10:05.000Z"}}}}}]]',
              ),
            );
          });
        });
      getDebtorPacs002EdgesSpy = jest
        .spyOn(databaseManager, 'getIncomingPacs002Edges')
        .mockImplementation((debtorId: string) => {
          return new Promise((resolve, reject) => {
            resolve([[]]);
          });
        });

      const expectedReq = getMockRequest();
      const res = await handleTransaction(expectedReq);
      expect(res).toEqual(
        JSON.parse(
          `{"id":"017@1.0.0","cfg":"1.0.0","desc": "custom message","result":false,"subRuleRef":".00","reason":"No Transaction divergence detected on source account"}`,
        ),
      );
    });

    it('should respond with rule result of false, with no historical transactions', async () => {
      getRuleConfigSpy = jest
        .spyOn(databaseManager, 'getRuleConfig')
        .mockImplementation((ruleId: string) => {
          return new Promise((resolve, reject) => {
            const sRuleConfig = JSON.parse(
              `[[{"id":"002@1.0.0","cfg":"1.0.0"${ruleDescriptionField()},"config":{"timeframes":[{"threshold":86400000}],"bands":[{"subRuleRef":".01","lowerLimit":5,"outcome":true,"reason":"No Transaction divergence detected on source account"},{"subRuleRef":".00","upperLimit":5,"outcome":false,"reason":"No Transaction divergence detected on source account"}]}}]]`,
            );
            resolve(Object.assign(new Rule017Config(), sRuleConfig));
          });
        });

      getTransactionSpy = jest
        .spyOn(databaseManager, 'getTransactionPacs008')
        .mockImplementation(async (endToEndId: string) => {
          return new Promise((resolve, reject) => {
            resolve(
              JSON.parse(
                '[[{"_key":"3527012","_id":"transactionHistory/3527012","_rev":"_dVnvweG---","TxTp":"pacs.008.001.10","FIToFICstmrCdt":{"GrpHdr":{"MsgId":"5e74d27d-02ce-4db3-8254-e0161b8258f6","CreDtTm":"2021-12-02T10:05:09.000Z","NbOfTxs":1,"SttlmInf":{"SttlmMtd":"CLRG"}},"CdtTrfTxInf":{"PmtId":{"InstrId":"fa2ed11e-7a2b-4fc6-a3b6-9338b6c0a503","EndToEndId":"5036fa4f-0cb1-442c-b1a8-be0a3ce66365"},"IntrBkSttlmAmt":{"Amt":{"Amt":74371.24,"Ccy":"USD"}},"InstdAmt":{"Amt":{"Amt":74371.24,"Ccy":"USD"}},"ChrgBr":"DEBT","ChrgsInf":{"Amt":{"Amt":736.35,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}}},"InitgPty":{"Nm":"HildaGlenGrant","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1929-06-02","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27765784647","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-765784647"}},"Dbtr":{"Nm":"HildaGlenGrant","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1929-06-02","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27765784647","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-765784647"}},"DbtrAcct":{"Id":{"Othr":{"Id":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954e90","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"HildaGrant"},"DbtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}},"CdtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}},"Cdtr":{"Nm":"FeliciaManfrey","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1965-07-04","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27827537492","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-827537492"}},"CdtrAcct":{"Id":{"Othr":{"Id":"+27827537492","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"FeliciaManfrey"},"Purp":{"Cd":"MP2P"}},"RgltryRptg":{"Dtls":{"Tp":"BALANCEOFPAYMENTS","Cd":"100"}},"RmtInf":{"Ustrd":"PaymentofUSD73634.89fromHildatoFelicia"},"SplmtryData":{"Envlp":{"Doc":{"Xprtn":"2021-12-02T10:10:05.000Z"}}}}}]]',
              ),
            );
          });
        });
      getDebtorPacs002EdgesSpy = jest
        .spyOn(databaseManager, 'getIncomingPacs002Edges')
        .mockImplementation((debtorId: string) => {
          return new Promise((resolve, reject) => {
            resolve([[]]);
          });
        });

      const expectedReq = getMockRequest();
      const res = await handleTransaction(expectedReq);
      expect(res).toEqual(
        JSON.parse(
          `{"id":"017@1.0.0","cfg":"1.0.0","desc": "${ruleDescriptionErrorMsg}","result":false,"subRuleRef":".00","reason":"No Transaction divergence detected on source account"}`,
        ),
      );
    });

    it('should respond with rule result of false, with no historical transactions', async () => {
      getRuleConfigSpy = jest
        .spyOn(databaseManager, 'getRuleConfig')
        .mockImplementation((ruleId: string) => {
          return new Promise((resolve, reject) => {
            const sRuleConfig = JSON.parse(
              '[[{"id":"002@1.0.0","cfg":"1.0.0","config":{"timeframes":[{"threshold":86400000}],"bands":[{"subRuleRef":".01","lowerLimit":5,"outcome":true,"reason":"No Transaction divergence detected on source account"},{"subRuleRef":".00","upperLimit":5,"outcome":false,"reason":"No Transaction divergence detected on source account"}]}}]]',
            );
            resolve(Object.assign(new Rule017Config(), sRuleConfig));
          });
        });

      getTransactionSpy = jest
        .spyOn(databaseManager, 'getTransactionPacs008')
        .mockImplementation((endToEndId: string) => {
          return new Promise((resolve, reject) => {
            resolve([[]]);
          });
        });

      getDebtorPacs002EdgesSpy = jest
        .spyOn(databaseManager, 'getIncomingPacs002Edges')
        .mockImplementation(async (debtorId: string) => {
          return new Promise((resolve, reject) => {
            resolve(
              JSON.parse(
                '[[{"_key":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954e90","_from":"accounts/e2fa05b6a56ceedb37581703b98590b44194a8c0d2799f4319ebbece5e20ecc1","_to":"accounts/af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954e90","TxTp":"pacs.002.001.12","TxSts":"ACCC","CreDtTm": "2022-01-17T16:11:13.968Z","PmtInfId":"2f68ae16-467a-4ac4-ba32-eb518646aa1d","EndToEndId":"5cb8a2db-5c32-41bb-ac27-2597125d50fd"},{"_key":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954e","_from":"accounts/e2fa05b6a56ceedb37581703b98590b44194a8c0d2799f4319ebbece5e20ecc1","_to":"accounts/af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954e","TxTp":"pacs.002.001.12","TxSts":"ACCC","CreDtTm":"2022-01-17T16:11:13.968Z).toISOString()","PmtInfId":"2f68ae16-467a-4ac4-ba32-eb518646aa1d","EndToEndId":"5cb8a2db-5c32-41bb-ac27-2597125d50de"},{"_key":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954","_from":"accounts/e2fa05b6a56ceedb37581703b98590b44194a8c0d2799f4319ebbece5e20ecc1","_to":"accounts/af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab1954","TxTp":"pacs.002.001.12","TxSts":"ACCC","CreDtTm":"2022-01-16T22:13:13.968Z).toISOString()","PmtInfId":"2f68ae16-467a-4ac4-ba32-eb518646aa1d","EndToEndId":"5cb8a2db-5c32-41bb-ac27-2597125d50u4"},{"_key":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab195","_from":"accounts/e2fa05b6a56ceedb37581703b98590b44194a8c0d2799f4319ebbece5e20ecc1","_to":"accounts/af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab195","TxTp":"pacs.002.001.12","TxSts":"ACCC","CreDtTm":"2022-01-16T22:13:13.968Z","PmtInfId":"2f68ae16-467a-4ac4-ba32-eb518646aa1d","EndToEndId":"5cb8a2db-5c32-41bb-ac27-2597125d50vm"},{"_key":"af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab","_from":"accounts/e2fa05b6a56ceedb37581703b98590b44194a8c0d2799f4319ebbece5e20ecc1","_to":"accounts/af36cfd29dd05eb483358899055a552af93cd7ae36093832189e63dab","TxTp":"pacs.002.001.12","TxSts":"ACCC","CreDtTm":"2022-01-16T22:13:13.968Z).toISOString()","PmtInfId":"2f68ae16-467a-4ac4-ba32-eb518646aa1d","EndToEndId":"5cb8a2db-5c32-41bb-ac27-2597125d50ws"}]]',
              ),
            );
          });
        });

      const expectedReq = getMockRequest();
      const res = await handleTransaction(expectedReq);
      expect(res).toEqual(
        JSON.parse(
          `{"id":"017@1.0.0", "cfg": "1.0.0","desc":"${ruleDescriptionErrorMsg}","result":false,"subRuleRef":".00","reason":"No Transaction divergence detected on source account"}`,
        ),
      );
    });
  });
});
