'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Eye, EyeOff } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { formatCurrency } from '../../../shared/utils/formatters';
import { AnimatedCounter } from '../ui/AnimatedCounter';
import { BalanceChart } from './BalanceChart';

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  lastUpdated: Date;
}

interface BalanceOverviewProps {
  accounts: Account[];
  totalBalance: number;
  currency: string;
  showBalance: boolean;
  onToggleVisibility: () => void;
  className?: string;
}

export const BalanceOverview: React.FC<BalanceOverviewProps> = ({
  accounts,
  totalBalance,
  currency,
  showBalance,
  onToggleVisibility,
  className = ''
}) => {
  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter(acc => acc.balance > 0).length;
  
  // Calculate 24h change (mock data - in real app this would come from API)
  const yesterdayBalance = totalBalance * 0.98; // Mock 2% increase
  const balanceChange = totalBalance - yesterdayBalance;
  const balanceChangePercent = (balanceChange / yesterdayBalance) * 100;
  const isPositiveChange = balanceChange >= 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Balance Card */}
      <Card className="p-6 bg-gradient-to-br from-blue-600 to-purple-700 text-white">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-medium opacity-90 mb-2">
              Total Balance
            </h2>
            <div className="flex items-center space-x-3">
              {showBalance ? (
                <AnimatedCounter
                  value={totalBalance}
                  currency={currency}
                  className="text-3xl font-bold"
                />
              ) : (
                <div className="text-3xl font-bold">••••••••</div>
              )}
              <Button
                onClick={onToggleVisibility}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20 p-2"
              >
                {showBalance ? <EyeOff size={20} /> : <Eye size={20} />}
              </Button>
            </div>
          </div>
          
          {showBalance && (
            <div className="text-right">
              <div className={`flex items-center space-x-1 ${isPositiveChange ? 'text-green-300' : 'text-red-300'}`}>
                {isPositiveChange ? (
                  <TrendingUp size={16} />
                ) : (
                  <TrendingDown size={16} />
                )}
                <span className="text-sm font-medium">
                  {isPositiveChange ? '+' : ''}{balanceChangePercent.toFixed(2)}%
                </span>
              </div>
              <div className="text-sm opacity-90">
                {isPositiveChange ? '+' : ''}{formatCurrency(balanceChange, currency)} (24h)
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="text-sm opacity-90 mb-1">Active Accounts</div>
            <div className="text-xl font-semibold">{activeAccounts}</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="text-sm opacity-90 mb-1">Total Accounts</div>
            <div className="text-xl font-semibold">{totalAccounts}</div>
          </div>
        </div>
      </Card>

      {/* Account Breakdown */}
      {showBalance && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Balance Chart */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Balance Distribution
            </h3>
            <BalanceChart accounts={accounts} />
          </Card>

          {/* Account List */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Account Details
            </h3>
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {account.name}
                    </div>
                    <div className="text-sm text-gray-500 capitalize">
                      {account.type} • {account.currency}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      {formatCurrency(account.balance, account.currency)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Updated {account.lastUpdated.toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};