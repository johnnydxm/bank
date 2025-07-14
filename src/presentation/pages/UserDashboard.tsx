import React, { useState, useEffect } from 'react';
import { BalanceOverview } from '../components/dashboard/BalanceOverview';
import { BalanceChart } from '../components/dashboard/BalanceChart';
import { TransactionTable } from '../components/transactions/TransactionTable';
import { MultiCurrencyBalance } from '../components/currency/MultiCurrencyBalance';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../hooks/useAuth';

interface UserAccount {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'investment' | 'crypto';
  currency: string;
  balance: number;
  formattedBalance: string;
}

interface RecentTransaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'payment';
  amount: number;
  currency: string;
  description: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

export const UserDashboard: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);

  // Mock data - replace with real API calls
  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      
      // Mock accounts data
      const mockAccounts: UserAccount[] = [
        {
          id: 'acc_1',
          name: 'Main Checking',
          type: 'checking',
          currency: 'USD',
          balance: 5420.50,
          formattedBalance: '$5,420.50'
        },
        {
          id: 'acc_2',
          name: 'Crypto Wallet',
          type: 'crypto',
          currency: 'BTC',
          balance: 0.15,
          formattedBalance: '0.15 BTC'
        },
        {
          id: 'acc_3',
          name: 'Euro Savings',
          type: 'savings',
          currency: 'EUR',
          balance: 2800.00,
          formattedBalance: '€2,800.00'
        }
      ];

      // Mock transactions
      const mockTransactions: RecentTransaction[] = [
        {
          id: 'tx_1',
          type: 'deposit',
          amount: 1200.00,
          currency: 'USD',
          description: 'Salary deposit',
          date: '2025-07-14T10:30:00Z',
          status: 'completed'
        },
        {
          id: 'tx_2',
          type: 'transfer',
          amount: -250.00,
          currency: 'USD',
          description: 'Transfer to John Doe',
          date: '2025-07-13T15:45:00Z',
          status: 'completed'
        },
        {
          id: 'tx_3',
          type: 'payment',
          amount: -89.99,
          currency: 'USD',
          description: 'Online purchase - Amazon',
          date: '2025-07-13T09:20:00Z',
          status: 'completed'
        },
        {
          id: 'tx_4',
          type: 'deposit',
          amount: 0.05,
          currency: 'BTC',
          description: 'DeFi staking rewards',
          date: '2025-07-12T18:00:00Z',
          status: 'completed'
        }
      ];

      setAccounts(mockAccounts);
      setTransactions(mockTransactions);
      setTotalBalance(5420.50); // Calculate from accounts
      setLoading(false);
    };

    if (isAuthenticated) {
      fetchUserData();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Please sign in</h2>
          <p className="text-gray-600">You need to be authenticated to access your dashboard.</p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back, {user?.firstName || 'User'}
              </h1>
              <p className="text-gray-600 mt-1">Manage your finances with ease</p>
            </div>
            <div className="flex space-x-4">
              <Button variant="outline">
                Settings
              </Button>
              <Button>
                + New Transfer
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Balance Overview Section */}
        <div className="mb-8">
          <BalanceOverview 
            totalBalance={totalBalance}
            currency={selectedCurrency}
            accounts={accounts}
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" className="flex flex-col items-center p-4 h-24">
                <span className="text-2xl mb-2">💸</span>
                <span className="text-sm">Send Money</span>
              </Button>
              <Button variant="outline" className="flex flex-col items-center p-4 h-24">
                <span className="text-2xl mb-2">📥</span>
                <span className="text-sm">Deposit</span>
              </Button>
              <Button variant="outline" className="flex flex-col items-center p-4 h-24">
                <span className="text-2xl mb-2">🔄</span>
                <span className="text-sm">Exchange</span>
              </Button>
              <Button variant="outline" className="flex flex-col items-center p-4 h-24">
                <span className="text-2xl mb-2">⛓️</span>
                <span className="text-sm">DeFi</span>
              </Button>
            </div>
          </Card>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Accounts & Balance */}
          <div className="lg:col-span-2 space-y-6">
            {/* Multi-Currency Balance */}
            <MultiCurrencyBalance accounts={accounts} />

            {/* Balance Chart */}
            <BalanceChart />

            {/* Recent Transactions */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Recent Transactions</h3>
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </div>
              <TransactionTable transactions={transactions} />
            </Card>
          </div>

          {/* Right Column - Stats & Info */}
          <div className="space-y-6">
            {/* Account Status */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Account Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">KYC Status</span>
                  <Badge variant="success">Verified</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">2FA Enabled</span>
                  <Badge variant="success">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Account Level</span>
                  <Badge variant="info">Premium</Badge>
                </div>
              </div>
            </Card>

            {/* Monthly Summary */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">This Month</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Income</span>
                    <span className="font-medium text-green-600">+$3,200</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Expenses</span>
                    <span className="font-medium text-red-600">-$1,890</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div className="bg-red-500 h-2 rounded-full" style={{ width: '60%' }}></div>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Net Income</span>
                    <span className="font-semibold text-blue-600">+$1,310</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Crypto Portfolio */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Crypto Portfolio</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold mr-3">
                      B
                    </div>
                    <div>
                      <p className="font-medium">Bitcoin</p>
                      <p className="text-xs text-gray-500">0.15 BTC</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">$6,847.50</p>
                    <p className="text-xs text-green-600">+2.4%</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold mr-3">
                      E
                    </div>
                    <div>
                      <p className="font-medium">Ethereum</p>
                      <p className="text-xs text-gray-500">2.3 ETH</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">$5,520.00</p>
                    <p className="text-xs text-red-600">-1.2%</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};