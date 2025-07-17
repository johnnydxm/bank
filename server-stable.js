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
        // Health check endpoint
        this.app.get('/api/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                message: 'DWAY Financial Freedom Platform API is running',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                pid: process.pid
            });
        });

        // API endpoints with error handling
        this.app.get('/api/accounts', this.asyncHandler(async (req, res) => {
            // Simulate database query
            await this.delay(100);
            res.json([
                { id: 1, name: 'Main Checking', balance: 5420.50, currency: 'USD' },
                { id: 2, name: 'Euro Savings', balance: 2800.00, currency: 'EUR' },
                { id: 3, name: 'Crypto Wallet', balance: 0.15, currency: 'BTC' }
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

        // 🔧 Backend Persona: Enhanced Authentication Endpoints
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
            
            // Generate JWT token (mock implementation)
            const user = {
                id: `user_${Date.now()}`,
                email,
                firstName,
                lastName,
                createdAt: new Date().toISOString(),
                accountAddress: `users:${email}:main`
            };
            
            res.json({
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
            
            // Mock authentication
            const user = {
                id: `user_${Date.now()}`,
                email,
                firstName: 'John',
                lastName: 'Doe',
                accountAddress: `users:${email}:main`
            };
            
            res.json({
                success: true,
                user,
                token: `mock_token_${Date.now()}`,
                message: 'Signed in successfully'
            });
        }));

        this.app.post('/api/transfers', this.asyncHandler(async (req, res) => {
            await this.delay(200);
            res.json({
                id: `txn_${Date.now()}`,
                status: 'pending',
                message: 'Transfer initiated successfully',
                timestamp: new Date().toISOString()
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