const express = require('express');
const path = require('path');
const cluster = require('cluster');
const os = require('os');

// Production-grade server with clustering and error handling
class DWAYServer {
    constructor() {
        this.app = express();
        this.PORT = process.env.PORT || 3001;
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Security and performance middleware
        this.app.use((req, res, next) => {
            res.header('X-Powered-By', 'DWAY Financial Platform');
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            next();
        });

        // Static file serving with proper headers
        this.app.use(express.static(path.join(__dirname, 'public'), {
            maxAge: '1d',
            etag: true
        }));

        // JSON parsing with size limits
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    }

    setupRoutes() {
        // Health check endpoint - Enhanced with enterprise features
        this.app.get('/api/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                message: 'DWAY Financial Freedom Platform API is running',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                pid: process.pid,
                architecture: 'Enterprise TypeScript + FormanceLedgerService',
                version: '2.0.1',
                formance: {
                    status: 'ready',
                    version: 'v4.3.0',
                    features: ['double-entry-bookkeeping', 'multi-currency', 'enterprise-accounts']
                },
                features: [
                    'FormanceLedgerService Ready',
                    'Multi-Currency Support',
                    'Enterprise Account Management',
                    'P2P Transfer System',
                    'DeFi Integration',
                    'Individual Client Focus'
                ]
            });
        });

        // API endpoints with error handling - Enhanced with enterprise features
        this.app.get('/api/accounts', this.asyncHandler(async (req, res) => {
            // Simulate database query with enterprise account structure
            await this.delay(100);
            res.json([
                { 
                    id: 1, 
                    name: 'Main Checking', 
                    balance: 5420.50, 
                    currency: 'USD',
                    formanceAddress: 'users:test.individual@dway.com:main',
                    accountType: 'individual',
                    features: ['p2p-transfers', 'multi-currency', 'mobile-payments']
                },
                { 
                    id: 2, 
                    name: 'Euro Savings', 
                    balance: 2800.00, 
                    currency: 'EUR',
                    formanceAddress: 'users:test.individual@dway.com:savings',
                    accountType: 'savings',
                    features: ['interest-earning', 'multi-currency']
                },
                { 
                    id: 3, 
                    name: 'Crypto Wallet', 
                    balance: 0.15, 
                    currency: 'BTC',
                    formanceAddress: 'users:test.individual@dway.com:crypto',
                    accountType: 'crypto',
                    features: ['defi-integration', 'staking', 'swapping']
                }
            ]);
        }));

        this.app.get('/api/transactions', this.asyncHandler(async (req, res) => {
            await this.delay(150);
            res.json([
                { id: 1, description: 'Salary Deposit', amount: 2500.00, date: '2025-07-14', type: 'credit' },
                { id: 2, description: 'Grocery Store', amount: -85.50, date: '2025-07-13', type: 'debit' },
                { id: 3, description: 'Investment Return', amount: 150.00, date: '2025-07-12', type: 'credit' },
                { id: 4, description: 'Coffee Shop', amount: -4.50, date: '2025-07-11', type: 'debit' },
                { id: 5, description: 'Freelance Payment', amount: 850.00, date: '2025-07-10', type: 'credit' }
            ]);
        }));

        // 🔧 Backend Persona: Enhanced Authentication Endpoints with Enterprise Features
        this.app.post('/api/auth/signup', this.asyncHandler(async (req, res) => {
            const { email, password, firstName, lastName } = req.body;
            
            console.log('🔧 Backend: Signup attempt:', { email, firstName, lastName });
            
            // Enhanced validation
            if (!email || !password || !firstName || !lastName) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    details: 'All fields (email, password, firstName, lastName) are required'
                });
            }
            
            if (password.length < 6) {
                return res.status(400).json({
                    error: 'Password too short',
                    details: 'Password must be at least 6 characters long'
                });
            }
            
            // Generate JWT token (mock implementation) with enterprise features
            const user = {
                id: `user_${Date.now()}`,
                email,
                firstName,
                lastName,
                createdAt: new Date().toISOString(),
                accountAddress: `users:${email}:main`,
                accountType: 'individual',
                features: [
                    'Family sub-accounts',
                    'P2P transfers',
                    'Multi-currency support',
                    'DeFi integration',
                    'Mobile payments'
                ],
                formanceAccount: {
                    address: `users:${email}:main`,
                    type: 'individual-client',
                    permissions: ['transfer', 'receive', 'view-balance']
                }
            };
            
            res.status(201).json({
                success: true,
                user,
                token: `mock_token_${Date.now()}`,
                message: 'Account created successfully'
            });
        }));

        this.app.post('/api/auth/signin', this.asyncHandler(async (req, res) => {
            const { email, password } = req.body;
            
            console.log('🔧 Backend: Signin attempt:', { email });
            
            if (!email || !password) {
                return res.status(400).json({
                    error: 'Missing credentials',
                    details: 'Email and password are required'
                });
            }
            
            // Mock authentication with enterprise features
            const user = {
                id: `user_${Date.now()}`,
                email,
                firstName: 'John',
                lastName: 'Doe',
                accountAddress: `users:${email}:main`,
                accountType: 'individual',
                features: [
                    'Family sub-accounts',
                    'P2P transfers',
                    'Multi-currency support',
                    'DeFi integration',
                    'Mobile payments'
                ],
                formanceAccount: {
                    address: `users:${email}:main`,
                    type: 'individual-client',
                    permissions: ['transfer', 'receive', 'view-balance']
                }
            };
            
            res.json({
                success: true,
                user,
                token: `mock_token_${Date.now()}`,
                message: 'Signed in successfully'
            });
        }));

        this.app.post('/api/transfers', this.asyncHandler(async (req, res) => {
            const { recipient, amount, currency, description } = req.body;
            
            // Validate required fields
            if (!recipient || !amount || !currency) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    details: 'Recipient, amount, and currency are required'
                });
            }
            
            // Validate amount
            if (typeof amount !== 'number' || amount <= 0) {
                return res.status(400).json({
                    error: 'Invalid amount',
                    details: 'Amount must be a positive number'
                });
            }
            
            // Validate currency
            const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'BTC', 'ETH', 'USDC', 'USDT'];
            if (!validCurrencies.includes(currency.toUpperCase())) {
                return res.status(400).json({
                    error: 'Invalid currency',
                    details: `Currency must be one of: ${validCurrencies.join(', ')}`
                });
            }
            
            // Validate recipient format (enterprise pattern)
            if (typeof recipient !== 'string' || recipient.trim().length === 0) {
                return res.status(400).json({
                    error: 'Invalid recipient',
                    details: 'Recipient must be a non-empty string'
                });
            }
            
            await this.delay(200);
            
            // Create FormanceLedgerService transaction structure
            const formanceTransaction = {
                source: `users:sender@dway.com:main`,
                destination: `users:${recipient}:main`,
                asset: currency.toUpperCase(),
                amount: (parseFloat(amount) * 100).toString(), // Convert to cents for precision
                metadata: {
                    description: description || 'P2P Transfer',
                    type: 'p2p-transfer',
                    timestamp: new Date().toISOString()
                }
            };
            
            res.json({
                id: `txn_${Date.now()}`,
                recipient,
                amount: parseFloat(amount),
                currency: currency.toUpperCase(),
                description: description || 'P2P Transfer',
                status: 'pending',
                message: 'Transfer initiated successfully',
                timestamp: new Date().toISOString(),
                transfer: {
                    id: `txn_${Date.now()}`,
                    recipient,
                    amount: parseFloat(amount),
                    currency: currency.toUpperCase(),
                    formanceTransaction
                }
            });
        }));

        // Exchange rates endpoint - Enhanced with enterprise features
        this.app.get('/api/exchange-rates', this.asyncHandler(async (req, res) => {
            await this.delay(50);
            res.json({
                base: 'USD',
                rates: {
                    EUR: 0.85,
                    GBP: 0.73,
                    JPY: 110.0,
                    BTC: 0.000015,
                    ETH: 0.0005,
                    USDC: 1.0,
                    USDT: 1.0
                },
                lastUpdated: new Date().toISOString(),
                source: 'FormanceExchangeRateService',
                providers: [
                    'CoinGecko',
                    'CoinMarketCap',
                    'Binance',
                    'Kraken',
                    'ExchangeRate-API'
                ],
                features: [
                    'Real-time rates',
                    'Multiple providers',
                    'Failover support',
                    'Rate history',
                    'Conversion calculator'
                ]
            });
        }));

        // Crypto portfolio endpoint - Enhanced with enterprise features
        this.app.get('/api/crypto/portfolio', this.asyncHandler(async (req, res) => {
            await this.delay(100);
            res.json({
                totalValue: 12450.75,
                totalValueUSD: 12450.75,
                assets: [
                    { symbol: 'BTC', amount: 0.15, valueUSD: 6750.00, change24h: 2.5 },
                    { symbol: 'ETH', amount: 2.3, valueUSD: 4600.00, change24h: -1.2 },
                    { symbol: 'USDC', amount: 1100.75, valueUSD: 1100.75, change24h: 0.0 }
                ],
                staking: [
                    { protocol: 'Ethereum 2.0', amount: 1.0, apy: 4.2, rewards: 0.042 },
                    { protocol: 'Polygon', amount: 500, apy: 8.5, rewards: 42.5 }
                ],
                source: 'FormanceCryptoService',
                features: [
                    'DeFi integration',
                    'Staking rewards',
                    'Multi-chain support',
                    'Gas optimization',
                    'Real-time valuation'
                ],
                formanceAccounts: [
                    { address: 'users:test.individual@dway.com:crypto', type: 'crypto-wallet' },
                    { address: 'users:test.individual@dway.com:staking', type: 'staking-account' }
                ]
            });
        }));

        // Additional enterprise endpoints for comprehensive coverage
        this.app.get('/api/user/profile', this.asyncHandler(async (req, res) => {
            await this.delay(50);
            res.json({
                id: 'user_12345',
                email: 'test.individual@dway.com',
                firstName: 'John',
                lastName: 'Doe',
                accountAddress: 'users:test.individual@dway.com:main',
                accountType: 'individual',
                tier: 'premium',
                features: [
                    'Family sub-accounts',
                    'P2P transfers',
                    'Multi-currency support',
                    'DeFi integration',
                    'Mobile payments',
                    'Premium analytics'
                ],
                formanceIntegration: {
                    status: 'active',
                    ledgerVersion: 'v4.3.0',
                    accountsCreated: 3,
                    lastSync: new Date().toISOString()
                }
            });
        }));

        this.app.get('/api/notifications', this.asyncHandler(async (req, res) => {
            await this.delay(75);
            res.json({
                notifications: [
                    {
                        id: 'notif_1',
                        type: 'transfer-received',
                        title: 'Payment Received',
                        message: 'You received $150 from family.member@dway.com',
                        timestamp: new Date().toISOString(),
                        read: false
                    },
                    {
                        id: 'notif_2',
                        type: 'staking-reward',
                        title: 'Staking Reward',
                        message: 'Your ETH staking earned 0.042 ETH',
                        timestamp: new Date().toISOString(),
                        read: false
                    }
                ],
                unreadCount: 2,
                enterpriseFeatures: [
                    'Real-time notifications',
                    'Transaction alerts',
                    'Staking rewards',
                    'Security alerts'
                ]
            });
        }));

        this.app.post('/api/crypto/stake', this.asyncHandler(async (req, res) => {
            const { asset, amount, protocol } = req.body;
            
            if (!asset || !amount || !protocol) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    details: 'Asset, amount, and protocol are required'
                });
            }
            
            await this.delay(150);
            res.json({
                stakeId: `stake_${Date.now()}`,
                asset,
                amount: parseFloat(amount),
                protocol,
                status: 'pending',
                estimatedRewards: parseFloat(amount) * 0.05, // 5% APY
                formanceTransaction: {
                    source: 'users:test.individual@dway.com:main',
                    destination: `staking:${protocol}:pool`,
                    asset,
                    amount: (parseFloat(amount) * 100).toString(),
                    metadata: {
                        type: 'staking',
                        protocol,
                        timestamp: new Date().toISOString()
                    }
                }
            });
        }));

        this.app.get('/api/analytics/portfolio', this.asyncHandler(async (req, res) => {
            await this.delay(100);
            res.json({
                totalValue: 25847.50,
                totalValueUSD: 25847.50,
                performance: {
                    '1d': 2.3,
                    '7d': 8.1,
                    '30d': 15.7,
                    '90d': 32.4
                },
                allocation: {
                    'Traditional': 45.2,
                    'Crypto': 32.8,
                    'Staking': 15.5,
                    'Cash': 6.5
                },
                riskScore: 7.2,
                diversificationScore: 8.5,
                formanceAnalytics: {
                    accountsAnalyzed: 3,
                    transactionsProcessed: 147,
                    lastAnalysis: new Date().toISOString()
                }
            });
        }));

        // Serve React app for all other routes
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });
    }

    setupErrorHandling() {
        // Global error handler
        this.app.use((err, req, res, next) => {
            console.error(`Error: ${err.message}`);
            console.error(`Stack: ${err.stack}`);
            
            res.status(500).json({
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
            });
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Not found',
                message: 'The requested resource was not found'
            });
        });
    }

    // Async error handler wrapper
    asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    // Utility delay function
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    start() {
        const server = this.app.listen(this.PORT, () => {
            console.log(`🚀 DWAY Financial Freedom Platform is running!`);
            console.log(`📱 Frontend: http://localhost:${this.PORT}`);
            console.log(`🔌 API: http://localhost:${this.PORT}/api/health`);
            console.log(`💰 Features: User Dashboard, P2P Transfers, Multi-Currency, DeFi Integration`);
            console.log(`🔧 Process ID: ${process.pid}`);
            console.log(`🎯 Ready for testing! Open your browser and take it for a spin!`);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('🛑 SIGTERM received, shutting down gracefully');
            server.close(() => {
                console.log('✅ Server closed');
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            console.log('🛑 SIGINT received, shutting down gracefully');
            server.close(() => {
                console.log('✅ Server closed');
                process.exit(0);
            });
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (err) => {
            console.error('🔴 Uncaught Exception:', err);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('🔴 Unhandled Rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });

        return server;
    }
}

// Cluster management for production
if (cluster.isMaster) {
    const numCPUs = os.cpus().length;
    const workers = Math.min(numCPUs, 2); // Limit to 2 workers for demo

    console.log(`🔄 Starting ${workers} workers...`);

    for (let i = 0; i < workers; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`🔄 Worker ${worker.process.pid} died. Restarting...`);
        cluster.fork();
    });

    // Health monitoring
    setInterval(() => {
        console.log(`📊 Active workers: ${Object.keys(cluster.workers).length}`);
    }, 30000);

} else {
    // Worker process
    const server = new DWAYServer();
    server.start();
}

module.exports = DWAYServer;