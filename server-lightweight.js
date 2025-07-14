const express = require('express');
const path = require('path');

// Lightweight server optimized for resource efficiency
const app = express();
const PORT = process.env.PORT || 3001;

// Minimal middleware for performance
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: 0, // No caching to reduce memory usage
    etag: false
}));

app.use(express.json({ limit: '1mb' })); // Reduced payload limit

// Simplified health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
        }
    });
});

// Authentication API endpoints
app.post('/api/auth/signup', (req, res) => {
    console.log('📝 Registration attempt:', req.body);
    
    const { email, password, firstName, lastName } = req.body;
    
    // Basic validation
    if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({
            error: 'All fields are required'
        });
    }
    
    if (password.length < 6) {
        return res.status(400).json({
            error: 'Password must be at least 6 characters'
        });
    }
    
    // Simulate user creation
    const newUser = {
        id: Date.now(),
        email,
        firstName,
        lastName,
        createdAt: new Date().toISOString()
    };
    
    console.log('✅ User registered:', newUser);
    
    res.status(201).json({
        success: true,
        message: 'Account created successfully',
        user: newUser
    });
});

app.post('/api/auth/signin', (req, res) => {
    console.log('🔐 Login attempt:', req.body);
    
    const { email, password } = req.body;
    
    // Basic validation
    if (!email || !password) {
        return res.status(400).json({
            error: 'Email and password are required'
        });
    }
    
    // Simulate user authentication
    const user = {
        id: Date.now(),
        email,
        firstName: 'John',
        lastName: 'Doe'
    };
    
    console.log('✅ User authenticated:', user);
    
    res.json({
        success: true,
        message: 'Authentication successful',
        user
    });
});

app.get('/api/auth/me', (req, res) => {
    // Simulate getting current user
    res.json({
        id: Date.now(),
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe'
    });
});

// Mock API endpoints with minimal processing
app.get('/api/accounts', (req, res) => {
    res.json([
        { id: 1, name: 'Main Checking', balance: 5420.50, currency: 'USD' },
        { id: 2, name: 'Euro Savings', balance: 2800.00, currency: 'EUR' },
        { id: 3, name: 'Crypto Wallet', balance: 0.15, currency: 'BTC' }
    ]);
});

app.get('/api/transactions', (req, res) => {
    res.json([
        { id: 1, description: 'Salary Deposit', amount: 2500.00, date: '2025-07-14', type: 'credit' },
        { id: 2, description: 'Grocery Store', amount: -85.50, date: '2025-07-13', type: 'debit' },
        { id: 3, description: 'Investment Return', amount: 150.00, date: '2025-07-12', type: 'credit' }
    ]);
});

app.post('/api/transfers', (req, res) => {
    res.json({
        id: `txn_${Date.now()}`,
        status: 'pending',
        message: 'Transfer initiated successfully'
    });
});

// Serve React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Simple error handling
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
});

// Memory monitoring
setInterval(() => {
    const memUsage = process.memoryUsage();
    const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    if (memMB > 100) { // Alert if using more than 100MB
        console.log(`⚠️  High memory usage: ${memMB}MB`);
    }
}, 10000);

// Start server with error handling
const server = app.listen(PORT, () => {
    console.log(`🚀 DWAY Platform (Lightweight) running on port ${PORT}`);
    console.log(`📱 Frontend: http://localhost:${PORT}`);
    console.log(`🔋 Resource-optimized for stability`);
    console.log(`💾 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Graceful shutdown initiated');
    server.close(() => {
        console.log('✅ Server closed cleanly');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 Shutdown requested');
    server.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('🔴 Uncaught Exception:', err.message);
    process.exit(1);
});

module.exports = app;