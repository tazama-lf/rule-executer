// SPDX-License-Identifier: Apache-2.0
import apm from '../apm';
import type { RuleConfig, RuleRequest, RuleResult } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import type { MetaData } from '@tazama-lf/frms-coe-lib/lib/interfaces/metaData';
import * as util from 'node:util';
import { handleTransaction } from 'rule/lib';
import { databaseManager, loggerService, server } from '..';
import { configuration } from '../';
import determineOutcome from '../helpers/determineOutcome';

const calculateDuration = (startTime: bigint): number => {
  const endTime: bigint = process.hrtime.bigint();
  return Number(endTime - startTime);
};

export const execute = async (reqObj: unknown): Promise<void> => {
  let request;
  let traceParent: string | undefined;
  let context = `Rule-${configuration.RULE_NAME} execute()`;
  loggerService.log('Start - Handle execute request', context, configuration.functionName);
  const startTime = process.hrtime.bigint();

  // Get required information from the incoming request
  try {
    const message = reqObj as RuleRequest & { metaData: MetaData | undefined };

    if (!('transaction' in message)) throw new Error('Missing in request: transaction');
    if (!('networkMap' in message)) throw new Error('Missing in request: networkMap');
    if (!('DataCache' in message)) throw new Error('Missing in request: DataCache');

    request = {
      transaction: message.transaction,
      networkMap: message.networkMap,
      DataCache: message.DataCache,
      metaData: message.metaData,
    };
    traceParent = request.metaData?.traceParent ?? undefined;
  } catch (err) {
    const failMessage = 'Failed to parse execution request.';
    loggerService.error(failMessage, err, context, configuration.functionName);
    loggerService.log('End - Handle execute request', context, configuration.functionName);
    return;
  }
  const apmTransaction = apm.startTransaction(`rule.process.${configuration.RULE_NAME}`, {
    childOf: traceParent,
  });

  let ruleRes: RuleResult = {
    id: `${configuration.RULE_NAME}@${configuration.RULE_VERSION}`,
    tenantId: request.transaction.TenantId,
    cfg: '',
    subRuleRef: '.err',
    reason: 'Unhandled rule result outcome',
    prcgTm: -1,
    indpdntVarbl: 0,
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
    ruleConfig = await databaseManager.getRuleConfig(ruleRes.id, ruleRes.cfg, request.transaction.TenantId);
    spanRuleConfig?.end();
    if (!ruleConfig?.config) {
      throw new Error('Rule processor configuration not retrievable');
    }
  } catch (error) {
    spanRuleConfig?.end();
    loggerService.error('Error while getting rule configuration', util.inspect(error), context, configuration.functionName);
    ruleRes.prcgTm = calculateDuration(startTime);
    ruleRes = {
      ...ruleRes,
      subRuleRef: '.err',
      reason: (error as Error).message,
    };
    const spanHandleResponse = apm.startSpan(`handleResponse.${ruleRes.id}.err`);
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

    ruleRes = await handleTransaction(request, determineOutcome, ruleRes, loggerService, ruleConfig, databaseManager);

    span?.end();
  } catch (error) {
    span?.end();
    const failMessage = 'Failed to process execution request.';
    loggerService.error(failMessage, error, context, configuration.functionName);
    ruleRes = {
      ...ruleRes,
      subRuleRef: '.err',
      reason: (error as Error).message,
    };
  } finally {
    ruleRes.prcgTm = calculateDuration(startTime);
    loggerService.log('End - Handle execute request', context, configuration.functionName);
  }

  const spanResponse = apm.startSpan(`send.to.typroc.${ruleRes.id}`);
  try {
    if (request.metaData) {
      request.metaData.traceParent = apm.getCurrentTraceparent();
    }
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
    loggerService.error(failMessage, error, context, configuration.functionName);
  } finally {
    spanResponse?.end();
  }
  apmTransaction?.end();
};
