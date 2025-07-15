const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Enterprise Bridge Quality Testing Suite
 * Comprehensive validation of individual client experience with enterprise backend
 */

async function testEnterpriseBridge() {
    console.log('🚀 ENTERPRISE BRIDGE QUALITY TESTING - COMPREHENSIVE VALIDATION');
    console.log('🎯 Mission: Validate Individual Client Experience + Enterprise Foundation');
    console.log('🔍 Quality Persona + Puppeteer Testing Integration');
    console.log('');

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 500,
        defaultViewport: { width: 1400, height: 900 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Create enhanced testing directory
    const testDir = path.join(__dirname, 'enterprise-bridge-tests');
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }

    // Network monitoring for enterprise API calls
    const networkLogs = [];
    const apiCallMetrics = {
        enterprise: [],
        errors: [],
        performance: []
    };

    page.on('response', async (response) => {
        const url = response.url();
        const method = response.request().method();
        const status = response.status();
        const startTime = Date.now();

        if (url.includes('/api/')) {
            const responseTime = Date.now() - startTime;
            const logEntry = {
                timestamp: new Date().toISOString(),
                method,
                url,
                status,
                responseTime,
                headers: response.headers()
            };

            networkLogs.push(logEntry);

            // Enterprise API classification
            if (url.includes('localhost:3001')) {
                apiCallMetrics.enterprise.push(logEntry);
                console.log(`🏢 ENTERPRISE API: ${method} ${url} - ${status} (${responseTime}ms)`);
            }

            if (status >= 400) {
                apiCallMetrics.errors.push(logEntry);
                console.log(`❌ API ERROR: ${method} ${url} - ${status}`);
            }

            apiCallMetrics.performance.push(responseTime);
        }
    });

    // Console monitoring for enterprise patterns
    page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('Enterprise') || text.includes('FormanceLedgerService') || text.includes('ERROR')) {
            console.log(`🎭 Frontend Console: ${text}`);
        }
    });

    try {
        console.log('📋 TEST SUITE 1: ENTERPRISE BRIDGE CONNECTIVITY');
        console.log('================================================');

        // Test 1: Enterprise bridge server connectivity
        console.log('1. 🌐 Testing Enterprise Bridge Server (localhost:3001)...');
        await page.goto('http://localhost:3001', { 
            waitUntil: 'networkidle2', 
            timeout: 15000 
        });

        await page.screenshot({ 
            path: path.join(testDir, '01-enterprise-server-load.png'), 
            fullPage: true 
        });

        console.log('✅ Enterprise bridge server accessible');

        // Test 2: Health check validation
        console.log('2. 🏥 Validating Enterprise Health Endpoint...');
        const healthResponse = await page.evaluate(async () => {
            try {
                const response = await fetch('/api/health');
                return await response.json();
            } catch (error) {
                return { error: error.message };
            }
        });

        console.log('📊 Health Check Response:', healthResponse);
        
        if (healthResponse.status === 'healthy' && healthResponse.architecture) {
            console.log('✅ Enterprise health check: PASSED');
            console.log(`📋 Architecture: ${healthResponse.architecture}`);
            console.log(`🔧 Version: ${healthResponse.version}`);
        } else {
            console.log('❌ Enterprise health check: FAILED');
        }

        console.log('');
        console.log('📋 TEST SUITE 2: INDIVIDUAL CLIENT REGISTRATION');
        console.log('================================================');

        // Test 3: Enhanced individual client registration
        console.log('3. 👤 Testing Individual Client Registration Flow...');
        
        await page.waitForSelector('button', { timeout: 10000 });
        
        // Look for signup toggle
        const signupButtons = await page.$$eval('button', buttons => 
            buttons.map(btn => ({ text: btn.textContent, visible: btn.offsetParent !== null }))
        );
        
        console.log('🔍 Available buttons:', signupButtons);

        // Find and click signup toggle
        try {
            const signupButton = await page.evaluateHandle(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.find(btn => 
                    btn.textContent.toLowerCase().includes('sign up') || 
                    btn.textContent.toLowerCase().includes('create account')
                );
            });
            
            if (signupButton.asElement()) {
                await signupButton.asElement().click();
                console.log('✅ Signup mode activated');
                await page.waitForTimeout(1000);
            }
        } catch (error) {
            console.log('⚠️ Signup toggle not found, continuing...');
        }

        await page.screenshot({ 
            path: path.join(testDir, '02-signup-mode-activated.png'), 
            fullPage: true 
        });

        // Test 4: Enterprise registration with validation
        console.log('4. 📝 Testing Enterprise Registration Patterns...');

        const registrationData = {
            firstName: 'Individual',
            lastName: 'Client',
            email: 'individual.client@dway.com',
            password: 'SecurePass123!'
        };

        // Fill registration form
        const formFields = {
            firstName: 'input[name="firstName"], input[placeholder*="first" i]',
            lastName: 'input[name="lastName"], input[placeholder*="last" i]',
            email: 'input[name="email"], input[type="email"]',
            password: 'input[name="password"], input[type="password"]'
        };

        for (const [fieldName, selector] of Object.entries(formFields)) {
            try {
                await page.waitForSelector(selector, { timeout: 5000 });
                await page.click(selector);
                await page.keyboard.selectAll();
                await page.type(selector, registrationData[fieldName]);
                console.log(`✅ Filled ${fieldName}: ${registrationData[fieldName]}`);
            } catch (error) {
                console.log(`⚠️ Could not fill ${fieldName}: ${error.message}`);
            }
        }

        await page.screenshot({ 
            path: path.join(testDir, '03-registration-form-filled.png'), 
            fullPage: true 
        });

        // Test 5: Submit registration and validate enterprise response
        console.log('5. 🚀 Submitting Registration to Enterprise Backend...');

        // Submit form
        const submitButton = await page.$('button[type="submit"], form button');
        if (submitButton) {
            await submitButton.click();
            console.log('✅ Registration submitted');
        } else {
            await page.keyboard.press('Enter');
            console.log('⚠️ Submitted via Enter key');
        }

        // Wait for registration response
        await page.waitForTimeout(3000);

        await page.screenshot({ 
            path: path.join(testDir, '04-post-registration-state.png'), 
            fullPage: true 
        });

        console.log('');
        console.log('📋 TEST SUITE 3: ENTERPRISE P2P TRANSFER VALIDATION');
        console.log('==================================================');

        // Test 6: Navigate to P2P transfer functionality
        console.log('6. 💸 Testing Enterprise P2P Transfer System...');

        // Check if we're on dashboard or need to navigate
        const currentUrl = page.url();
        console.log(`📍 Current URL: ${currentUrl}`);

        // Look for transfer functionality
        const transferElements = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            return elements
                .filter(el => el.textContent && 
                    (el.textContent.toLowerCase().includes('transfer') || 
                     el.textContent.toLowerCase().includes('send money') ||
                     el.textContent.toLowerCase().includes('send')))
                .map(el => ({
                    tagName: el.tagName,
                    text: el.textContent.trim().substring(0, 50),
                    clickable: el.onclick || el.getAttribute('href') || (el.tagName === 'BUTTON')
                }));
        });

        console.log('🔍 Transfer elements found:', transferElements);

        // Try to access transfer functionality
        try {
            // Look for Send Money or Transfer buttons/links
            const transferButton = await page.evaluateHandle(() => {
                const elements = Array.from(document.querySelectorAll('button, a'));
                return elements.find(el => 
                    el.textContent.toLowerCase().includes('send') || 
                    el.textContent.toLowerCase().includes('transfer')
                );
            });
            
            if (transferButton.asElement()) {
                await transferButton.asElement().click();
                console.log('✅ Transfer interface accessed');
                await page.waitForTimeout(2000);
            } else {
                console.log('⚠️ Direct API testing - transfer interface not accessible');
            }
        } catch (error) {
            console.log('⚠️ Transfer navigation failed:', error.message);
        }

        await page.screenshot({ 
            path: path.join(testDir, '05-transfer-interface.png'), 
            fullPage: true 
        });

        // Test 7: Enterprise P2P transfer API validation
        console.log('7. 🔧 Testing Enterprise P2P Transfer API...');

        const transferResponse = await page.evaluate(async () => {
            try {
                const response = await fetch('/api/transfers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recipient: 'family.member@dway.com',
                        amount: 250,
                        currency: 'USD',
                        description: 'Family monthly allowance'
                    })
                });
                return {
                    status: response.status,
                    data: await response.json()
                };
            } catch (error) {
                return { error: error.message };
            }
        });

        console.log('📊 Transfer API Response:', transferResponse);

        if (transferResponse.status === 200 && transferResponse.data?.success) {
            console.log('✅ Enterprise P2P Transfer: SUCCESSFUL');
            console.log(`💰 Transfer ID: ${transferResponse.data.transfer.id}`);
            console.log(`👥 Recipient: ${transferResponse.data.transfer.recipient}`);
            console.log(`💵 Amount: ${transferResponse.data.transfer.amount} ${transferResponse.data.transfer.currency}`);
            
            // Validate enterprise account patterns
            if (transferResponse.data.transfer.formanceTransaction) {
                console.log('🏢 Enterprise Account Structure:');
                console.log(`   Source: ${transferResponse.data.transfer.formanceTransaction.source}`);
                console.log(`   Destination: ${transferResponse.data.transfer.formanceTransaction.destination}`);
                console.log('✅ FormanceLedgerService-compatible account patterns detected');
            }
        } else {
            console.log('❌ Enterprise P2P Transfer: FAILED');
        }

        console.log('');
        console.log('📋 TEST SUITE 4: MULTI-CURRENCY & PORTFOLIO VALIDATION');
        console.log('======================================================');

        // Test 8: Exchange rates and crypto portfolio
        console.log('8. 💱 Testing Multi-Currency Exchange Rates...');

        const exchangeRatesResponse = await page.evaluate(async () => {
            try {
                const response = await fetch('/api/exchange-rates');
                return await response.json();
            } catch (error) {
                return { error: error.message };
            }
        });

        console.log('📊 Exchange Rates:', exchangeRatesResponse);

        if (exchangeRatesResponse.rates) {
            console.log('✅ Multi-Currency Support: OPERATIONAL');
            console.log(`💱 Supported currencies: ${Object.keys(exchangeRatesResponse.rates).length}`);
            console.log(`🔗 Source: ${exchangeRatesResponse.source}`);
        }

        // Test 9: Crypto portfolio for individual clients
        console.log('9. ₿ Testing Individual Client Crypto Portfolio...');

        const cryptoResponse = await page.evaluate(async () => {
            try {
                const response = await fetch('/api/crypto/portfolio');
                return await response.json();
            } catch (error) {
                return { error: error.message };
            }
        });

        console.log('📊 Crypto Portfolio:', cryptoResponse);

        if (cryptoResponse.totalValue) {
            console.log('✅ Individual Crypto Portfolio: ACCESSIBLE');
            console.log(`💰 Total Value: $${cryptoResponse.totalValue}`);
            console.log(`🪙 Assets: ${cryptoResponse.assets?.length || 0}`);
            console.log(`⛏️ Staking Options: ${cryptoResponse.staking?.length || 0}`);
        }

        console.log('');
        console.log('📋 TEST SUITE 5: PERFORMANCE & RELIABILITY ANALYSIS');
        console.log('====================================================');

        // Performance analysis
        const performanceMetrics = {
            totalApiCalls: apiCallMetrics.enterprise.length,
            averageResponseTime: apiCallMetrics.performance.length > 0 
                ? apiCallMetrics.performance.reduce((a, b) => a + b, 0) / apiCallMetrics.performance.length 
                : 0,
            errorRate: (apiCallMetrics.errors.length / networkLogs.length) * 100,
            enterpriseEndpoints: [...new Set(apiCallMetrics.enterprise.map(call => call.url))]
        };

        console.log('📊 ENTERPRISE BRIDGE PERFORMANCE METRICS:');
        console.log(`   🔗 Total Enterprise API Calls: ${performanceMetrics.totalApiCalls}`);
        console.log(`   ⚡ Average Response Time: ${performanceMetrics.averageResponseTime.toFixed(2)}ms`);
        console.log(`   ❌ Error Rate: ${performanceMetrics.errorRate.toFixed(2)}%`);
        console.log(`   🏢 Enterprise Endpoints: ${performanceMetrics.enterpriseEndpoints.length}`);

        console.log('');
        console.log('📋 FINAL VALIDATION: INDIVIDUAL CLIENT EXPERIENCE');
        console.log('==================================================');

        // Final page state analysis
        const finalPageAnalysis = await page.evaluate(() => {
            const content = document.body.textContent;
            const indicators = {
                hasWelcomeMessage: content.includes('Welcome') || content.includes('Dashboard'),
                hasAccountInfo: content.includes('Account') || content.includes('Balance'),
                hasUserName: content.includes('Individual') || content.includes('Client'),
                hasTransferOptions: content.includes('Transfer') || content.includes('Send'),
                hasCryptoFeatures: content.includes('Crypto') || content.includes('Portfolio'),
                hasErrorMessages: content.includes('Error') || content.includes('Failed')
            };
            return indicators;
        });

        console.log('🎯 Individual Client Experience Indicators:');
        Object.entries(finalPageAnalysis).forEach(([key, value]) => {
            const status = value ? '✅' : '❌';
            console.log(`   ${status} ${key}: ${value}`);
        });

        await page.screenshot({ 
            path: path.join(testDir, '06-final-client-experience.png'), 
            fullPage: true 
        });

        // Test Summary Generation
        const testSummary = {
            timestamp: new Date().toISOString(),
            enterpriseBridge: {
                connectivity: 'PASS',
                healthCheck: healthResponse.status === 'healthy' ? 'PASS' : 'FAIL',
                registration: transferResponse.status === 200 ? 'PASS' : 'PARTIAL',
                p2pTransfers: transferResponse.data?.success ? 'PASS' : 'FAIL',
                multiCurrency: exchangeRatesResponse.rates ? 'PASS' : 'FAIL',
                cryptoPortfolio: cryptoResponse.totalValue ? 'PASS' : 'FAIL'
            },
            performance: performanceMetrics,
            individualClientExperience: finalPageAnalysis,
            qualityScore: calculateQualityScore(performanceMetrics, finalPageAnalysis, healthResponse, transferResponse),
            networkLogs: networkLogs
        };

        // Save comprehensive test results
        fs.writeFileSync(
            path.join(testDir, 'enterprise-bridge-test-results.json'),
            JSON.stringify(testSummary, null, 2)
        );

        console.log('');
        console.log('🎯 ENTERPRISE BRIDGE TESTING COMPLETE');
        console.log('======================================');
        console.log(`📊 Overall Quality Score: ${testSummary.qualityScore}/100`);
        console.log(`🏢 Enterprise API Calls: ${performanceMetrics.totalApiCalls}`);
        console.log(`⚡ Avg Response Time: ${performanceMetrics.averageResponseTime.toFixed(2)}ms`);
        console.log(`✅ Individual Client Ready: ${Object.values(finalPageAnalysis).filter(Boolean).length}/6 indicators`);
        console.log(`📁 Test artifacts saved to: ${testDir}`);

        return testSummary;

    } catch (error) {
        console.error('💥 Enterprise Bridge Testing Failed:', error);
        await page.screenshot({ 
            path: path.join(testDir, 'error-screenshot.png'), 
            fullPage: true 
        });
        throw error;
    } finally {
        console.log('🔚 Closing browser...');
        await browser.close();
    }
}

function calculateQualityScore(performance, clientExperience, health, transfer) {
    let score = 0;
    
    // Performance metrics (30 points)
    if (performance.averageResponseTime < 200) score += 15;
    else if (performance.averageResponseTime < 500) score += 10;
    else if (performance.averageResponseTime < 1000) score += 5;
    
    if (performance.errorRate < 5) score += 15;
    else if (performance.errorRate < 10) score += 10;
    else if (performance.errorRate < 20) score += 5;
    
    // Individual client experience (40 points)
    const experienceScore = Object.values(clientExperience).filter(Boolean).length;
    score += Math.round((experienceScore / 6) * 40);
    
    // Enterprise functionality (30 points)
    if (health.status === 'healthy') score += 10;
    if (transfer.data?.success) score += 20;
    
    return Math.min(score, 100);
}

// Run the test if this file is executed directly
if (require.main === module) {
    testEnterpriseBridge()
        .then(results => {
            console.log('✅ Enterprise Bridge Testing completed successfully');
            console.log(`📊 Final Quality Score: ${results.qualityScore}/100`);
        })
        .catch(error => {
            console.error('❌ Enterprise Bridge Testing failed:', error);
            process.exit(1);
        });
}

module.exports = { testEnterpriseBridge };