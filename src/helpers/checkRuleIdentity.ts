// SPDX-License-Identifier: Apache-2.0

/**
 * Verifies that the installed rule module's self-declared identity matches the
 * identity expected by this container (derived from RULE_NAME).
 *
 * - If the rule module does not export RULE_ID, a warning is logged and startup
 *   continues (backwards compatible with rule modules that predate this feature).
 * - If the rule module exports RULE_ID but it does not match expectedRuleName,
 *   an error is thrown and startup is aborted.
 */
export const checkRuleIdentity = (
  ruleModule: Record<string, unknown>,
  expectedRuleName: string,
  logWarn: (message: string) => void,
): void => {
  const moduleRuleId = 'RULE_ID' in ruleModule ? String(ruleModule.RULE_ID) : undefined;

  if (!moduleRuleId) {
    logWarn('Rule module does not export RULE_ID - identity verification skipped');
    return;
  }

  if (moduleRuleId !== expectedRuleName) {
    throw new Error(
      `Rule module identity mismatch: container expects "${expectedRuleName}" but loaded module identifies as "${moduleRuleId}"`,
    );
  }
};
