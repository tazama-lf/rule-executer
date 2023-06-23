import { Context } from 'koa';
// import { LoggerService } from '../services/logger.service';
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
  DataCache,
} from '@frmscoe/frms-coe-lib/lib/interfaces';
import { unwrap } from '@frmscoe/frms-coe-lib/lib/helpers/unwrap';
import { getReadableDescription } from '@frmscoe/frms-coe-lib/lib/helpers/RuleConfig';
import { LoggerService } from '@frmscoe/frms-coe-lib';

export const execute = async (ctx: Context): Promise<void | Context> => {
  let request!: RuleRequest;
  let dataCache: DataCache;
  loggerService.log('Start - Handle execute request');

  // Get required information from the incoming request
  try {
    const message = ctx.request.body ?? JSON.parse('');
    request = {
      transaction: message.transaction,
      networkMap: message.networkMap,
    };
    dataCache = message.DataCache;
  } catch (err) {
    const failMessage = 'Failed to parse execution request.';
    loggerService.error(failMessage, err, 'executeController');
    loggerService.log('End - Handle execute request');
    ctx.body = `${failMessage} Details: \r\n${err}`;
    ctx.status = 500;
    return ctx;
  }

  const ruleRes: RuleResult = {
    id: `${config.ruleName}@${config.ruleVersion}`,
    cfg: '',
    result: false,
    subRuleRef: '.err',
    reason: 'Unhandled rule result outcome',
    desc: '',
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

  const sRuleConfig = await databaseManager.getRuleConfig(
    ruleRes.id,
    ruleRes.cfg,
  );

  const ruleConfig = unwrap<RuleConfig>(sRuleConfig);

  if (!ruleConfig) {
    ctx.body = {
      ruleResult: {
        ...ruleRes,
        reason: 'Rule processor configuration not retrievable',
      },
      transaction: request.transaction,
      networkSubMap: request.networkMap,
    };
    ctx.status = 500;
    return ctx;
  }

  ruleRes.desc = getReadableDescription(ruleConfig);

  try {
    const span = apm.startSpan('handleTransaction');
    const ruleResult = await handleTransaction(
      request,
      determineOutcome,
      ruleRes,
      loggerService,
      ruleConfig,
      databaseManager,
      dataCache,
    );
    span?.end();
    await sendRuleResult(ruleResult, request, loggerService);
    const resultMessage = `Result for Rule ${config.ruleName}@${config.ruleVersion}, is ${ruleResult.result}`;
    ctx.body = {
      message: resultMessage,
      ruleResult,
      transaction: request.transaction,
      networkSubMap: request.networkMap,
    };
    ctx.status = 200;
    return ctx;
  } catch (err) {
    const failMessage = 'Failed to process execution request.';
    loggerService.error(failMessage, err, 'executeController');
    ctx.body = `${failMessage} Details: \r\n${err}`;
    ctx.status = 500;
    return ctx;
  } finally {
    loggerService.log('End - Handle execute request');
  }
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
