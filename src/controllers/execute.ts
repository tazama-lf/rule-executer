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
import { responseCallback } from '@frmscoe/frms-coe-startup-lib/lib/types/onMessageFunction';

export const execute = async (
  reqObj: unknown,
  handleResponse: responseCallback,
): Promise<void> => {
  let request!: RuleRequest;
  let dataCache: DataCache;
  const responseSubject = `RuleResponse${config.ruleName}`;
  loggerService.log('Start - Handle execute request');

  // Get required information from the incoming request
  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const message = reqObj as any; // JSON.parse(reqObj);
    request = {
      transaction: message.transaction,
      networkMap: message.networkMap,
    };
    dataCache = message.DataCache;
  } catch (err) {
    const failMessage = 'Failed to parse execution request.';
    loggerService.error(failMessage, err, 'executeController');
    loggerService.log('End - Handle execute request');
    return;
  }

  let ruleRes: RuleResult = {
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
    ruleRes = {
      ...ruleRes,
      subRuleRef: '.err',
      reason: (error as Error).message,
    };
    await handleResponse(
      JSON.stringify({
        transaction: request.transaction,
        ruleRes,
        networkMap: request.networkMap,
      }),
      [responseSubject],
    );
    return;
  }
  let ruleResult: RuleResult = { ...ruleRes };
  const span = apm.startSpan('handleTransaction');
  try {
    ruleResult = await handleTransaction(
      request,
      determineOutcome,
      ruleRes,
      loggerService,
      ruleConfig!,
      databaseManager,
      dataCache,
    );
    span?.end();
  } catch (error) {
    span?.end();
    const failMessage = 'Failed to process execution request.';
    loggerService.error(failMessage, error, 'executeController');
    ruleRes = {
      ...ruleRes,
      subRuleRef: '.err',
      reason: (error as Error).message,
    };
  } finally {
    loggerService.log('End - Handle execute request');
  }

  try {
    await handleResponse(
      JSON.stringify({
        transaction: request.transaction,
        ruleResult,
        networkMap: request.networkMap,
      }),
      [responseSubject],
    );
    // await sendRuleResult(ruleResult, request, loggerService);
  } catch (error) {
    const failMessage = 'Failed to send to Typology Processor.';
    loggerService.error(failMessage, error, 'executeController');
    ruleRes = {
      ...ruleRes,
      subRuleRef: '.err',
      reason: (error as Error).message,
      result: false,
    };
  }
};
