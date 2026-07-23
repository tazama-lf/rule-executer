// SPDX-License-Identifier: Apache-2.0
import type { RuleConfig, RuleResult } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import { loggerService } from '..';

const determineOutcome = (value: number, ruleConfig: RuleConfig, ruleResult: RuleResult): RuleResult => {
  const res = ruleResult;
  res.indpdntVarbl = value;
  if (ruleConfig.config.bands && ruleConfig.config.cases) {
    const reason = 'Rule processor configuration invalid';
    loggerService.error(reason);
    return {
      ...res,
      reason,
    };
  }

  const { bands } = ruleConfig.config;
  if (bands && (value || value === 0)) {
    for (const band of bands) {
      if ((!band.lowerLimit || value >= band.lowerLimit) && (!band.upperLimit || value < band.upperLimit)) {
        res.subRuleRef = band.subRuleRef;
        res.reason = band.reason;
        break;
      }
    }
  } else {
    throw new Error('Value provided undefined, so cannot determine rule outcome');
  }
  return res;
};

export default determineOutcome;
