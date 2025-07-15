/**
 * Enterprise Bridge API Validation Suite
 * Quality Persona + Comprehensive Backend Testing
 */

// Use built-in fetch for Node.js 18+
const fetch = globalThis.fetch || require('node-fetch');
const fs = require('fs');
const path = require('path');

async function validateEnterpriseAPIs() {
    console.log('🚀 ENTERPRISE BRIDGE API VALIDATION SUITE');
    console.log('🔍 Quality Persona: Comprehensive Backend Testing');
    console.log('🎯 Mission: Validate Enterprise Foundation + Individual Client APIs');
    console.log('');

    const baseUrl = 'http://localhost:3001';
    const testResults = {
        timestamp: new Date().toISOString(),
        tests: [],
        performance: [],
        errors: [],
        summary: {}
    };

    // Helper function for API testing
    async function testAPI(method, endpoint, data = null, expectedStatus = 200) {
        const startTime = Date.now();
        try {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' }
            };
            
            if (data) {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(`${baseUrl}${endpoint}`, options);
            const responseData = await response.json();
            const responseTime = Date.now() - startTime;

            const result = {
                endpoint,
                method,
                status: response.status,
                expectedStatus,
                responseTime,
                success: response.status === expectedStatus,
                data: responseData,
                timestamp: new Date().toISOString()
            };

            testResults.tests.push(result);
            testResults.performance.push(responseTime);

            if (!result.success) {
                testResults.errors.push(result);
            }

            return result;
        } catch (error) {
            const errorResult = {
                endpoint,
                method,
                error: error.message,
                responseTime: Date.now() - startTime,
                success: false,
                timestamp: new Date().toISOString()
            };
            
            testResults.tests.push(errorResult);
            testResults.errors.push(errorResult);
            return errorResult;
        }
    }

    console.log('📋 TEST SUITE 1: ENTERPRISE FOUNDATION VALIDATION');
    console.log('=================================================');

    // Test 1: Health Check - Enterprise Architecture
    console.log('1. 🏥 Testing Enterprise Health Check...');
    const healthResult = await testAPI('GET', '/api/health');
    
    if (healthResult.success) {
        console.log('✅ Enterprise Health: PASSED');
        console.log(`   📋 Architecture: ${healthResult.data.architecture}`);
        console.log(`   🔧 Version: ${healthResult.data.version}`);
        console.log(`   🏢 Formance Status: ${healthResult.data.formance?.status}`);
        console.log(`   ⚡ Response Time: ${healthResult.responseTime}ms`);
        
        // Validate enterprise indicators
        if (healthResult.data.features?.includes('FormanceLedgerService Ready')) {
            console.log('✅ FormanceLedgerService Integration: READY');
        }
        if (healthResult.data.architecture?.includes('TypeScript')) {
            console.log('✅ TypeScript Enterprise Foundation: CONFIRMED');
        }
    } else {
        console.log('❌ Enterprise Health: FAILED');
    }

    console.log('');
    console.log('📋 TEST SUITE 2: INDIVIDUAL CLIENT AUTHENTICATION');
    console.log('==================================================');

    // Test 2: Enterprise Registration for Individual Clients
    console.log('2. 👤 Testing Individual Client Registration...');
    const registrationData = {
        email: 'test.individual@dway.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'Individual'
    };

    const regResult = await testAPI('POST', '/api/auth/signup', registrationData, 201);
    
    if (regResult.success) {
        console.log('✅ Individual Registration: SUCCESSFUL');
        console.log(`   👤 User ID: ${regResult.data.user?.id}`);
        console.log(`   🏢 Account Address: ${regResult.data.user?.accountAddress}`);
        console.log(`   🎯 Account Type: ${regResult.data.user?.accountType}`);
        console.log(`   ⚡ Response Time: ${regResult.responseTime}ms`);
        
        // Validate enterprise account patterns
        if (regResult.data.user?.accountAddress?.startsWith('users:')) {
            console.log('✅ FormanceLedgerService Account Pattern: CONFIRMED');
        }
        if (regResult.data.user?.features?.includes('Family sub-accounts')) {
            console.log('✅ Individual Client Features: AVAILABLE');
        }
    } else {
        console.log('❌ Individual Registration: FAILED');
        console.log(`   Error: ${regResult.data?.error || 'Unknown error'}`);
    }

    // Test 3: Enterprise Sign-in
    console.log('3. 🔐 Testing Individual Client Sign-in...');
    const signinData = {
        email: 'test.individual@dway.com',
        password: 'SecurePass123!'
    };

    const signinResult = await testAPI('POST', '/api/auth/signin', signinData, 200);
    
    if (signinResult.success) {
        console.log('✅ Individual Sign-in: SUCCESSFUL');
        console.log(`   👤 Account Address: ${signinResult.data.user?.accountAddress}`);
        console.log(`   ⚡ Response Time: ${signinResult.responseTime}ms`);
    } else {
        console.log('❌ Individual Sign-in: FAILED');
    }

    console.log('');
    console.log('📋 TEST SUITE 3: FAMILY P2P TRANSFER SYSTEM');
    console.log('=============================================');

    // Test 4: P2P Transfer - Enterprise Validation
    console.log('4. 💸 Testing Family P2P Transfer System...');
    const transferData = {
        recipient: 'family.member@dway.com',
        amount: 150,
        currency: 'USD',
        description: 'Monthly family allowance'
    };

    const transferResult = await testAPI('POST', '/api/transfers', transferData, 200);
    
    if (transferResult.success) {
        console.log('✅ Family P2P Transfer: SUCCESSFUL');
        console.log(`   💰 Transfer ID: ${transferResult.data.transfer?.id}`);
        console.log(`   👥 Recipient: ${transferResult.data.transfer?.recipient}`);
        console.log(`   💵 Amount: ${transferResult.data.transfer?.amount} ${transferResult.data.transfer?.currency}`);
        console.log(`   ⚡ Response Time: ${transferResult.responseTime}ms`);
        
        // Validate enterprise transaction structure
        if (transferResult.data.transfer?.formanceTransaction) {
            const formanceTx = transferResult.data.transfer.formanceTransaction;
            console.log('🏢 Enterprise Transaction Structure:');
            console.log(`     Source: ${formanceTx.source}`);
            console.log(`     Destination: ${formanceTx.destination}`);
            console.log(`     Asset: ${formanceTx.asset}`);
            console.log(`     Amount (BigInt): ${formanceTx.amount}`);
            console.log('✅ FormanceLedgerService Transaction Pattern: CONFIRMED');
        }
    } else {
        console.log('❌ Family P2P Transfer: FAILED');
        console.log(`   Error: ${transferResult.data?.error || 'Unknown error'}`);
    }

    // Test 5: Transfer Validation
    console.log('5. 🔍 Testing Transfer Validation...');
    const invalidTransferData = {
        recipient: '',
        amount: -50,
        currency: ''
    };

    const invalidTransferResult = await testAPI('POST', '/api/transfers', invalidTransferData, 400);
    
    if (invalidTransferResult.success) {
        console.log('✅ Transfer Validation: WORKING');
        console.log(`   🚫 Correctly rejected invalid transfer`);
        console.log(`   ⚡ Response Time: ${invalidTransferResult.responseTime}ms`);
    } else {
        console.log('❌ Transfer Validation: INSUFFICIENT');
    }

    console.log('');
    console.log('📋 TEST SUITE 4: MULTI-CURRENCY & PORTFOLIO');
    console.log('============================================');

    // Test 6: Account Management
    console.log('6. 🏦 Testing Individual Account Management...');
    const accountsResult = await testAPI('GET', '/api/accounts');
    
    if (accountsResult.success) {
        console.log('✅ Account Management: OPERATIONAL');
        console.log(`   🏦 Accounts Available: ${accountsResult.data?.length || 0}`);
        console.log(`   ⚡ Response Time: ${accountsResult.responseTime}ms`);
        
        // Validate account structure
        if (accountsResult.data?.length > 0) {
            const account = accountsResult.data[0];
            console.log(`   📋 Account Structure: ${account.formanceAddress || 'N/A'}`);
            if (account.formanceAddress?.startsWith('users:')) {
                console.log('✅ FormanceLedgerService Account Structure: CONFIRMED');
            }
        }
    } else {
        console.log('❌ Account Management: FAILED');
    }

    // Test 7: Exchange Rates
    console.log('7. 💱 Testing Multi-Currency Exchange Rates...');
    const exchangeResult = await testAPI('GET', '/api/exchange-rates');
    
    if (exchangeResult.success) {
        console.log('✅ Multi-Currency Support: OPERATIONAL');
        console.log(`   💱 Supported Currencies: ${Object.keys(exchangeResult.data?.rates || {}).length}`);
        console.log(`   🔗 Exchange Source: ${exchangeResult.data?.source}`);
        console.log(`   ⚡ Response Time: ${exchangeResult.responseTime}ms`);
    } else {
        console.log('❌ Multi-Currency Support: FAILED');
    }

    // Test 8: Crypto Portfolio for Individuals
    console.log('8. ₿ Testing Individual Crypto Portfolio...');
    const cryptoResult = await testAPI('GET', '/api/crypto/portfolio');
    
    if (cryptoResult.success) {
        console.log('✅ Individual Crypto Portfolio: ACCESSIBLE');
        console.log(`   💰 Total Portfolio Value: $${cryptoResult.data?.totalValue || 0}`);
        console.log(`   🪙 Crypto Assets: ${cryptoResult.data?.assets?.length || 0}`);
        console.log(`   ⛏️ Staking Options: ${cryptoResult.data?.staking?.length || 0}`);
        console.log(`   🔗 Integration Source: ${cryptoResult.data?.source}`);
        console.log(`   ⚡ Response Time: ${cryptoResult.responseTime}ms`);
    } else {
        console.log('❌ Individual Crypto Portfolio: FAILED');
    }

    console.log('');
    console.log('📋 TEST SUITE 5: PERFORMANCE & RELIABILITY');
    console.log('==========================================');

    // Performance Analysis
    const performanceMetrics = {
        totalTests: testResults.tests.length,
        successfulTests: testResults.tests.filter(t => t.success).length,
        failedTests: testResults.errors.length,
        averageResponseTime: testResults.performance.reduce((a, b) => a + b, 0) / testResults.performance.length,
        maxResponseTime: Math.max(...testResults.performance),
        minResponseTime: Math.min(...testResults.performance),
        successRate: (testResults.tests.filter(t => t.success).length / testResults.tests.length) * 100
    };

    console.log('📊 ENTERPRISE BRIDGE PERFORMANCE ANALYSIS:');
    console.log(`   ✅ Successful Tests: ${performanceMetrics.successfulTests}/${performanceMetrics.totalTests}`);
    console.log(`   📈 Success Rate: ${performanceMetrics.successRate.toFixed(1)}%`);
    console.log(`   ⚡ Average Response Time: ${performanceMetrics.averageResponseTime.toFixed(2)}ms`);
    console.log(`   🚀 Fastest Response: ${performanceMetrics.minResponseTime}ms`);
    console.log(`   🐌 Slowest Response: ${performanceMetrics.maxResponseTime}ms`);

    // Quality Assessment
    const qualityScore = calculateEnterpriseQualityScore(performanceMetrics, testResults);
    
    console.log('');
    console.log('📋 ENTERPRISE QUALITY ASSESSMENT');
    console.log('================================');
    console.log(`📊 Overall Quality Score: ${qualityScore}/100`);
    
    if (qualityScore >= 80) {
        console.log('🎉 EXCELLENT: Ready for production deployment');
    } else if (qualityScore >= 60) {
        console.log('⚠️ GOOD: Minor improvements needed before production');
    } else {
        console.log('❌ NEEDS WORK: Significant improvements required');
    }

    // Individual Client Readiness
    const individualClientScore = assessIndividualClientReadiness(testResults);
    console.log(`👥 Individual Client Readiness: ${individualClientScore}/100`);

    // Enterprise Integration Score
    const enterpriseScore = assessEnterpriseIntegration(testResults);
    console.log(`🏢 Enterprise Integration Score: ${enterpriseScore}/100`);

    // Save comprehensive results
    testResults.summary = {
        qualityScore,
        individualClientScore,
        enterpriseScore,
        performanceMetrics,
        timestamp: new Date().toISOString()
    };

    const resultsDir = path.join(__dirname, 'enterprise-bridge-tests');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }

    fs.writeFileSync(
        path.join(resultsDir, 'api-validation-results.json'),
        JSON.stringify(testResults, null, 2)
    );

    console.log(`📁 Detailed results saved to: ${resultsDir}/api-validation-results.json`);
    
    return testResults;
}

