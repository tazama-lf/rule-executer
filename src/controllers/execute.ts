import { Context } from 'koa';
import apm from 'elastic-apm-node';
import { handleTransaction } from 'rule/lib';
import { config } from '../config';
import axios from 'axios';
import determineOutcome from '../helpers/determineOutcome';
import { loggerService, databaseManager } from '..';
import {
  RuleResult,
  RuleRequest,
  RuleConfig,
} from '@frmscoe/frms-coe-lib/lib/interfaces';
import { unwrap } from '@frmscoe/frms-coe-lib/lib/helpers/unwrap';
import { getReadableDescription } from '@frmscoe/frms-coe-lib/lib/helpers/RuleConfig';
import { LoggerService } from '@frmscoe/frms-coe-lib';

export const execute = async (ctx: Context): Promise<void | Context> => {
  let request!: RuleRequest;
  loggerService.log('Start - Handle execute request');

  // Get required information from the incoming request
  try {
    const message = ctx.request.body ?? JSON.parse('');
    request = {
      transaction: message.transaction,
      networkMap: message.networkMap,
      DataCache: message.DataCache,
    };
  } catch (err) {
    const failMessage = 'Failed to parse execution request.';
    loggerService.error(failMessage, err, 'executeController');
    loggerService.log('End - Handle execute request');
    ctx.body = `${failMessage} Details: \r\n${err}`;
    ctx.status = 500;
    return ctx;
  }

  const hrTime = process.hrtime();

  let ruleRes: RuleResult = {
    id: `${config.ruleName}@${config.ruleVersion}`,
    cfg: '',
    result: false,
    subRuleRef: '.err',
    reason: 'Unhandled rule result outcome',
    desc: '',
    prcgTm: -1,
  };

  ruleRes.cfg = (() => {
    for (const messages of request.networkMap.messages) {
      for (const channels of messages.channels) {
        for (const typologies of channels.typologies) {
          for (const rule of typologies.rules) {
            if (rule.id === ruleRes.id) {
              return rule.cfg;
            }
          }
        }
      }
    }
    return '';
  })();

  let ruleConfig: RuleConfig | undefined;
  try {
    if (!ruleRes.cfg) throw new Error('Rule not found in network map');
    const sRuleConfig = await databaseManager.getRuleConfig(
      ruleRes.id,
      ruleRes.cfg,
    );
    ruleConfig = unwrap<RuleConfig>(sRuleConfig);
    if (!ruleConfig)
      throw new Error('Rule processor configuration not retrievable');
    ruleRes.desc = getReadableDescription(ruleConfig);
  } catch (error) {
    ruleRes.prcgTm = hrTime[0] * 1000 + hrTime[1] / 1000000;
    ruleRes = {
      ...ruleRes,
      subRuleRef: '.err',
      reason: (error as Error).message,
    };
    ctx.body = {
      ruleResult: ruleRes,
      transaction: request.transaction,
      networkSubMap: request.networkMap,
      DataCache: request.DataCache,
    };
    ctx.status = 500;
    await sendRuleResult(ruleRes, request, loggerService);
    return ctx;
  }
  let ruleResult: RuleResult = { ...ruleRes };
  const span = apm.startSpan('handleTransaction');
  try {
    ruleResult = await handleTransaction(
      request,
      determineOutcome,
      ruleRes,
      loggerService,
      ruleConfig,
      databaseManager,
    );
    span?.end();
    const resultMessage = `Result for Rule ${config.ruleName}@${config.ruleVersion}, is ${ruleResult.result}`;
    ctx.body = {
      message: resultMessage,
      ruleResult,
      transaction: request.transaction,
      networkSubMap: request.networkMap,
      DataCache: request.DataCache,
    };
    ctx.status = 200;
  } catch (error) {
    span?.end();
    const failMessage = 'Failed to process execution request.';
    loggerService.error(failMessage, error, 'executeController');
    ruleRes = {
      ...ruleRes,
      subRuleRef: '.err',
      reason: (error as Error).message,
    };
    ctx.body = {
      ruleResult: ruleRes,
      transaction: request.transaction,
      networkSubMap: request.networkMap,
      DataCache: request.DataCache,
    };
    ctx.status = 500;
  } finally {
    const endHrTime = hrTime[0] * 1000 + hrTime[1] / 1000000;
    ruleRes.prcgTm = endHrTime;
    ruleResult.prcgTm = endHrTime;
    loggerService.log('End - Handle execute request');
  }

  try {
    await sendRuleResult(ruleResult, request, loggerService);
  } catch (error) {
    const failMessage = 'Failed to send to Typology Processor.';
    loggerService.error(failMessage, error, 'executeController');
    ruleRes = {
      ...ruleRes,
      subRuleRef: '.err',
      reason: (error as Error).message,
      result: false,
    };
    ctx.body = {
      ruleResult: ruleRes,
      transaction: request.transaction,
      networkSubMap: request.networkMap,
      DataCache: request.DataCache,
    };
    ctx.status = 500;
  }

  return ctx;
};

const sendRuleResult = async (
  ruleResult: RuleResult,
  req: RuleRequest,
  loggerService: LoggerService,
) => {
  const toSend = {
    transaction: req.transaction,
    ruleResult,
    networkMap: req.networkMap,
    DataCache: req.DataCache,
  };
  for (const channel of req.networkMap.messages[0].channels) {
    for (const typology of channel.typologies) {
      if (typology.rules.some((rule) => rule.id === ruleResult.id)) {
        const typologyResponse = await axios.post(
          `${typology.host}/execute`,
          toSend,
        );
        if (typologyResponse.status !== 200) {
          loggerService.error(typologyResponse.data);
        }
        return;
      }
    }
  }
};
