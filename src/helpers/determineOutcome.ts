import { RuleConfig, RuleResult } from '@frmscoe/frms-coe-lib/lib/interfaces';

const determineOutcome = (
  value: number,
  ruleConfig: RuleConfig,
  ruleResult: RuleResult,
): RuleResult => {
  if (value || value === 0) {
    for (const band of ruleConfig.config.bands) {
      if (
        (!band.lowerLimit || value >= band.lowerLimit) &&
        (!band.upperLimit || value < band.upperLimit)
      ) {
        ruleResult.subRuleRef = band.subRuleRef;
        ruleResult.result = band.outcome;
        ruleResult.reason = band.reason;
        break;
      }
    }
  } else
    throw new Error(
      'Value provided undefined, so cannot determine rule outcome',
    );
  return ruleResult;
};

export default determineOutcome;
