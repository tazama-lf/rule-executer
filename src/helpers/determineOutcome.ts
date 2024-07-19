// SPDX-License-Identifier: Apache-2.0
import {
  type RuleConfig,
  type RuleResult,
} from '@frmscoe/frms-coe-lib/lib/interfaces';
import { loggerService } from '..';

const determineOutcome = (
  value: number,
  ruleConfig: RuleConfig,
  ruleResult: RuleResult,
): RuleResult => {
  if (ruleConfig.config.bands && ruleConfig.config.case) {
    const reason = 'Rule processor configuration invalid';
    loggerService.error(reason);
    return {
      ...ruleResult,
      reason,
    };
  }

  const bands = ruleConfig.config.bands;
  if (bands && (value || value === 0)) {
    for (const band of bands) {
      if (
        (!band.lowerLimit || value >= band.lowerLimit) &&
        (!band.upperLimit || value < band.upperLimit)
      ) {
        ruleResult.subRuleRef = band.subRuleRef;
        ruleResult.reason = band.reason;
        break;
      }
    }
  } else {
    throw new Error(
      'Value provided undefined, so cannot determine rule outcome',
    );
  }
  return ruleResult;
};

export default determineOutcome;
