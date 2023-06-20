import { RuleConfig, RuleResult } from '@frmscoe/frms-coe-lib/lib/interfaces';

const determineOutcome = (
  value: number,
  ruleConfig: RuleConfig,
  ruleResult: RuleResult,
): RuleResult => {
  const threshold = ruleConfig.config.timeframes[0].threshold;

  const trueSubRule = ruleConfig.config.bands.find((r) => r.outcome === true);
  const falseSubRule = ruleConfig.config.bands.find((r) => r.outcome === false);

  if (!trueSubRule?.lowerLimit) return ruleResult;
  if (!falseSubRule?.upperLimit) return ruleResult;

  if (value && value > 0) {
    if (trueSubRule && value >= trueSubRule.lowerLimit) {
      ruleResult.result = trueSubRule.outcome;
      ruleResult.reason = trueSubRule.reason;
      ruleResult.subRuleRef = trueSubRule.subRuleRef;
    } else if (falseSubRule && value < falseSubRule.upperLimit) {
      ruleResult.result = falseSubRule.outcome;
      ruleResult.reason = falseSubRule.reason;
      ruleResult.subRuleRef = falseSubRule.subRuleRef;
    }
  } else if (falseSubRule) {
    ruleResult.result = falseSubRule.outcome;
    ruleResult.reason = falseSubRule.reason;
    ruleResult.subRuleRef = falseSubRule.subRuleRef;
  }
  return ruleResult;
};

export default determineOutcome;
