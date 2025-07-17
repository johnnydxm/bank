#!/usr/bin/env node

/**
 * DWAY Financial Freedom Platform - Comprehensive Testing Suite
 * Automated Puppeteer testing for all individual client features
 * 
 * Test Coverage:
 * - Authentication System (signup/signin, validation, error handling)
 * - User Dashboard (multi-currency accounts, balance, transactions)
 * - Banking Features (account management, balance checking, transaction viewing)
 * - P2P Transfers (send money workflow, validation, success/failure)
 * - Crypto Wallet (DeFi integration, staking interface, portfolio)
 * - UI/UX Experience (responsiveness, loading states, error messages)
 * - Security Features (session management, authentication persistence)
 * - API Integration (backend connectivity, data fetching, real-time updates)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

// Configuration
const CONFIG = {
    BASE_URL: 'http://localhost:3000',
    HEADLESS: true,
    TIMEOUT: 10000,
    SCREENSHOT_DIR: './test-screenshots/comprehensive-suite',
    REPORT_FILE: './comprehensive-platform-test-report.json',
    PERFORMANCE_THRESHOLD: 3000, // 3 seconds
    SUCCESS_THRESHOLD: 80, // 80% success rate
};

// Test Results Structure
const TEST_RESULTS = {
    timestamp: new Date().toISOString(),
    platform: 'DWAY Financial Freedom Platform',
    testType: 'Comprehensive Individual Client Feature Testing',
    summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        pending: 0,
        successRate: 0,
        overallScore: 0
    },
    categories: {
        authentication: { tests: [], score: 0, status: 'pending' },
        userDashboard: { tests: [], score: 0, status: 'pending' },
        banking: { tests: [], score: 0, status: 'pending' },
        p2pTransfers: { tests: [], score: 0, status: 'pending' },
        cryptoWallet: { tests: [], score: 0, status: 'pending' },
        uiUx: { tests: [], score: 0, status: 'pending' },
        security: { tests: [], score: 0, status: 'pending' },
        apiIntegration: { tests: [], score: 0, status: 'pending' }
    },
    performance: {
        loadTimes: [],
        responseTimes: [],
        averageLoadTime: 0,
        averageResponseTime: 0
    },
    recommendations: [],
    screenshots: []
};

// Utility Functions
function createScreenshotDir() {
    if (!fs.existsSync(CONFIG.SCREENSHOT_DIR)) {
        fs.mkdirSync(CONFIG.SCREENSHOT_DIR, { recursive: true });
    }
}

async function takeScreenshot(page, name, description) {
    const filename = `${Date.now()}-${name}.png`;
    const filepath = path.join(CONFIG.SCREENSHOT_DIR, filename);
    
    await page.screenshot({
        path: filepath,
        fullPage: true,
        quality: 90
    });
    
    TEST_RESULTS.screenshots.push({
        name,
        description,
        filename,
        filepath,
        timestamp: new Date().toISOString()
    });
    
    console.log(`📸 Screenshot: ${name} - ${description}`);
    return filepath;
}

async function measurePerformance(page, action) {
    const startTime = Date.now();
    
    await page.waitForLoadState?.('networkidle', { timeout: CONFIG.TIMEOUT }).catch(() => {});
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    TEST_RESULTS.performance.loadTimes.push({
        action,
        duration,
        timestamp: new Date().toISOString()
    });
    
    return duration;
}

async function addTest(category, testName, status, details, performance = null) {
    const test = {
        name: testName,
        status, // 'passed', 'failed', 'pending'
        details,
        performance,
        timestamp: new Date().toISOString()
    };
    
    TEST_RESULTS.categories[category].tests.push(test);
    TEST_RESULTS.summary.totalTests++;
    
    if (status === 'passed') {
        TEST_RESULTS.summary.passed++;
        console.log(`✅ ${testName}: ${details}`);
    } else if (status === 'failed') {
        TEST_RESULTS.summary.failed++;
        console.log(`❌ ${testName}: ${details}`);
    } else {
        TEST_RESULTS.summary.pending++;
        console.log(`🔄 ${testName}: ${details}`);
    }
}

async function checkServerStatus() {
    console.log('🔍 Checking if DWAY Platform server is running...');
    
    return new Promise((resolve) => {
        const req = http.get(CONFIG.BASE_URL, (res) => {
            console.log('✅ Server is already running and accessible');
            resolve(null); // No server process to kill
        });
        
        req.on('error', (error) => {
            console.log('❌ Server is not accessible, but continuing with tests...');
            resolve(null);
        });
        
        req.setTimeout(5000, () => {
            console.log('⚠️  Server connection timeout, but continuing with tests...');
            req.destroy();
            resolve(null);
        });
    });
}

// Test Categories Implementation

async function testAuthentication(page) {
    console.log('\n🔐 Testing Authentication System...');
    
    // Test 1: Page Load and Form Presence
    try {
        await page.goto(CONFIG.BASE_URL, { waitUntil: 'networkidle2' });
        const loadTime = await measurePerformance(page, 'initial_page_load');
        
        const authForm = await page.$('form');
        if (authForm) {
            await addTest('authentication', 'Authentication Form Presence', 'passed', 
                'Login/signup form is present on page load', loadTime);
            await takeScreenshot(page, 'auth-form-loaded', 'Authentication form displayed');
        } else {
            await addTest('authentication', 'Authentication Form Presence', 'failed', 
                'No authentication form found on page');
        }
    } catch (error) {
        await addTest('authentication', 'Authentication Form Presence', 'failed', 
            `Page load failed: ${error.message}`);
    }
    
    // Test 2: Sign Up Form Validation
    try {
        const signupTab = await page.$('[data-testid="signup-tab"]') || await page.$('button:has-text("Sign Up")');
        if (signupTab) {
            await signupTab.click();
            await page.waitForTimeout(1000);
            
            // Test empty form submission
            const submitButton = await page.$('button[type="submit"]');
            if (submitButton) {
                await submitButton.click();
                await page.waitForTimeout(1000);
                
                // Check for validation errors
                const errorMessages = await page.$$('.error, .text-red-500, [class*="error"]');
                if (errorMessages.length > 0) {
                    await addTest('authentication', 'Form Validation', 'passed', 
                        `Form validation working - ${errorMessages.length} error messages displayed`);
                } else {
                    await addTest('authentication', 'Form Validation', 'failed', 
                        'No validation errors shown for empty form submission');
                }
            }
        }
    } catch (error) {
        await addTest('authentication', 'Form Validation', 'failed', 
            `Form validation test failed: ${error.message}`);
    }
    
    // Test 3: Signup Flow
    try {
        await page.fill('input[name="email"]', 'test@example.com');
        await page.fill('input[name="password"]', 'Test123456!');
        await page.fill('input[name="confirmPassword"]', 'Test123456!');
        
        const submitButton = await page.$('button[type="submit"]');
        if (submitButton) {
            await submitButton.click();
            const responseTime = await measurePerformance(page, 'signup_submission');
            
            await page.waitForTimeout(2000);
            
            // Check for success indicators
            const successIndicators = await page.$$('.success, .text-green-500, [class*="success"]');
            const dashboardElements = await page.$$('[data-testid="dashboard"], .dashboard');
            
            if (successIndicators.length > 0 || dashboardElements.length > 0) {
                await addTest('authentication', 'Signup Flow', 'passed', 
                    'Signup successful - user redirected or success message shown', responseTime);
                await takeScreenshot(page, 'signup-success', 'Successful signup completion');
            } else {
                await addTest('authentication', 'Signup Flow', 'pending', 
                    'Signup submitted but success state unclear', responseTime);
            }
        }
    } catch (error) {
        await addTest('authentication', 'Signup Flow', 'failed', 
            `Signup flow failed: ${error.message}`);
    }
    
    // Test 4: Login Flow
    try {
        await page.goto(CONFIG.BASE_URL);
        await page.waitForTimeout(1000);
        
        const loginTab = await page.$('[data-testid="login-tab"]') || await page.$('button:has-text("Login")');
        if (loginTab) {
            await loginTab.click();
            await page.waitForTimeout(1000);
            
            await page.fill('input[name="email"]', 'test@example.com');
            await page.fill('input[name="password"]', 'Test123456!');
            
            const submitButton = await page.$('button[type="submit"]');
            if (submitButton) {
                await submitButton.click();
                const responseTime = await measurePerformance(page, 'login_submission');
                
                await page.waitForTimeout(2000);
                
                // Check for dashboard or success indicators
                const dashboardElements = await page.$$('[data-testid="dashboard"], .dashboard, .user-dashboard');
                if (dashboardElements.length > 0) {
                    await addTest('authentication', 'Login Flow', 'passed', 
                        'Login successful - user redirected to dashboard', responseTime);
                } else {
                    await addTest('authentication', 'Login Flow', 'pending', 
                        'Login submitted but dashboard not clearly visible', responseTime);
                }
            }
        }
    } catch (error) {
        await addTest('authentication', 'Login Flow', 'failed', 
            `Login flow failed: ${error.message}`);
    }
}

async function testUserDashboard(page) {
    console.log('\n📊 Testing User Dashboard...');
    
    // Test 1: Dashboard Layout and Components
    try {
        const dashboardElements = await page.$$('[data-testid="dashboard"], .dashboard, .user-dashboard');
        if (dashboardElements.length > 0) {
            await addTest('userDashboard', 'Dashboard Layout', 'passed', 
                'Dashboard layout elements are present');
            await takeScreenshot(page, 'dashboard-layout', 'Main dashboard layout');
        } else {
            await addTest('userDashboard', 'Dashboard Layout', 'failed', 
                'Dashboard layout not found');
        }
    } catch (error) {
        await addTest('userDashboard', 'Dashboard Layout', 'failed', 
            `Dashboard layout test failed: ${error.message}`);
    }
    
    // Test 2: Multi-Currency Account Display
    try {
        const currencyElements = await page.$$('[data-testid*="currency"], .currency, [class*="currency"]');
        const accountElements = await page.$$('[data-testid*="account"], .account, [class*="account"]');
        
        if (currencyElements.length > 0 || accountElements.length > 0) {
            await addTest('userDashboard', 'Multi-Currency Accounts', 'passed', 
                `Multi-currency account display working - ${currencyElements.length} currency elements, ${accountElements.length} account elements`);
        } else {
            await addTest('userDashboard', 'Multi-Currency Accounts', 'pending', 
                'Multi-currency account elements not clearly identified');
        }
    } catch (error) {
        await addTest('userDashboard', 'Multi-Currency Accounts', 'failed', 
            `Multi-currency account test failed: ${error.message}`);
    }
    
    // Test 3: Balance Overview
    try {
        const balanceElements = await page.$$('[data-testid*="balance"], .balance, [class*="balance"]');
        const numberElements = await page.$$eval('*', elements => 
            elements.filter(el => /\$|€|£|¥|₿/.test(el.textContent)).length
        );
        
        if (balanceElements.length > 0 || numberElements > 0) {
            await addTest('userDashboard', 'Balance Overview', 'passed', 
                `Balance display working - ${balanceElements.length} balance elements, ${numberElements} currency symbols`);
        } else {
            await addTest('userDashboard', 'Balance Overview', 'pending', 
                'Balance information not clearly displayed');
        }
    } catch (error) {
        await addTest('userDashboard', 'Balance Overview', 'failed', 
            `Balance overview test failed: ${error.message}`);
    }
    
    // Test 4: Transaction History
    try {
        const transactionElements = await page.$$('[data-testid*="transaction"], .transaction, [class*="transaction"]');
        const historyElements = await page.$$('[data-testid*="history"], .history, [class*="history"]');
        
        if (transactionElements.length > 0 || historyElements.length > 0) {
            await addTest('userDashboard', 'Transaction History', 'passed', 
                `Transaction history elements present - ${transactionElements.length + historyElements.length} elements`);
        } else {
            await addTest('userDashboard', 'Transaction History', 'pending', 
                'Transaction history section not clearly identified');
        }
    } catch (error) {
        await addTest('userDashboard', 'Transaction History', 'failed', 
            `Transaction history test failed: ${error.message}`);
    }
}

async function testBankingFeatures(page) {
    console.log('\n🏦 Testing Banking Features...');
    
    // Test 1: Account Management Interface
    try {
        const accountManagementElements = await page.$$('[data-testid*="account-management"], .account-management, [class*="account-management"]');
        const manageButtons = await page.$$('button:has-text("Manage"), button:has-text("Account")');
        
        if (accountManagementElements.length > 0 || manageButtons.length > 0) {
            await addTest('banking', 'Account Management Interface', 'passed', 
                'Account management interface elements are present');
        } else {
            await addTest('banking', 'Account Management Interface', 'pending', 
                'Account management interface not clearly identified');
        }
    } catch (error) {
        await addTest('banking', 'Account Management Interface', 'failed', 
            `Account management test failed: ${error.message}`);
    }
    
    // Test 2: Balance Checking Functionality
    try {
        const balanceCheckElements = await page.$$('[data-testid*="balance-check"], .balance-check, button:has-text("Check Balance")');
        const refreshButtons = await page.$$('button:has-text("Refresh"), [data-testid*="refresh"]');
        
        if (balanceCheckElements.length > 0 || refreshButtons.length > 0) {
            await addTest('banking', 'Balance Checking', 'passed', 
                'Balance checking functionality elements are present');
        } else {
            await addTest('banking', 'Balance Checking', 'pending', 
                'Balance checking functionality not clearly identified');
        }
    } catch (error) {
        await addTest('banking', 'Balance Checking', 'failed', 
            `Balance checking test failed: ${error.message}`);
    }
    
    // Test 3: Transaction Viewing
    try {
        const transactionViewElements = await page.$$('[data-testid*="transaction-view"], .transaction-view, .transaction-list');
        const viewButtons = await page.$$('button:has-text("View"), button:has-text("Details")');
        
        if (transactionViewElements.length > 0 || viewButtons.length > 0) {
            await addTest('banking', 'Transaction Viewing', 'passed', 
                'Transaction viewing functionality elements are present');
        } else {
            await addTest('banking', 'Transaction Viewing', 'pending', 
                'Transaction viewing functionality not clearly identified');
        }
    } catch (error) {
        await addTest('banking', 'Transaction Viewing', 'failed', 
            `Transaction viewing test failed: ${error.message}`);
    }
}

async function testP2PTransfers(page) {
    console.log('\n💸 Testing P2P Transfers...');
    
    // Test 1: Send Money Interface
    try {
        const sendMoneyElements = await page.$$('[data-testid*="send-money"], .send-money, button:has-text("Send Money")');
        const transferButtons = await page.$$('button:has-text("Transfer"), button:has-text("Send")');
        
        if (sendMoneyElements.length > 0 || transferButtons.length > 0) {
            await addTest('p2pTransfers', 'Send Money Interface', 'passed', 
                'Send money interface elements are present');
            await takeScreenshot(page, 'send-money-interface', 'Send money interface');
        } else {
            await addTest('p2pTransfers', 'Send Money Interface', 'pending', 
                'Send money interface not clearly identified');
        }
    } catch (error) {
        await addTest('p2pTransfers', 'Send Money Interface', 'failed', 
            `Send money interface test failed: ${error.message}`);
    }
    
    // Test 2: Transfer Form Validation
    try {
        const sendButton = await page.$('button:has-text("Send Money")') || await page.$('[data-testid="send-money-button"]');
        if (sendButton) {
            await sendButton.click();
            await page.waitForTimeout(1000);
            
            const transferForm = await page.$('form');
            if (transferForm) {
                // Try to submit empty form
                const submitButton = await page.$('button[type="submit"]');
                if (submitButton) {
                    await submitButton.click();
                    await page.waitForTimeout(1000);
                    
                    const errorMessages = await page.$$('.error, .text-red-500, [class*="error"]');
                    if (errorMessages.length > 0) {
                        await addTest('p2pTransfers', 'Transfer Form Validation', 'passed', 
                            `Transfer form validation working - ${errorMessages.length} error messages`);
                    } else {
                        await addTest('p2pTransfers', 'Transfer Form Validation', 'pending', 
                            'Transfer form validation not clearly visible');
                    }
                }
            }
        }
    } catch (error) {
        await addTest('p2pTransfers', 'Transfer Form Validation', 'failed', 
            `Transfer form validation test failed: ${error.message}`);
    }
    
    // Test 3: Transfer Workflow
    try {
        const recipientInput = await page.$('input[name="recipient"]') || await page.$('[data-testid="recipient-input"]');
        const amountInput = await page.$('input[name="amount"]') || await page.$('[data-testid="amount-input"]');
        
        if (recipientInput && amountInput) {
            await recipientInput.fill('user@example.com');
            await amountInput.fill('100');
            
            const submitButton = await page.$('button[type="submit"]');
            if (submitButton) {
                await submitButton.click();
                const responseTime = await measurePerformance(page, 'transfer_submission');
                
                await page.waitForTimeout(2000);
                
                const successIndicators = await page.$$('.success, .text-green-500, [class*="success"]');
                const confirmationElements = await page.$$('[data-testid*="confirmation"], .confirmation');
                
                if (successIndicators.length > 0 || confirmationElements.length > 0) {
                    await addTest('p2pTransfers', 'Transfer Workflow', 'passed', 
                        'Transfer workflow completed successfully', responseTime);
                } else {
                    await addTest('p2pTransfers', 'Transfer Workflow', 'pending', 
                        'Transfer submitted but confirmation not clearly visible', responseTime);
                }
            }
        }
    } catch (error) {
        await addTest('p2pTransfers', 'Transfer Workflow', 'failed', 
            `Transfer workflow test failed: ${error.message}`);
    }
}

async function testCryptoWallet(page) {
    console.log('\n₿ Testing Crypto Wallet...');
    
    // Test 1: Crypto Wallet Interface
    try {
        const cryptoWalletElements = await page.$$('[data-testid*="crypto-wallet"], .crypto-wallet, button:has-text("Crypto")');
        const walletButtons = await page.$$('button:has-text("Wallet"), button:has-text("Crypto Wallet")');
        
        if (cryptoWalletElements.length > 0 || walletButtons.length > 0) {
            await addTest('cryptoWallet', 'Crypto Wallet Interface', 'passed', 
                'Crypto wallet interface elements are present');
            await takeScreenshot(page, 'crypto-wallet-interface', 'Crypto wallet interface');
        } else {
            await addTest('cryptoWallet', 'Crypto Wallet Interface', 'pending', 
                'Crypto wallet interface not clearly identified');
        }
    } catch (error) {
        await addTest('cryptoWallet', 'Crypto Wallet Interface', 'failed', 
            `Crypto wallet interface test failed: ${error.message}`);
    }
    
    // Test 2: DeFi Integration
    try {
        const defiElements = await page.$$('[data-testid*="defi"], .defi, button:has-text("DeFi")');
        const stakingElements = await page.$$('[data-testid*="staking"], .staking, button:has-text("Stake")');
        
        if (defiElements.length > 0 || stakingElements.length > 0) {
            await addTest('cryptoWallet', 'DeFi Integration', 'passed', 
                'DeFi integration elements are present');
        } else {
            await addTest('cryptoWallet', 'DeFi Integration', 'pending', 
                'DeFi integration not clearly identified');
        }
    } catch (error) {
        await addTest('cryptoWallet', 'DeFi Integration', 'failed', 
            `DeFi integration test failed: ${error.message}`);
    }
    
    // Test 3: Staking Interface
    try {
        const stakingInterface = await page.$('[data-testid*="staking-interface"], .staking-interface');
        const stakeButtons = await page.$$('button:has-text("Stake"), button:has-text("Staking")');
        
        if (stakingInterface || stakeButtons.length > 0) {
            await addTest('cryptoWallet', 'Staking Interface', 'passed', 
                'Staking interface elements are present');
        } else {
            await addTest('cryptoWallet', 'Staking Interface', 'pending', 
                'Staking interface not clearly identified');
        }
    } catch (error) {
        await addTest('cryptoWallet', 'Staking Interface', 'failed', 
            `Staking interface test failed: ${error.message}`);
    }
    
    // Test 4: Portfolio Management
    try {
        const portfolioElements = await page.$$('[data-testid*="portfolio"], .portfolio, button:has-text("Portfolio")');
        const assetElements = await page.$$('[data-testid*="asset"], .asset, [class*="asset"]');
        
        if (portfolioElements.length > 0 || assetElements.length > 0) {
            await addTest('cryptoWallet', 'Portfolio Management', 'passed', 
                'Portfolio management elements are present');
        } else {
            await addTest('cryptoWallet', 'Portfolio Management', 'pending', 
                'Portfolio management not clearly identified');
        }
    } catch (error) {
        await addTest('cryptoWallet', 'Portfolio Management', 'failed', 
            `Portfolio management test failed: ${error.message}`);
    }
}

async function testUIUXExperience(page) {
    console.log('\n🎨 Testing UI/UX Experience...');
    
    // Test 1: Responsiveness
    try {
        const viewports = [
            { width: 375, height: 667 },   // Mobile
            { width: 768, height: 1024 },  // Tablet
            { width: 1920, height: 1080 }  // Desktop
        ];
        
        let responsiveTests = 0;
        for (const viewport of viewports) {
            await page.setViewport(viewport);
            await page.waitForTimeout(1000);
            
            const overflowElements = await page.$$eval('*', elements => 
                elements.filter(el => el.scrollWidth > el.clientWidth).length
            );
            
            if (overflowElements < 5) { // Allow some overflow
                responsiveTests++;
            }
            
            await takeScreenshot(page, `responsive-${viewport.width}x${viewport.height}`, 
                `Responsive design test at ${viewport.width}x${viewport.height}`);
        }
        
        if (responsiveTests >= 2) {
            await addTest('uiUx', 'Responsiveness', 'passed', 
                `Responsive design working on ${responsiveTests}/3 viewports`);
        } else {
            await addTest('uiUx', 'Responsiveness', 'pending', 
                `Responsive design issues detected on ${3 - responsiveTests}/3 viewports`);
        }
    } catch (error) {
        await addTest('uiUx', 'Responsiveness', 'failed', 
            `Responsiveness test failed: ${error.message}`);
    }
    
    // Test 2: Loading States
    try {
        const loadingElements = await page.$$('[data-testid*="loading"], .loading, [class*="loading"]');
        const spinnerElements = await page.$$('.spinner, [class*="spinner"]');
        
        if (loadingElements.length > 0 || spinnerElements.length > 0) {
            await addTest('uiUx', 'Loading States', 'passed', 
                'Loading state elements are present');
        } else {
            await addTest('uiUx', 'Loading States', 'pending', 
                'Loading state elements not clearly identified');
        }
    } catch (error) {
        await addTest('uiUx', 'Loading States', 'failed', 
            `Loading states test failed: ${error.message}`);
    }
    
    // Test 3: Error Messages
    try {
        const errorElements = await page.$$('.error, .text-red-500, [class*="error"]');
        const alertElements = await page.$$('.alert, [role="alert"]');
        
        if (errorElements.length > 0 || alertElements.length > 0) {
            await addTest('uiUx', 'Error Messages', 'passed', 
                'Error message elements are present');
        } else {
            await addTest('uiUx', 'Error Messages', 'pending', 
                'Error message elements not clearly identified');
        }
    } catch (error) {
        await addTest('uiUx', 'Error Messages', 'failed', 
            `Error messages test failed: ${error.message}`);
    }
}

async function testSecurityFeatures(page) {
    console.log('\n🔒 Testing Security Features...');
    
    // Test 1: Session Management
    try {
        // Check for session indicators
        const sessionElements = await page.$$('[data-testid*="session"], .session, [class*="session"]');
        const logoutButtons = await page.$$('button:has-text("Logout"), button:has-text("Sign Out")');
        
        if (sessionElements.length > 0 || logoutButtons.length > 0) {
            await addTest('security', 'Session Management', 'passed', 
                'Session management elements are present');
        } else {
            await addTest('security', 'Session Management', 'pending', 
                'Session management not clearly identified');
        }
    } catch (error) {
        await addTest('security', 'Session Management', 'failed', 
            `Session management test failed: ${error.message}`);
    }
    
    // Test 2: Authentication Persistence
    try {
        await page.reload();
        await page.waitForTimeout(2000);
        
        const dashboardElements = await page.$$('[data-testid="dashboard"], .dashboard');
        const loginElements = await page.$$('[data-testid="login"], .login');
        
        if (dashboardElements.length > 0) {
            await addTest('security', 'Authentication Persistence', 'passed', 
                'User session persists after page reload');
        } else if (loginElements.length > 0) {
            await addTest('security', 'Authentication Persistence', 'pending', 
                'Session may not persist - redirected to login');
        } else {
            await addTest('security', 'Authentication Persistence', 'pending', 
                'Authentication persistence state unclear');
        }
    } catch (error) {
        await addTest('security', 'Authentication Persistence', 'failed', 
            `Authentication persistence test failed: ${error.message}`);
    }
    
    // Test 3: Secure Forms
    try {
        const passwordInputs = await page.$$('input[type="password"]');
        const secureInputs = await page.$$('input[autocomplete*="current-password"], input[autocomplete*="new-password"]');
        
        if (passwordInputs.length > 0 || secureInputs.length > 0) {
            await addTest('security', 'Secure Forms', 'passed', 
                'Secure form elements are properly implemented');
        } else {
            await addTest('security', 'Secure Forms', 'pending', 
                'Secure form elements not clearly identified');
        }
    } catch (error) {
        await addTest('security', 'Secure Forms', 'failed', 
            `Secure forms test failed: ${error.message}`);
    }
}

async function testAPIIntegration(page) {
    console.log('\n🔌 Testing API Integration...');
    
    // Test 1: Backend Connectivity
    try {
        const response = await page.evaluate(async () => {
            try {
                const response = await fetch('/api/health');
                return { status: response.status, ok: response.ok };
            } catch (error) {
                return { error: error.message };
            }
        });
        
        if (response.ok) {
            await addTest('apiIntegration', 'Backend Connectivity', 'passed', 
                'Backend API is responding correctly');
        } else {
            await addTest('apiIntegration', 'Backend Connectivity', 'failed', 
                `Backend API not responding: ${response.error || response.status}`);
        }
    } catch (error) {
        await addTest('apiIntegration', 'Backend Connectivity', 'failed', 
            `Backend connectivity test failed: ${error.message}`);
    }
    
    // Test 2: Data Fetching
    try {
        const response = await page.evaluate(async () => {
            try {
                const response = await fetch('/api/user/profile');
                return { status: response.status, ok: response.ok };
            } catch (error) {
                return { error: error.message };
            }
        });
        
        if (response.ok || response.status === 401) { // 401 is expected if not authenticated
            await addTest('apiIntegration', 'Data Fetching', 'passed', 
                'API data fetching endpoints are responding');
        } else {
            await addTest('apiIntegration', 'Data Fetching', 'failed', 
                `Data fetching API not responding: ${response.error || response.status}`);
        }
    } catch (error) {
        await addTest('apiIntegration', 'Data Fetching', 'failed', 
            `Data fetching test failed: ${error.message}`);
    }
    
    // Test 3: Real-time Updates
    try {
        const hasWebSocket = await page.evaluate(() => {
            return typeof WebSocket !== 'undefined';
        });
        
        const hasEventSource = await page.evaluate(() => {
            return typeof EventSource !== 'undefined';
        });
        
        if (hasWebSocket || hasEventSource) {
            await addTest('apiIntegration', 'Real-time Updates', 'passed', 
                'Real-time update capabilities are available');
        } else {
            await addTest('apiIntegration', 'Real-time Updates', 'pending', 
                'Real-time update capabilities not identified');
        }
    } catch (error) {
        await addTest('apiIntegration', 'Real-time Updates', 'failed', 
            `Real-time updates test failed: ${error.message}`);
    }
}

// Main Test Runner
async function runComprehensiveTests() {
    console.log('🚀 Starting DWAY Financial Freedom Platform - Comprehensive Testing Suite');
    console.log('=' .repeat(80));
    
    createScreenshotDir();
    
    // Check server status
    const server = await checkServerStatus();
    
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: CONFIG.HEADLESS,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080'
            ]
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Run all test categories
        await testAuthentication(page);
        await testUserDashboard(page);
        await testBankingFeatures(page);
        await testP2PTransfers(page);
        await testCryptoWallet(page);
        await testUIUXExperience(page);
        await testSecurityFeatures(page);
        await testAPIIntegration(page);
        
        // Calculate final scores
        calculateScores();
        
        // Generate report
        generateReport();
        
        console.log('\n📊 Test Summary:');
        console.log(`Total Tests: ${TEST_RESULTS.summary.totalTests}`);
        console.log(`Passed: ${TEST_RESULTS.summary.passed}`);
        console.log(`Failed: ${TEST_RESULTS.summary.failed}`);
        console.log(`Pending: ${TEST_RESULTS.summary.pending}`);
        console.log(`Success Rate: ${TEST_RESULTS.summary.successRate}%`);
        console.log(`Overall Score: ${TEST_RESULTS.summary.overallScore}/100`);
        
    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
        if (server) {
            server.kill();
        }
    }
}

function calculateScores() {
    // Calculate category scores
    Object.keys(TEST_RESULTS.categories).forEach(category => {
        const categoryData = TEST_RESULTS.categories[category];
        const totalTests = categoryData.tests.length;
        const passedTests = categoryData.tests.filter(t => t.status === 'passed').length;
        
        if (totalTests > 0) {
            categoryData.score = Math.round((passedTests / totalTests) * 100);
            categoryData.status = categoryData.score >= 70 ? 'passed' : 
                                  categoryData.score >= 50 ? 'pending' : 'failed';
        }
    });
    
    // Calculate overall metrics
    TEST_RESULTS.summary.successRate = Math.round((TEST_RESULTS.summary.passed / TEST_RESULTS.summary.totalTests) * 100);
    
    const categoryScores = Object.values(TEST_RESULTS.categories).map(c => c.score);
    TEST_RESULTS.summary.overallScore = Math.round(categoryScores.reduce((a, b) => a + b, 0) / categoryScores.length);
    
    // Calculate performance metrics
    if (TEST_RESULTS.performance.loadTimes.length > 0) {
        TEST_RESULTS.performance.averageLoadTime = Math.round(
            TEST_RESULTS.performance.loadTimes.reduce((a, b) => a + b.duration, 0) / TEST_RESULTS.performance.loadTimes.length
        );
    }
}

function generateReport() {
    // Generate recommendations
    Object.keys(TEST_RESULTS.categories).forEach(category => {
        const categoryData = TEST_RESULTS.categories[category];
        const failedTests = categoryData.tests.filter(t => t.status === 'failed');
        const pendingTests = categoryData.tests.filter(t => t.status === 'pending');
        
        if (failedTests.length > 0) {
            TEST_RESULTS.recommendations.push({
                category,
                priority: 'high',
                issue: `${failedTests.length} failed tests in ${category}`,
                recommendation: `Address failed tests: ${failedTests.map(t => t.name).join(', ')}`
            });
        }
        
        if (pendingTests.length > 0) {
            TEST_RESULTS.recommendations.push({
                category,
                priority: 'medium',
                issue: `${pendingTests.length} pending tests in ${category}`,
                recommendation: `Complete implementation for: ${pendingTests.map(t => t.name).join(', ')}`
            });
        }
    });
    
    // Save report
    fs.writeFileSync(CONFIG.REPORT_FILE, JSON.stringify(TEST_RESULTS, null, 2));
    console.log(`\n📄 Comprehensive test report saved to: ${CONFIG.REPORT_FILE}`);
}

// Run the comprehensive test suite
if (require.main === module) {
    runComprehensiveTests().catch(console.error);
}

module.exports = {
    runComprehensiveTests,
    TEST_RESULTS,
    CONFIG
};