function calculateEnterpriseQualityScore(performance, results) {
    let score = 0;
    
    // Success Rate (40 points)
    score += Math.round(performance.successRate * 0.4);
    
    // Performance (30 points) 
    if (performance.averageResponseTime < 100) score += 30;
    else if (performance.averageResponseTime < 200) score += 25;
    else if (performance.averageResponseTime < 500) score += 20;
    else if (performance.averageResponseTime < 1000) score += 15;
    else score += 10;
    
    // Enterprise Features (30 points)
    const enterpriseFeatures = results.tests.filter(t => 
        t.success && (
            t.data?.formance || 
            t.data?.architecture?.includes('TypeScript') ||
            t.data?.user?.accountAddress?.startsWith('users:') ||
            t.data?.transfer?.formanceTransaction
        )
    ).length;
    
    score += Math.min(30, enterpriseFeatures * 5);
    
    return Math.min(100, score);
}

function assessIndividualClientReadiness(results) {
    let score = 0;
    
    // Registration (25 points)
    const regTest = results.tests.find(t => t.endpoint === '/api/auth/signup');
    if (regTest?.success) score += 25;
    
    // Authentication (25 points)
    const authTest = results.tests.find(t => t.endpoint === '/api/auth/signin');
    if (authTest?.success) score += 25;
    
    // P2P Transfers (25 points)
    const transferTest = results.tests.find(t => t.endpoint === '/api/transfers' && t.method === 'POST' && t.success);
    if (transferTest?.success) score += 25;
    
    // Portfolio & Features (25 points)
    const portfolioTest = results.tests.find(t => t.endpoint === '/api/crypto/portfolio');
    const accountsTest = results.tests.find(t => t.endpoint === '/api/accounts');
    if (portfolioTest?.success && accountsTest?.success) score += 25;
    
    return score;
}

