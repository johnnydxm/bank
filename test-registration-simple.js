const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testRegistrationFlow() {
    console.log('🚀 Starting simplified registration flow test...');
    
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 500,
        defaultViewport: { width: 1200, height: 800 }
    });

    const page = await browser.newPage();
    
    // Create screenshots directory
    const screenshotsDir = path.join(__dirname, 'test-screenshots');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Monitor network requests
    const networkLogs = [];
    page.on('response', async (response) => {
        const url = response.url();
        const status = response.status();
        const method = response.request().method();
        
        if (url.includes('/api/')) {
            const timestamp = new Date().toISOString();
            const logEntry = { timestamp, method, url, status };
            networkLogs.push(logEntry);
            
            const statusColor = status >= 200 && status < 300 ? '\x1b[32m' : '\x1b[31m';
            console.log(`📡 ${method} ${url} - ${statusColor}${status}\x1b[0m`);
        }
    });

    try {
        console.log('1. 🌐 Navigating to http://localhost:3000');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });
        
        await page.screenshot({ path: path.join(screenshotsDir, '01-initial-load.png'), fullPage: true });
        console.log('✅ Page loaded successfully');

        // Wait for React to render
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('2. 🔍 Looking for sign up toggle button');
        
        // Check if we need to toggle to signup mode
        const pageContent = await page.content();
        console.log('Page includes signup text:', pageContent.includes('sign up'));
        
        // Look for the toggle button by checking visible buttons
        const buttons = await page.$$('button');
        console.log(`Found ${buttons.length} buttons on the page`);
        
        // Check each button's text content
        let signupToggleButton = null;
        for (let i = 0; i < buttons.length; i++) {
            const buttonText = await page.evaluate(el => el.textContent, buttons[i]);
            console.log(`Button ${i}: "${buttonText}"`);
            
            if (buttonText.toLowerCase().includes('sign up') || buttonText.toLowerCase().includes('create account')) {
                signupToggleButton = buttons[i];
                console.log(`✅ Found signup toggle button: "${buttonText}"`);
                break;
            }
        }
        
        // If we found a signup toggle, click it
        if (signupToggleButton) {
            await signupToggleButton.click();
            console.log('✅ Clicked signup toggle button');
            await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
            console.log('⚠️ No signup toggle found, assuming already in signup mode');
        }
        
        await page.screenshot({ path: path.join(screenshotsDir, '02-signup-mode.png'), fullPage: true });

        console.log('3. 📝 Filling out registration form');
        
        // Fill out the form using more specific selectors
        const formData = {
            firstName: 'Test',
            lastName: 'User', 
            email: 'test@dway.com',
            password: 'password123'
        };
        
        // Try to fill each field
        for (const [fieldName, value] of Object.entries(formData)) {
            try {
                // Try multiple selector strategies
                const selectors = [
                    `input[name="${fieldName}"]`,
                    `input[placeholder*="${fieldName}" i]`,
                    `#${fieldName}`,
                    `input[type="${fieldName === 'email' ? 'email' : fieldName === 'password' ? 'password' : 'text'}"]`
                ];
                
                let filled = false;
                for (const selector of selectors) {
                    try {
                        const elements = await page.$$(selector);
                        if (elements.length > 0) {
                            // For fields like firstName/lastName, we might need the right index
                            let element = elements[0];
                            if (fieldName === 'lastName' && elements.length > 1) {
                                element = elements[1]; // Second text input for last name
                            }
                            
                            await element.click();
                            await element.evaluate(el => el.value = ''); // Clear field
                            await element.type(value);
                            console.log(`✅ Filled ${fieldName}: ${value}`);
                            filled = true;
                            break;
                        }
                    } catch (e) {
                        // Try next selector
                    }
                }
                
                if (!filled) {
                    console.log(`❌ Could not fill field: ${fieldName}`);
                }
            } catch (error) {
                console.log(`❌ Error filling ${fieldName}:`, error.message);
            }
        }

        await page.screenshot({ path: path.join(screenshotsDir, '03-form-filled.png'), fullPage: true });

        console.log('4. 🚀 Submitting the form');
        
        // Look for submit button
        const allButtons = await page.$$('button');
        let submitButton = null;
        
        for (let i = 0; i < allButtons.length; i++) {
            const buttonText = await page.evaluate(el => el.textContent, allButtons[i]);
            const buttonType = await page.evaluate(el => el.type, allButtons[i]);
            
            console.log(`Button ${i}: "${buttonText}" (type: ${buttonType})`);
            
            if (buttonType === 'submit' || 
                buttonText.toLowerCase().includes('create account') ||
                buttonText.toLowerCase().includes('sign up')) {
                submitButton = allButtons[i];
                console.log(`✅ Found submit button: "${buttonText}"`);
                break;
            }
        }
        
        if (submitButton) {
            await submitButton.click();
            console.log('✅ Clicked submit button');
        } else {
            console.log('❌ Could not find submit button, trying Enter key');
            await page.keyboard.press('Enter');
        }

        // Wait for response
        console.log('5. ⏳ Waiting for registration response...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        const currentUrl = page.url();
        console.log(`📍 Current URL after submission: ${currentUrl}`);

        await page.screenshot({ path: path.join(screenshotsDir, '04-after-submit.png'), fullPage: true });

        console.log('6. 🎯 Checking for dashboard or success indicators');
        
        const finalPageText = await page.evaluate(() => document.body.textContent);
        
        // Check for various success indicators
        const successIndicators = [
            'Welcome back, Test',
            'dashboard',
            'accounts',
            'balance',
            'transactions',
            'Test User',
            'Sign Out'
        ];
        
        const foundIndicators = successIndicators.filter(indicator => 
            finalPageText.toLowerCase().includes(indicator.toLowerCase())
        );
        
        console.log('Found success indicators:', foundIndicators);

        // Network analysis
        const apiCalls = networkLogs.filter(log => log.url.includes('/api/'));
        const authCalls = networkLogs.filter(log => log.url.includes('/api/auth/'));
        const successfulCalls = networkLogs.filter(log => log.status >= 200 && log.status < 300);
        const failedCalls = networkLogs.filter(log => log.status >= 400);
        
        console.log('\n📊 Network Request Summary:');
        console.log(`📡 Total API calls: ${apiCalls.length}`);
        console.log(`🔐 Auth API calls: ${authCalls.length}`);
        console.log(`✅ Successful calls: ${successfulCalls.length}`);
        console.log(`❌ Failed calls: ${failedCalls.length}`);
        
        // Overall assessment
        console.log('\n📋 TEST RESULTS SUMMARY:');
        console.log('================================');
        
        const hasSuccessIndicators = foundIndicators.length > 0;
        const hasSuccessfulAuthCalls = authCalls.some(call => call.status >= 200 && call.status < 300);
        const noMajorErrors = failedCalls.length === 0;
        
        console.log(`🎯 Success Indicators: ${hasSuccessIndicators ? '✅ PASS' : '❌ FAIL'} (${foundIndicators.length} found)`);
        console.log(`🔐 Auth API Calls: ${hasSuccessfulAuthCalls ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`🚫 Error Free: ${noMajorErrors ? '✅ PASS' : '❌ FAIL'}`);
        
        const overallSuccess = hasSuccessIndicators && hasSuccessfulAuthCalls && noMajorErrors;
        console.log(`\n🎯 OVERALL RESULT: ${overallSuccess ? '✅ REGISTRATION FLOW WORKING!' : '❌ ISSUES DETECTED'}`);

        // Save detailed logs
        fs.writeFileSync(
            path.join(screenshotsDir, 'network-log.json'),
            JSON.stringify(networkLogs, null, 2)
        );
        
        fs.writeFileSync(
            path.join(screenshotsDir, 'test-summary.json'),
            JSON.stringify({
                timestamp: new Date().toISOString(),
                foundIndicators,
                networkLogs,
                overallSuccess
            }, null, 2)
        );
        
        console.log(`📁 Screenshots and logs saved to: ${screenshotsDir}`);

    } catch (error) {
        console.error('💥 Test failed with error:', error);
        await page.screenshot({ 
            path: path.join(screenshotsDir, 'error-screenshot.png'),
            fullPage: true 
        });
    } finally {
        console.log('🔚 Closing browser...');
        await browser.close();
    }
}

testRegistrationFlow().catch(console.error);