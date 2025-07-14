const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the React app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint for testing
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        message: 'DWAY Financial Freedom Platform API is running',
        timestamp: new Date().toISOString()
    });
});

// Mock API endpoints for the frontend
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
        { id: 3, description: 'Investment Return', amount: 150.00, date: '2025-07-12', type: 'credit' },
        { id: 4, description: 'Coffee Shop', amount: -4.50, date: '2025-07-11', type: 'debit' },
        { id: 5, description: 'Freelance Payment', amount: 850.00, date: '2025-07-10', type: 'credit' }
    ]);
});

app.post('/api/transfers', (req, res) => {
    // Mock transfer creation
    res.json({
        id: `txn_${Date.now()}`,
        status: 'pending',
        message: 'Transfer initiated successfully'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 DWAY Financial Freedom Platform is running!`);
    console.log(`📱 Frontend: http://localhost:${PORT}`);
    console.log(`🔌 API: http://localhost:${PORT}/api/health`);
    console.log(`💰 Features: User Dashboard, P2P Transfers, Multi-Currency, DeFi Integration`);
    console.log(`\n🎯 Ready for testing! Open your browser and take it for a spin!`);
});