function assessEnterpriseIntegration(results) {
    let score = 0;
    
    // FormanceLedgerService Readiness (40 points)
    const hasFormancePatterns = results.tests.some(t => 
        t.data?.user?.accountAddress?.startsWith('users:') ||
        t.data?.transfer?.formanceTransaction
    );
    if (hasFormancePatterns) score += 40;
    
    // Enterprise Architecture (30 points)
    const healthTest = results.tests.find(t => t.endpoint === '/api/health');
    if (healthTest?.data?.architecture?.includes('TypeScript')) score += 15;
    if (healthTest?.data?.features?.includes('FormanceLedgerService Ready')) score += 15;
    
    // Transaction Structure (30 points)
    const transferTest = results.tests.find(t => t.endpoint === '/api/transfers' && t.method === 'POST');
    if (transferTest?.data?.transfer?.formanceTransaction) {
        const tx = transferTest.data.transfer.formanceTransaction;
        if (tx.source && tx.destination && tx.asset && tx.amount) score += 30;
    }
    
    return score;
}

// Run the validation if this file is executed directly
if (require.main === module) {
    validateEnterpriseAPIs()
        .then(results => {
            console.log('');
            console.log('✅ ENTERPRISE BRIDGE API VALIDATION COMPLETE');
            console.log(`📊 Quality Score: ${results.summary.qualityScore}/100`);
            console.log(`👥 Individual Client Ready: ${results.summary.individualClientScore}/100`);
            console.log(`🏢 Enterprise Integration: ${results.summary.enterpriseScore}/100`);
        })
        .catch(error => {
            console.error('❌ Enterprise API Validation failed:', error);
            process.exit(1);
        });
}

module.exports = { validateEnterpriseAPIs };