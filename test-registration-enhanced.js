#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class EnhancedRegistrationTester {
    constructor() {
        this.browser = null;
        this.page = null;
        this.testResults = {
            pageLoad: null,
            formValidation: null,
            registrationFlow: null,
            apiEndpoints: null,
            networkAnalysis: null,
            debugInfo: {
                consoleMessages: [],
                networkRequests: [],
                errors: [],
                screenshots: []
            }
        };
        this.screenshotCounter = 0;
    }

    async initialize() {
        console.log('🚀 Initializing Enhanced Registration Testing...');
        
        this.browser = await puppeteer.launch({
            headless: false,
            defaultViewport: { width: 1280, height: 800 },
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        this.page = await this.browser.newPage();
        this.setupEventListeners();
        
        await this.page.setRequestInterception(true);
        this.page.on('request', (request) => {
            this.testResults.debugInfo.networkRequests.push({
                timestamp: new Date().toISOString(),
                method: request.method(),
                url: request.url(),
                headers: request.headers(),
                postData: request.postData()
            });
            request.continue();
        });

        console.log('✅ Enhanced tester initialized');
    }

    setupEventListeners() {
        this.page.on('console', (msg) => {
            const logEntry = {
                timestamp: new Date().toISOString(),
                type: msg.type(),
                text: msg.text(),
                location: msg.location()
            };
            this.testResults.debugInfo.consoleMessages.push(logEntry);
            console.log(`📝 Console [${msg.type()}]: ${msg.text()}`);
        });

        this.page.on('error', (error) => {
            const errorEntry = {
                timestamp: new Date().toISOString(),
                type: 'page-error',
                message: error.message,
                stack: error.stack
            };
            this.testResults.debugInfo.errors.push(errorEntry);
            console.log(`❌ Page Error: ${error.message}`);
        });

        this.page.on('pageerror', (error) => {
            const errorEntry = {
                timestamp: new Date().toISOString(),
                type: 'javascript-error',
                message: error.message,
                stack: error.stack
            };
            this.testResults.debugInfo.errors.push(errorEntry);
            console.log(`💥 JavaScript Error: ${error.message}`);
        });

        this.page.on('response', (response) => {
            if (response.status() >= 400) {
                console.log(`🔴 HTTP Error: ${response.status()} - ${response.url()}`);
            }
        });
    }

    async takeScreenshot(description) {
        const filename = `enhanced-screenshot-${++this.screenshotCounter}-${description.replace(/\s+/g, '-').toLowerCase()}.png`;
        const filepath = path.join(__dirname, 'test-screenshots', filename);
        
        const screenshotsDir = path.dirname(filepath);
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
        }

        await this.page.screenshot({ 
            path: filepath, 
            fullPage: true 
        });

        this.testResults.debugInfo.screenshots.push({
            description,
            filename,
            filepath,
            timestamp: new Date().toISOString()
        });

        console.log(`📸 Screenshot captured: ${filename}`);
        return filepath;
    }

    async testPageLoad() {
        console.log('\n🧪 Test 1: Enhanced Page Load Analysis');
        const startTime = Date.now();

        try {
            console.log('📍 Navigating to http://localhost:3001...');
            const response = await this.page.goto('http://localhost:3001', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            const loadTime = Date.now() - startTime;
            await this.takeScreenshot('page-loaded');

            // Check React state and components
            const reactAnalysis = await this.page.evaluate(() => {
                const reactFiber = document.querySelector('#root')?._reactInternalFiber || 
                                 document.querySelector('#root')?._reactInternalInstance;
                
                return {
                    hasReactRoot: !!document.querySelector('#root'),
                    reactFiberDetected: !!reactFiber,
                    reactDevToolsAvailable: !!(window.React && window.__REACT_DEVTOOLS_GLOBAL_HOOK__),
                    componentsFound: {
                        authForm: !!document.querySelector('form'),
                        inputs: document.querySelectorAll('input').length,
                        buttons: document.querySelectorAll('button').length
                    }
                };
            });

            this.testResults.pageLoad = {
                success: response.status() < 400,
                statusCode: response.status(),
                loadTime,
                url: response.url(),
                title: await this.page.title(),
                reactAnalysis
            };

            console.log(`✅ Page loaded - Status: ${response.status()}, Time: ${loadTime}ms`);
            console.log(`📊 React Analysis:`, reactAnalysis);

        } catch (error) {
            console.log(`❌ Page load failed: ${error.message}`);
            this.testResults.pageLoad = {
                success: false,
                error: error.message
            };
        }
    }

    async testFormValidation() {
        console.log('\n🧪 Test 2: Form Validation Testing');

        try {
            // Navigate to signup mode
            await this.navigateToSignupMode();

            // Test 1: Empty form submission
            console.log('🔍 Testing empty form submission...');
            const submitButton = await this.page.$('button[type="submit"]');
            if (submitButton) {
                await submitButton.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const validationErrors = await this.page.$$eval(
                    '.text-red-500, .error, .invalid', 
                    elements => elements.map(el => el.textContent)
                );
                
                console.log(`❌ Validation errors found: ${validationErrors.length}`);
                await this.takeScreenshot('empty-form-validation');
            }

            // Test 2: Invalid email format
            console.log('🔍 Testing invalid email format...');
            await this.fillFormPartially({
                email: 'invalid-email',
                password: 'password123',
                firstName: 'Test',
                lastName: 'User'
            });

            await submitButton?.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const emailErrors = await this.page.$$eval(
                '.text-red-500', 
                elements => elements.filter(el => el.textContent.includes('email')).map(el => el.textContent)
            );

            await this.takeScreenshot('invalid-email-validation');

            // Test 3: Password too short
            console.log('🔍 Testing short password...');
            await this.fillFormPartially({
                email: 'test@example.com',
                password: '123',
                firstName: 'Test',
                lastName: 'User'
            });

            await submitButton?.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const passwordErrors = await this.page.$$eval(
                '.text-red-500', 
                elements => elements.filter(el => el.textContent.includes('password')).map(el => el.textContent)
            );

            await this.takeScreenshot('short-password-validation');

            this.testResults.formValidation = {
                emptyFormErrors: validationErrors.length,
                emailValidationWorks: emailErrors.length > 0,
                passwordValidationWorks: passwordErrors.length > 0,
                validationErrorsDisplayed: validationErrors.concat(emailErrors, passwordErrors)
            };

            console.log(`✅ Form validation analysis complete`);

        } catch (error) {
            console.log(`❌ Form validation test failed: ${error.message}`);
            this.testResults.formValidation = {
                success: false,
                error: error.message
            };
        }
    }

    async navigateToSignupMode() {
        // Find and click signup toggle
        const signupButtons = await this.page.$$('button');
        for (const button of signupButtons) {
            const text = await button.evaluate(el => el.textContent?.toLowerCase() || '');
            if (text.includes('sign up') || text.includes('create')) {
                await button.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.takeScreenshot('signup-mode-activated');
                break;
            }
        }
    }

    async fillFormPartially(data) {
        if (data.firstName) {
            const firstNameInput = await this.page.$('input[type="text"]');
            if (firstNameInput) {
                await firstNameInput.click({ clickCount: 3 });
                await firstNameInput.type(data.firstName);
            }
        }

        if (data.email) {
            const emailInput = await this.page.$('input[type="email"]');
            if (emailInput) {
                await emailInput.click({ clickCount: 3 });
                await emailInput.type(data.email);
            }
        }

        if (data.password) {
            const passwordInput = await this.page.$('input[type="password"]');
            if (passwordInput) {
                await passwordInput.click({ clickCount: 3 });
                await passwordInput.type(data.password);
            }
        }

        // Check if lastName field exists and fill it
        if (data.lastName) {
            const lastNameInputs = await this.page.$$('input[type="text"]');
            if (lastNameInputs.length > 1) {
                await lastNameInputs[1].click({ clickCount: 3 });
                await lastNameInputs[1].type(data.lastName);
            }
        }
    }

    async testRegistrationFlow() {
        console.log('\n🧪 Test 3: Complete Registration Flow');

        try {
            // Clear form and fill with valid data
            await this.page.reload();
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await this.navigateToSignupMode();

            console.log('📝 Filling form with valid data...');
            await this.fillFormPartially({
                firstName: 'Test',
                lastName: 'User',
                email: 'test@example.com',
                password: 'password123'
            });

            // Check if confirm password field exists
            const confirmPasswordInputs = await this.page.$$('input[type="password"]');
            if (confirmPasswordInputs.length > 1) {
                console.log('🔍 Found confirm password field, filling...');
                await confirmPasswordInputs[1].click();
                await confirmPasswordInputs[1].type('password123');
            }

            await this.takeScreenshot('valid-form-filled');

            // Monitor network requests before submission
            const preSubmissionRequestCount = this.testResults.debugInfo.networkRequests.length;
            const preSubmissionConsoleCount = this.testResults.debugInfo.consoleMessages.length;

            console.log('🚀 Submitting registration form...');
            const submitButton = await this.page.$('button[type="submit"]');
            await submitButton?.click();

            // Wait for any network activity
            await new Promise(resolve => setTimeout(resolve, 5000));
            await this.takeScreenshot('after-registration-submit');

            const postSubmissionRequestCount = this.testResults.debugInfo.networkRequests.length;
            const postSubmissionConsoleCount = this.testResults.debugInfo.consoleMessages.length;

            // Check for loading states
            const loadingState = await this.page.evaluate(() => {
                const loadingElements = document.querySelectorAll('.animate-spin, .loading, [data-loading="true"]');
                const disabledButton = document.querySelector('button[type="submit"]:disabled');
                return {
                    hasLoadingElements: loadingElements.length > 0,
                    buttonDisabled: !!disabledButton,
                    loadingText: Array.from(loadingElements).map(el => el.textContent)
                };
            });

            // Check for form errors
            const formErrors = await this.page.$$eval(
                '.text-red-500, .error, .bg-red-50',
                elements => elements.map(el => el.textContent)
            );

            // Check if URL changed or user is redirected
            const currentUrl = this.page.url();
            const urlChanged = currentUrl !== 'http://localhost:3001/';

            this.testResults.registrationFlow = {
                formSubmitted: true,
                networkRequestsTriggered: postSubmissionRequestCount - preSubmissionRequestCount,
                consoleMessagesAdded: postSubmissionConsoleCount - preSubmissionConsoleCount,
                loadingState,
                formErrors,
                urlChanged,
                currentUrl,
                submissionTimestamp: new Date().toISOString()
            };

            console.log(`✅ Registration flow test complete`);
            console.log(`📊 Network requests triggered: ${postSubmissionRequestCount - preSubmissionRequestCount}`);
            console.log(`📊 Form errors: ${formErrors.length}`);
            console.log(`📊 URL changed: ${urlChanged}`);

        } catch (error) {
            console.log(`❌ Registration flow test failed: ${error.message}`);
            this.testResults.registrationFlow = {
                success: false,
                error: error.message
            };
        }
    }

    async testApiEndpoints() {
        console.log('\n🧪 Test 4: API Endpoint Analysis');

        try {
            // Test if auth endpoints are available
            const endpoints = [
                { path: '/api/auth/signin', method: 'POST' },
                { path: '/api/auth/signup', method: 'POST' },
                { path: '/api/auth/me', method: 'GET' },
                { path: '/api/health', method: 'GET' }
            ];

            const endpointResults = [];

            for (const endpoint of endpoints) {
                try {
                    console.log(`🔍 Testing ${endpoint.method} ${endpoint.path}...`);
                    
                    const response = await this.page.evaluate(async (ep) => {
                        try {
                            const res = await fetch(ep.path, {
                                method: ep.method,
                                headers: ep.method === 'POST' ? {
                                    'Content-Type': 'application/json'
                                } : {},
                                body: ep.method === 'POST' ? JSON.stringify({
                                    email: 'test@example.com',
                                    password: 'password123',
                                    firstName: 'Test',
                                    lastName: 'User'
                                }) : undefined
                            });
                            
                            return {
                                status: res.status,
                                statusText: res.statusText,
                                url: res.url,
                                headers: Object.fromEntries(res.headers.entries())
                            };
                        } catch (error) {
                            return {
                                error: error.message,
                                status: 0
                            };
                        }
                    }, endpoint);

                    endpointResults.push({
                        ...endpoint,
                        ...response,
                        timestamp: new Date().toISOString()
                    });

                    if (response.status) {
                        console.log(`📡 ${endpoint.path}: ${response.status} ${response.statusText}`);
                    } else {
                        console.log(`❌ ${endpoint.path}: ${response.error}`);
                    }

                } catch (error) {
                    console.log(`❌ Failed to test ${endpoint.path}: ${error.message}`);
                    endpointResults.push({
                        ...endpoint,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            this.testResults.apiEndpoints = {
                tested: endpoints.length,
                results: endpointResults,
                available: endpointResults.filter(r => r.status && r.status < 500).length,
                implemented: endpointResults.filter(r => r.status && r.status !== 404).length
            };

            console.log(`✅ API endpoint analysis complete - ${this.testResults.apiEndpoints.available}/${endpoints.length} available`);

        } catch (error) {
            console.log(`❌ API endpoint test failed: ${error.message}`);
            this.testResults.apiEndpoints = {
                success: false,
                error: error.message
            };
        }
    }

    async analyzeNetworkActivity() {
        console.log('\n🧪 Test 5: Network Activity Analysis');

        const requests = this.testResults.debugInfo.networkRequests;
        const analysis = {
            totalRequests: requests.length,
            byMethod: {},
            byDomain: {},
            authRequests: [],
            externalRequests: [],
            timing: {
                firstRequest: requests[0]?.timestamp,
                lastRequest: requests[requests.length - 1]?.timestamp
            }
        };

        requests.forEach(req => {
            // Group by method
            analysis.byMethod[req.method] = (analysis.byMethod[req.method] || 0) + 1;

            // Group by domain
            try {
                const domain = new URL(req.url).hostname;
                analysis.byDomain[domain] = (analysis.byDomain[domain] || 0) + 1;
            } catch (e) {}

            // Find auth-related requests
            if (req.url.includes('/api/auth/') || req.url.includes('auth')) {
                analysis.authRequests.push(req);
            }

            // Find external requests
            if (!req.url.includes('localhost:3001')) {
                analysis.externalRequests.push(req);
            }
        });

        this.testResults.networkAnalysis = analysis;

        console.log(`📊 Network Analysis:`);
        console.log(`  - Total requests: ${analysis.totalRequests}`);
        console.log(`  - Methods:`, Object.entries(analysis.byMethod));
        console.log(`  - Auth requests: ${analysis.authRequests.length}`);
        console.log(`  - External requests: ${analysis.externalRequests.length}`);
    }

    async generateComprehensiveReport() {
        console.log('\n📊 Generating Comprehensive Test Report...');

        const report = {
            timestamp: new Date().toISOString(),
            testDuration: Date.now() - this.startTime,
            summary: {
                pageLoadSuccess: this.testResults.pageLoad?.success || false,
                formValidationWorks: this.testResults.formValidation?.emailValidationWorks || false,
                registrationAttempted: this.testResults.registrationFlow?.formSubmitted || false,
                apiEndpointsAvailable: this.testResults.apiEndpoints?.available || 0,
                totalNetworkRequests: this.testResults.networkAnalysis?.totalRequests || 0,
                jsErrors: this.testResults.debugInfo.errors.length,
                screenshotsTaken: this.testResults.debugInfo.screenshots.length
            },
            detailedResults: this.testResults,
            conclusions: this.generateConclusions()
        };

        const reportPath = path.join(__dirname, 'enhanced-registration-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        console.log(`📋 Enhanced report saved to: ${reportPath}`);
        return report;
    }

    generateConclusions() {
        const conclusions = [];

        // Page load analysis
        if (this.testResults.pageLoad?.success) {
            conclusions.push("✅ Application loads successfully with React framework detected");
        } else {
            conclusions.push("❌ Application failed to load properly");
        }

        // Form validation analysis
        if (this.testResults.formValidation?.emailValidationWorks) {
            conclusions.push("✅ Form validation is working (email format validation detected)");
        } else {
            conclusions.push("⚠️ Form validation may not be working properly");
        }

        // Registration flow analysis
        if (this.testResults.registrationFlow?.networkRequestsTriggered > 0) {
            conclusions.push("✅ Registration form triggers network requests as expected");
        } else {
            conclusions.push("❌ Registration form does not trigger any network requests");
        }

        // API endpoint analysis
        const apiResults = this.testResults.apiEndpoints;
        if (apiResults?.available > 0) {
            conclusions.push(`✅ ${apiResults.available} API endpoints are responding`);
        } else {
            conclusions.push("❌ No API endpoints are available or responding");
        }

        // Error analysis
        const errorCount = this.testResults.debugInfo.errors.length;
        if (errorCount === 0) {
            conclusions.push("✅ No JavaScript errors detected during testing");
        } else {
            conclusions.push(`⚠️ ${errorCount} JavaScript errors detected`);
        }

        // Network analysis
        const authRequests = this.testResults.networkAnalysis?.authRequests?.length || 0;
        if (authRequests > 0) {
            conclusions.push(`✅ ${authRequests} authentication-related requests detected`);
        } else {
            conclusions.push("❌ No authentication requests detected - backend integration missing");
        }

        return conclusions;
    }

    async run() {
        this.startTime = Date.now();
        
        try {
            await this.initialize();
            await this.testPageLoad();
            await this.testFormValidation();
            await this.testRegistrationFlow();
            await this.testApiEndpoints();
            await this.analyzeNetworkActivity();
            
            const report = await this.generateComprehensiveReport();
            
            console.log('\n🎉 Enhanced testing completed!');
            console.log('\n🔍 Key Conclusions:');
            report.conclusions.forEach(conclusion => console.log(`  ${conclusion}`));
            
            return report;
            
        } catch (error) {
            console.error(`💥 Test execution failed: ${error.message}`);
            throw error;
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
}

// Main execution
async function main() {
    console.log('🏦 DWAY Financial Freedom Platform - Enhanced Registration Testing');
    console.log('='.repeat(80));

    const tester = new EnhancedRegistrationTester();
    
    try {
        const report = await tester.run();
        process.exit(0);
    } catch (error) {
        console.error(`💥 Testing failed: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = EnhancedRegistrationTester;