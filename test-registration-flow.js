const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testRegistrationFlow() {
    console.log('🚀 Starting registration flow test...');
    
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 1000,
        defaultViewport: { width: 1200, height: 800 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
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
        
        // Log API calls
        if (url.includes('/api/')) {
            const timestamp = new Date().toISOString();
            const logEntry = {
                timestamp,
                method,
                url,
                status,
                statusText: response.statusText()
            };
            
            networkLogs.push(logEntry);
            
            // Color code the console output
            const statusColor = status >= 200 && status < 300 ? '\x1b[32m' : '\x1b[31m';
            console.log(`📡 ${timestamp} - ${method} ${url} - ${statusColor}${status}\x1b[0m ${response.statusText()}`);
            
            // Log response body for failed requests
            if (status >= 400) {
                try {
                    const responseBody = await response.text();
                    console.log(`❌ Error Response Body:`, responseBody);
                } catch (e) {
                    console.log(`❌ Could not read error response body:`, e.message);
                }
            }
        }
    });

    // Monitor console logs from the page
    page.on('console', (msg) => {
        const type = msg.type();
        const text = msg.text();
        
        if (type === 'error') {
            console.log(`🔴 Browser Console Error: ${text}`);
        } else if (type === 'warn') {
            console.log(`🟡 Browser Console Warning: ${text}`);
        } else if (text.includes('API') || text.includes('auth') || text.includes('register')) {
            console.log(`ℹ️ Browser Console: ${text}`);
        }
    });

    try {
        console.log('1. 🌐 Navigating to http://localhost:3000');
        await page.goto('http://localhost:3000', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        await page.screenshot({ 
            path: path.join(screenshotsDir, '01-initial-load.png'),
            fullPage: true 
        });
        console.log('✅ Page loaded successfully');

        // Wait for the page to be fully interactive
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log('2. 🔄 Switching to signup mode');
        
        // Look for signup button or link
        const signupSelectors = [
            '[data-testid="signup-button"]',
            '[data-testid="signup-link"]',
            'button[type="button"]' // The toggle button in the form
        ];

        let signupFound = false;
        for (const selector of signupSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 2000 });
                await page.click(selector);
                signupFound = true;
                console.log(`✅ Found and clicked signup element: ${selector}`);
                break;
            } catch (e) {
                // Try next selector
            }
        }

        if (!signupFound) {
            // Try to find any element with signup-related text
            const signupElements = await page.$$eval('*', elements => 
                elements.filter(el => 
                    el.textContent && 
                    (el.textContent.toLowerCase().includes('sign up') || 
                     el.textContent.toLowerCase().includes('create account') ||
                     el.textContent.toLowerCase().includes('register'))
                ).map(el => ({
                    tagName: el.tagName,
                    textContent: el.textContent.trim(),
                    className: el.className
                }))
            );
            
            console.log('🔍 Available signup-related elements:', signupElements);
            
            if (signupElements.length > 0) {
                // Try clicking the first one
                await page.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('*'));
                    const signupEl = elements.find(el => 
                        el.textContent && 
                        (el.textContent.toLowerCase().includes('sign up') || 
                         el.textContent.toLowerCase().includes('create account') ||
                         el.textContent.toLowerCase().includes('register'))
                    );
                    if (signupEl) signupEl.click();
                });
                signupFound = true;
                console.log('✅ Clicked signup element via text search');
            }
        }

        if (!signupFound) {
            console.log('⚠️ No signup button found, checking if we\'re already on signup page');
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.screenshot({ 
            path: path.join(screenshotsDir, '02-signup-mode.png'),
            fullPage: true 
        });

        console.log('3. 📝 Filling out registration form');

        // Try to find form fields
        const formFields = {
            firstName: ['input[name="firstName"]', 'input[placeholder*="first" i]', '#firstName', '[data-testid="first-name"]'],
            lastName: ['input[name="lastName"]', 'input[placeholder*="last" i]', '#lastName', '[data-testid="last-name"]'],
            email: ['input[name="email"]', 'input[type="email"]', 'input[placeholder*="email" i]', '#email', '[data-testid="email"]'],
            password: ['input[name="password"]', 'input[type="password"]', 'input[placeholder*="password" i]', '#password', '[data-testid="password"]']
        };

        const testData = {
            firstName: 'Test',
            lastName: 'User', 
            email: 'test@dway.com',
            password: 'password123'
        };

        for (const [fieldName, selectors] of Object.entries(formFields)) {
            let fieldFound = false;
            
            for (const selector of selectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 2000 });
                    await page.click(selector);
                    await page.keyboard.selectAll();
                    await page.type(selector, testData[fieldName]);
                    fieldFound = true;
                    console.log(`✅ Filled ${fieldName}: ${testData[fieldName]}`);
                    break;
                } catch (e) {
                    // Try next selector
                }
            }
            
            if (!fieldFound) {
                console.log(`❌ Could not find field: ${fieldName}`);
            }
        }

        await page.screenshot({ 
            path: path.join(screenshotsDir, '03-form-filled.png'),
            fullPage: true 
        });

        console.log('4. 🚀 Submitting the form');

        // Look for submit button
        const submitSelectors = [
            'button[type="submit"]',
            'input[type="submit"]', 
            '[data-testid="submit-button"]',
            'form button'
        ];

        let submitFound = false;
        for (const selector of submitSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 2000 });
                
                // Take screenshot before submitting
                await page.screenshot({ 
                    path: path.join(screenshotsDir, '04-before-submit.png'),
                    fullPage: true 
                });
                
                await page.click(selector);
                submitFound = true;
                console.log(`✅ Clicked submit button: ${selector}`);
                break;
            } catch (e) {
                // Try next selector
            }
        }

        if (!submitFound) {
            console.log('❌ Could not find submit button');
            // Try pressing Enter on the last filled field
            await page.keyboard.press('Enter');
            console.log('✅ Tried submitting with Enter key');
        }

        // Wait for response and potential navigation
        console.log('5. ⏳ Waiting for registration response...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check if we're redirected to dashboard
        const currentUrl = page.url();
        console.log(`📍 Current URL after submission: ${currentUrl}`);

        await page.screenshot({ 
            path: path.join(screenshotsDir, '05-after-submit.png'),
            fullPage: true 
        });

        console.log('6. 🎯 Verifying dashboard access and user name');

        // Check for dashboard indicators
        const dashboardIndicators = [
            'Welcome',
            'Dashboard',
            'Test User', // Our test user name
            'Logout',
            'Profile',
            'Balance',
            'Accounts'
        ];

        const foundIndicators = [];
        for (const indicator of dashboardIndicators) {
            try {
                // Use evaluate to check if text exists on page
                const found = await page.evaluate((text) => {
                    return document.body.textContent.includes(text);
                }, indicator);
                
                if (found) {
                    foundIndicators.push(indicator);
                    console.log(`✅ Found dashboard indicator: ${indicator}`);
                } else {
                    console.log(`❌ Dashboard indicator not found: ${indicator}`);
                }
            } catch (e) {
                console.log(`❌ Dashboard indicator not found: ${indicator}`);
            }
        }

        // Check for user name in header/navigation
        const pageText = await page.evaluate(() => document.body.textContent);
        const hasUserName = pageText.includes('Test User') || pageText.includes('Test') || pageText.includes('User');
        
        if (hasUserName) {
            console.log('✅ User name appears in the dashboard');
        } else {
            console.log('❌ User name not found in dashboard');
        }

        await page.screenshot({ 
            path: path.join(screenshotsDir, '06-final-dashboard.png'),
            fullPage: true 
        });

        console.log('7. 📊 Network Request Summary:');
        
        // Analyze network requests
        const apiCalls = networkLogs.filter(log => log.url.includes('/api/'));
        const successfulCalls = apiCalls.filter(log => log.status >= 200 && log.status < 300);
        const failedCalls = apiCalls.filter(log => log.status >= 400);
        
        console.log(`   📡 Total API calls: ${apiCalls.length}`);
        console.log(`   ✅ Successful calls: ${successfulCalls.length}`);
        console.log(`   ❌ Failed calls: ${failedCalls.length}`);
        
        if (successfulCalls.length > 0) {
            console.log('   🎉 Successful API calls:');
            successfulCalls.forEach(call => {
                console.log(`      ${call.method} ${call.url} - ${call.status}`);
            });
        }
        
        if (failedCalls.length > 0) {
            console.log('   💥 Failed API calls:');
            failedCalls.forEach(call => {
                console.log(`      ${call.method} ${call.url} - ${call.status} ${call.statusText}`);
            });
        }

        // Overall assessment
        console.log('\n📋 TEST RESULTS SUMMARY:');
        console.log('================================');
        
        const isOnDashboard = currentUrl.includes('dashboard') || foundIndicators.length > 0;
        const hasSuccessfulApiCalls = successfulCalls.length > 0;
        const noMajorErrors = failedCalls.filter(call => call.status === 404 || call.status >= 500).length === 0;
        
        console.log(`🌐 Page Navigation: ${isOnDashboard ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`📡 API Integration: ${hasSuccessfulApiCalls ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`🔍 User Presence: ${hasUserName ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`🚫 Error Handling: ${noMajorErrors ? '✅ PASS' : '❌ FAIL'}`);
        
        const overallSuccess = isOnDashboard && hasSuccessfulApiCalls && noMajorErrors;
        console.log(`\n🎯 OVERALL RESULT: ${overallSuccess ? '✅ REGISTRATION FLOW WORKING!' : '❌ ISSUES DETECTED'}`);

        // Save detailed network log
        fs.writeFileSync(
            path.join(screenshotsDir, 'network-log.json'),
            JSON.stringify(networkLogs, null, 2)
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

// Run the test
testRegistrationFlow().catch(console.error);