// SPDX-License-Identifier: Apache-2.0
import { unwrap } from '@tazama-lf/frms-coe-lib/lib/helpers/unwrap';
import {
  type NetworkMap,
  type RuleConfig,
  type RuleResult,
} from '@tazama-lf/frms-coe-lib/lib/interfaces';
import apm from '../apm';
import { handleTransaction } from 'rule/lib';
import { databaseManager, loggerService, server } from '..';
import { config } from '../config';
import determineOutcome from '../helpers/determineOutcome';

const calculateDuration = (startTime: bigint): number => {
  const endTime: bigint = process.hrtime.bigint();
  return Number(endTime - startTime);
};

export const execute = async (reqObj: unknown): Promise<void> => {
  let request;
  let traceParent = '';
  let context = `Rule-${config.ruleName} execute()`;
  loggerService.log(
    'Start - Handle execute request',
    context,
    config.functionName,
  );
  const startTime = process.hrtime.bigint();

  // Get required information from the incoming request
  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const message = reqObj as any;
    request = {
      transaction: message.transaction,
      networkMap: message.networkMap as NetworkMap,
      DataCache: message.DataCache,
      metaData: message?.metaData,
    };
    traceParent = request.metaData?.traceParent;
  } catch (err) {
    const failMessage = 'Failed to parse execution request.';
    loggerService.error(failMessage, err, context, config.functionName);
    loggerService.log(
      'End - Handle execute request',
      context,
      config.functionName,
    );
    return;
  }
  const apmTransaction = apm.startTransaction(
    `rule.process.${config.ruleName}`,
    {
      childOf: traceParent,
    },
  );

  let ruleRes: RuleResult = {
    id: `${config.ruleName}@${config.ruleVersion}`,
    cfg: '',
    subRuleRef: '.err',
    reason: 'Unhandled rule result outcome',
    prcgTm: -1,
  };

  context = ruleRes.id;

  ruleRes.cfg = (() => {
    for (const messages of request.networkMap.messages) {
      for (const typologies of messages.typologies) {
        for (const rule of typologies.rules) {
          if (rule.id === ruleRes.id) {
            return rule.cfg;
          }
        }
      }
    }
    return '';
  })();

  let ruleConfig: RuleConfig | undefined;
  const spanRuleConfig = apm.startSpan(`db.get.ruleconfig.${ruleRes.id}`);
  try {
    if (!ruleRes.cfg) throw new Error('Rule not found in network map');
    const sRuleConfig = await databaseManager.getRuleConfig(
      ruleRes.id,
      ruleRes.cfg,
    );
    spanRuleConfig?.end();
    ruleConfig = unwrap<RuleConfig>(sRuleConfig as RuleConfig[][]);
    if (!ruleConfig) {
      throw new Error('Rule processor configuration not retrievable');
    }
  } catch (error) {
    spanRuleConfig?.end();
    loggerService.error(
      'Error while getting rule configuration',
      error,
      context,
      config.functionName,
    );
    ruleRes.prcgTm = calculateDuration(startTime);
    ruleRes = {
      ...ruleRes,
      subRuleRef: '.err',
      reason: (error as Error).message,
    };
    const spanHandleResponse = apm.startSpan(
      `handleResponse.${ruleRes.id}.err`,
    );
    await server.handleResponse({
      transaction: request.transaction,
      ruleResult: ruleRes,
      networkMap: request.networkMap,
    });
    spanHandleResponse?.end();
    return;
  }

  const span = apm.startSpan(`rule.${ruleRes.id}.findResult`);
  try {
    loggerService.trace('Execute rule logic', context);
    ruleRes = await handleTransaction(
      request,
      determineOutcome,
      ruleRes,
      loggerService,
      ruleConfig,
      databaseManager,
    );

    span?.end();
  } catch (error) {
    span?.end();
    const failMessage = 'Failed to process execution request.';
    loggerService.error(failMessage, error, context, config.functionName);
    ruleRes = {
      ...ruleRes,
      subRuleRef: '.err',
      reason: (error as Error).message,
    };
  } finally {
    ruleRes.prcgTm = calculateDuration(startTime);
    loggerService.log(
      'End - Handle execute request',
      context,
      config.functionName,
    );
  }

  const spanResponse = apm.startSpan(`send.to.typroc.${ruleRes.id}`);
  try {
    request.metaData.traceParent = apm.getCurrentTraceparent();
    // happy path, we don't need reason
    if (ruleRes.reason) {
      loggerService.log(ruleRes.reason, context);
    }
    if (ruleRes.subRuleRef !== '.err') {
      // happy path, we don't need reason
      delete ruleRes.reason;
    }

    await server.handleResponse({
      ...request,
      ruleResult: ruleRes,
    });
  } catch (error) {
    const failMessage = 'Failed to send to Typology Processor.';
    loggerService.error(failMessage, error, context, config.functionName);
    ruleRes = {
      ...ruleRes,
      subRuleRef: '.err',
      reason: (error as Error).message,
    };
  } finally {
    spanResponse?.end();
  }
  apmTransaction?.end();
};
