// SPDX-License-Identifier: Apache-2.0
import apm from '../apm';
import type { RuleConfig, RuleRequest, RuleResult } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import type { MetaData } from '@tazama-lf/frms-coe-lib/lib/interfaces/metaData';
import * as util from 'node:util';
import { handleTransaction } from '../rule/rule';
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
  loggerService.log('[L16] Function entry - Starting execute request handler', context, configuration.functionName);
  const startTime = process.hrtime.bigint();

  // Get required information from the incoming request
  loggerService.log('[L22] Starting request parsing and validation', context, configuration.functionName);
  try {
    const message = reqObj as RuleRequest & { metaData: MetaData | undefined };

    if (!('transaction' in message)) throw new Error('Missing in request: transaction');
    if (!('networkMap' in message)) throw new Error('Missing in request: networkMap');
    if (!('DataCache' in message)) throw new Error('Missing in request: DataCache');

    loggerService.log(`[L32] Request transaction data: ${JSON.stringify(message.transaction)}`, context, configuration.functionName);

    request = {
      transaction: message.transaction,
      networkMap: message.networkMap,
      DataCache: message.DataCache,
      metaData: message.metaData,
    };
    traceParent = request.metaData?.traceParent ?? undefined;
    loggerService.log('[L35] Request parsing completed successfully', context, configuration.functionName);
  } catch (err) {
    const failMessage = '[L38] Failed to parse execution request.';
    loggerService.error(failMessage, err, context, configuration.functionName);
    loggerService.log('[L40] Early exit due to request parsing failure', context, configuration.functionName);
    return;
  }
  const apmTransaction = apm.startTransaction(`rule.process.${configuration.RULE_NAME}`, {
    childOf: traceParent,
  });
  loggerService.log('[L45] APM transaction started', context, configuration.functionName);

  loggerService.log('[L48] Initializing rule result object', context, configuration.functionName);
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
  loggerService.log('[L60] Searching for rule configuration in network map', context, configuration.functionName);

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
  loggerService.log('[L73] Starting database rule configuration retrieval', context, configuration.functionName);
  const spanRuleConfig = apm.startSpan(`db.get.ruleconfig.${ruleRes.id}`);
  try {
    if (!ruleRes.cfg) throw new Error('Rule not found in network map');
    loggerService.log(`[L77] Transaction data: ${JSON.stringify(request.transaction)}`, context, configuration.functionName);
    ruleConfig = await databaseManager.getRuleConfig(ruleRes.id, ruleRes.cfg, request.transaction.TenantId);
    loggerService.log('[L79] Rule configuration retrieved successfully from database', context, configuration.functionName);
    spanRuleConfig?.end();
    if (!ruleConfig?.config) {
      throw new Error('Rule processor configuration not retrievable');
    }
    loggerService.log('[L83] Rule configuration validation passed', context, configuration.functionName);
  } catch (error) {
    spanRuleConfig?.end();
    loggerService.error('[L85] Error while getting rule configuration', util.inspect(error), context, configuration.functionName);
    ruleRes.prcgTm = calculateDuration(startTime);
    ruleRes = {
      ...ruleRes,
      subRuleRef: '.err',
      reason: (error as Error).message,
    };
    loggerService.log('[L92] Sending error response due to config retrieval failure', context, configuration.functionName);
    const spanHandleResponse = apm.startSpan(`handleResponse.${ruleRes.id}.err`);
    await server.handleResponse({
      transaction: request.transaction,
      ruleResult: ruleRes,
      networkMap: request.networkMap,
    });
    spanHandleResponse?.end();
    loggerService.log('[L99] Error response sent, exiting function', context, configuration.functionName);
    return;
  }

  loggerService.log('[L103] Starting rule logic execution', context, configuration.functionName);
  const span = apm.startSpan(`rule.${ruleRes.id}.findResult`);
  try {
    loggerService.trace('[L106] Executing rule logic with transaction data', context);

    ruleRes = await handleTransaction(request, determineOutcome, ruleRes, loggerService, ruleConfig, databaseManager as any);
    loggerService.log('[L109] Rule logic execution completed successfully', context, configuration.functionName);

    span?.end();
  } catch (error) {
    span?.end();
    const failMessage = '[L112] Failed to process execution request.';
    loggerService.error(failMessage, error, context, configuration.functionName);
    ruleRes = {
      ...ruleRes,
      subRuleRef: '.err',
      reason: (error as Error).message,
    };
  } finally {
    ruleRes.prcgTm = calculateDuration(startTime);
    loggerService.log('[L120] Rule execution phase completed, duration calculated', context, configuration.functionName);
  }

  loggerService.log('[L124] Starting response handling to Typology Processor', context, configuration.functionName);
  const spanResponse = apm.startSpan(`send.to.typroc.${ruleRes.id}`);
  try {
    if (request.metaData) {
      request.metaData.traceParent = apm.getCurrentTraceparent();
      loggerService.log('[L128] Updated trace parent in metadata', context, configuration.functionName);
    }
    // happy path, we don't need reason
    if (ruleRes.reason) {
      loggerService.log(ruleRes.reason, context);
    }
    if (ruleRes.subRuleRef !== '.err') {
      // happy path, we don't need reason
      delete ruleRes.reason;
      loggerService.log('[L137] Success path - reason removed from response', context, configuration.functionName);
    }

    loggerService.log('[L140] Sending final response to Typology Processor', context, configuration.functionName);
    await server.handleResponse({
      ...request,
      ruleResult: ruleRes,
    });
    loggerService.log('[L144] Response sent successfully', context, configuration.functionName);
  } catch (error) {
    const failMessage = '[L146] Failed to send to Typology Processor.';
    loggerService.error(failMessage, error, context, configuration.functionName);
  } finally {
    spanResponse?.end();
    loggerService.log('[L150] Response handling completed', context, configuration.functionName);
  }
  loggerService.log('[L152] Function execution completed, ending APM transaction', context, configuration.functionName);
  apmTransaction?.end();
};
