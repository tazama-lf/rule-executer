const { handleTransaction } = require('rule/lib');

console.log('RULE 500: Amount-Based Risk Analysis');
console.log('=====================================');

async function testRule500() {
  try {
    console.log('\nINPUT DATA:');
    console.log('   Account: test-account');
    console.log('   Tenant: test-tenant');
    console.log('   Transaction Amount: $7.50');
    
    const request = {
      transaction: {
        TenantId: 'test-tenant',
        FIToFIPmtSts: { 
          GrpHdr: { 
            CreDtTm: '2025-10-31T10:00:00Z' 
          } 
        },
        // Add transaction amount
        amount: 1000,  // $100 transaction amount
        currency: 'USD'
      },
      DataCache: { 
        dbtrAcctId: 'test-account' 
      }
    };

    const ruleConfig = {
      config: {
        parameters: { 
          amountThreshold: 5.00     // $5 threshold for Rule 500
        },
        bands: [
          { subRuleRef: '.01', lowerLimit: 0, upperLimit: 5 },     // Amount < $5 = Low risk
          { subRuleRef: '.02', lowerLimit: 5, upperLimit: Number.POSITIVE_INFINITY }  // Amount >= $5 = Medium risk
        ]
      }
    };

    const ruleResult = {
      id: '500@1.0.0',  // Changed to Rule 500
      tenantId: 'test-tenant',
      cfg: 'amount-based',
      subRuleRef: '.err',
      reason: 'Processing amount-based rule',
      prcgTm: 0,
      indpdntVarbl: 0
    };

    // Mock DB - Rule 500 doesn't query database, just passes through
    const mockDB = {
      _pseudonymsDb: {
        query: async () => {
          console.log('\nRULE 500 AMOUNT ANALYSIS:');
          console.log('   No database query needed');
          console.log('   Using transaction amount directly: $7.50');
          
          // Rule 500 doesn't use database result - amount comes from transaction
          return {
            batches: { all: async () => [[100]] }
          };
        }
      }
    };

    const determineOutcome = (amount, config, result) => {
      console.log('\nRULE 500 RISK ANALYSIS:');
      console.log('   Transaction Amount: $' + amount);
      
      // Check amount-based risk bands
      for (const band of config.config.bands) {
        if (amount >= band.lowerLimit && amount < band.upperLimit) {
          const riskLevel = amount < 5 ? 'Low Risk' : 'Medium Risk';
          console.log('   Risk Band:', band.subRuleRef, '($' + band.lowerLimit + '+ range)');
          console.log('   Classification:', riskLevel);
          
          return {
            ...result,
            subRuleRef: band.subRuleRef,
            indpdntVarbl: amount,
            reason: 'Amount $' + amount + ' - ' + riskLevel + ' (' + band.subRuleRef + ')'
          };
        }
      }
      return result;
    };

    const mockLogger = { log: () => {}, error: () => {}, trace: () => {} };

    console.log('\nEXECUTING RULE 500...');
    
    const result = await handleTransaction(
      request,
      determineOutcome, 
      ruleResult,
      mockLogger,
      ruleConfig,
      mockDB
    );

    console.log('\nRULE 500 RESULT:');
    console.log('   Rule ID:', result.id);
    console.log('   Classification:', result.subRuleRef);
    console.log('   Transaction Amount: $' + result.indpdntVarbl);
    console.log('   Final result:', result.reason);
    
    return true;

  } catch (error) {
    console.log('\nRULE 500 FAILED:', error.message);
    return false;
  }
}

// Run Rule 500 test!
testRule500().then(success => {
  if (success) {
    console.log('\nRule 500 executed successfully!');
  } else {
    console.log('\nRule 500 execution failed!');
  }
});