// SPDX-License-Identifier: Apache-2.0
import { checkRuleIdentity } from '../../src/helpers/checkRuleIdentity';

describe('checkRuleIdentity', () => {
  const expectedRuleName = '901';
  let logWarn: jest.Mock;

  beforeEach(() => {
    logWarn = jest.fn();
  });

  it('should log a warning and continue when rule module does not export RULE_ID', () => {
    const ruleModule = { handleTransaction: jest.fn() };

    expect(() => checkRuleIdentity(ruleModule, expectedRuleName, logWarn)).not.toThrow();
    expect(logWarn).toHaveBeenCalledWith('Rule module does not export RULE_ID - identity verification skipped');
  });

  it('should not throw or warn when RULE_ID matches expectedRuleName', () => {
    const ruleModule = { RULE_ID: '901', handleTransaction: jest.fn() };

    expect(() => checkRuleIdentity(ruleModule, expectedRuleName, logWarn)).not.toThrow();
    expect(logWarn).not.toHaveBeenCalled();
  });

  it('should throw when RULE_ID does not match expectedRuleName', () => {
    const ruleModule = { RULE_ID: '002', handleTransaction: jest.fn() };

    expect(() => checkRuleIdentity(ruleModule, expectedRuleName, logWarn)).toThrow(
      'Rule module identity mismatch: container expects "901" but loaded module identifies as "002"',
    );
    expect(logWarn).not.toHaveBeenCalled();
  });

  it('should warn and skip if RULE_ID is not a string', () => {
    // Defensive: if someone sets RULE_ID to a number, treat it as missing
    const ruleModule = { RULE_ID: 901 as unknown as string };

    expect(() => checkRuleIdentity(ruleModule, expectedRuleName, logWarn)).not.toThrow();
    expect(logWarn).toHaveBeenCalledWith('Rule module RULE_ID is not a string - identity verification skipped');
  });
});
