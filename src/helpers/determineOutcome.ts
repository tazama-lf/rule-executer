import {
  Band,
  RuleConfig,
  RuleResult,
} from '@frmscoe/frms-coe-lib/lib/interfaces';

const determineOutcome = (
  value: number,
  ruleConfig: RuleConfig,
  ruleResult: RuleResult,
): RuleResult => {
  const { bands /*, parameters, case: ruleCase */ } = ruleConfig.config;

  if (value != null) {
    // branch on what you want to use to determine outcome (bands, params, case etc)
    if (bands) {
      ruleResult = withBands(bands, value, ruleResult);
    }
  } else
    throw new Error('Invalid value provided, so cannot determine rule outcome');
  return ruleResult;
};

const withBands = (bands: Band[], value: number, ruleResult: RuleResult) => {
  for (const band of bands) {
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
  return ruleResult;
};

export default determineOutcome;
