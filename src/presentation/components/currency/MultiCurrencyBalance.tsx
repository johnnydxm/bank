import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { CurrencyFormatter, PortfolioCalculator } from '../../../shared/utils/currencyUtils';
import { SupportedCurrencies } from '../../../domains/currency/entities/Currency';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Eye, 
  EyeOff,
  PieChart,
  RefreshCw 
} from 'lucide-react';

interface MultiCurrencyBalanceProps {
  userId: string;
  onAddCurrency?: () => void;
  onConvertCurrency?: (currency: string) => void;
  className?: string;
}

interface CurrencyBalance {
  currency: string;
  balance: bigint;
  formattedBalance: string;
  usdEquivalent: bigint;
  formattedUsdEquivalent: string;
  percentage: number;
  change24h?: number;
}

interface PortfolioSummary {
  totalValue: string;
  currencyCount: number;
  diversificationScore: number;
  riskScore: number;
  largestHolding: {
    currency: string;
    percentage: number;
  };
}

export const MultiCurrencyBalance: React.FC<MultiCurrencyBalanceProps> = ({
  userId,
  onAddCurrency,
  onConvertCurrency,
  className = ''
}) => {
  const [balances, setBalances] = useState<CurrencyBalance[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showZeroBalances, setShowZeroBalances] = useState(false);
  const [hideBalances, setHideBalances] = useState(false);
  const [error, setError] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    fetchBalances();
  }, [userId]);

  const fetchBalances = async () => {
    setIsLoading(true);
    setError('');

    try {
      // This would call your multi-currency account service
      const mockBalances = await fetchMockBalances();
      setBalances(mockBalances);
      
      const summary = calculatePortfolioSummary(mockBalances);
      setPortfolioSummary(summary);
      
      setLastUpdated(new Date());
    } catch (err) {
      setError(`Failed to fetch balances: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePortfolioSummary = (balances: CurrencyBalance[]): PortfolioSummary => {
    const totalUsdValue = balances.reduce((sum, b) => sum + b.usdEquivalent, BigInt(0));
    
    // Find largest holding
    let largestValue = BigInt(0);
    let largestCurrency = '';
    let largestPercentage = 0;
    
    for (const balance of balances) {
      if (balance.usdEquivalent > largestValue) {
        largestValue = balance.usdEquivalent;
        largestCurrency = balance.currency;
        largestPercentage = balance.percentage;
      }
    }

    // Calculate diversification score
    const diversificationScore = PortfolioCalculator.calculateDiversificationScore(
      balances.map(b => ({
        currency: b.currency,
        amount: b.balance,
        usdEquivalent: b.usdEquivalent
      }))
    );

    // Calculate risk score
    const riskScore = PortfolioCalculator.calculateRiskScore(
      balances.map(b => ({
        currency: b.currency,
        amount: b.balance,
        usdEquivalent: b.usdEquivalent
      }))
    );

    return {
      totalValue: CurrencyFormatter.formatAmount(totalUsdValue, 'USD'),
      currencyCount: balances.filter(b => b.balance > BigInt(0)).length,
      diversificationScore: Math.round(diversificationScore),
      riskScore: Math.round(riskScore),
      largestHolding: {
        currency: largestCurrency,
        percentage: largestPercentage
      }
    };
  };

  const getCurrencyIcon = (currency: string) => {
    const currencyInfo = CurrencyFormatter.getCurrencyInfo(currency);
    if (currencyInfo?.type === 'crypto') {
      return '₿'; // Generic crypto symbol
    }
    return currencyInfo?.symbol || currency;
  };

  const getChangeColor = (change?: number) => {
    if (!change) return 'text-gray-500';
    return change >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getChangeIcon = (change?: number) => {
    if (!change) return null;
    return change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />;
  };

  const getRiskColor = (score: number) => {
    if (score < 30) return 'text-green-600';
    if (score < 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDiversificationColor = (score: number) => {
    if (score > 70) return 'text-green-600';
    if (score > 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Mock function (replace with actual service call)
  const fetchMockBalances = async (): Promise<CurrencyBalance[]> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockData = [
      {
        currency: 'USD',
        balance: BigInt(500000), // $5,000.00
        usdEquivalent: BigInt(500000),
        change24h: 0
      },
      {
        currency: 'EUR',
        balance: BigInt(300000), // €3,000.00
        usdEquivalent: BigInt(255000), // $2,550.00
        change24h: -1.2
      },
      {
        currency: 'BTC',
        balance: BigInt(5000000), // 0.05 BTC
        usdEquivalent: BigInt(225000), // $2,250.00
        change24h: 3.5
      },
      {
        currency: 'ETH',
        balance: BigInt('500000000000000000'), // 0.5 ETH
        usdEquivalent: BigInt(150000), // $1,500.00
        change24h: 2.1
      },
      {
        currency: 'USDC',
        balance: BigInt(100000000), // 100 USDC
        usdEquivalent: BigInt(10000), // $100.00
        change24h: 0.1
      }
    ];

    const totalUsdValue = mockData.reduce((sum, item) => sum + item.usdEquivalent, BigInt(0));

    return mockData.map(item => {
      const percentage = totalUsdValue > BigInt(0) 
        ? Number(item.usdEquivalent * BigInt(10000) / totalUsdValue) / 100
        : 0;

      return {
        ...item,
        formattedBalance: CurrencyFormatter.formatAmount(item.balance, item.currency),
        formattedUsdEquivalent: CurrencyFormatter.formatAmount(item.usdEquivalent, 'USD'),
        percentage
      };
    });
  };

  const displayedBalances = showZeroBalances 
    ? balances 
    : balances.filter(b => b.balance > BigInt(0));

  if (isLoading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Portfolio Summary */}
      {portfolioSummary && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <Wallet className="h-5 w-5 mr-2" />
              Portfolio Overview
            </h3>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHideBalances(!hideBalances)}
              >
                {hideBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchBalances}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {hideBalances ? '••••••' : portfolioSummary.totalValue}
              </div>
              <div className="text-sm text-gray-500">Total Value</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{portfolioSummary.currencyCount}</div>
              <div className="text-sm text-gray-500">Currencies</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getDiversificationColor(portfolioSummary.diversificationScore)}`}>
                {portfolioSummary.diversificationScore}%
              </div>
              <div className="text-sm text-gray-500">Diversification</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getRiskColor(portfolioSummary.riskScore)}`}>
                {portfolioSummary.riskScore}%
              </div>
              <div className="text-sm text-gray-500">Risk Score</div>
            </div>
          </div>

          {portfolioSummary.largestHolding.currency && (
            <div className="mt-4 text-sm text-gray-600">
              Largest holding: {portfolioSummary.largestHolding.currency} ({portfolioSummary.largestHolding.percentage.toFixed(1)}%)
            </div>
          )}
        </Card>
      )}

      {/* Currency Balances */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Currency Balances</h3>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowZeroBalances(!showZeroBalances)}
            >
              {showZeroBalances ? 'Hide Zero' : 'Show All'}
            </Button>
            {onAddCurrency && (
              <Button size="sm" onClick={onAddCurrency}>
                <Plus className="h-4 w-4 mr-1" />
                Add Currency
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 p-3 rounded-lg mb-4">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        <div className="space-y-3">
          {displayedBalances.map((balance) => (
            <div key={balance.currency} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-800">
                    {getCurrencyIcon(balance.currency)}
                  </span>
                </div>
                <div>
                  <div className="font-medium">{balance.currency}</div>
                  <div className="text-sm text-gray-500">
                    {CurrencyFormatter.getCurrencyInfo(balance.currency)?.name}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-medium">
                  {hideBalances ? '••••••' : balance.formattedBalance}
                </div>
                <div className="text-sm text-gray-500">
                  {hideBalances ? '••••••' : balance.formattedUsdEquivalent}
                </div>
                {balance.change24h !== undefined && (
                  <div className={`text-xs flex items-center justify-end ${getChangeColor(balance.change24h)}`}>
                    {getChangeIcon(balance.change24h)}
                    <span className="ml-1">{balance.change24h.toFixed(2)}%</span>
                  </div>
                )}
              </div>

              <div className="ml-4">
                <div className="text-right">
                  <Badge variant="secondary" className="text-xs">
                    {balance.percentage.toFixed(1)}%
                  </Badge>
                  {onConvertCurrency && balance.balance > BigInt(0) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-2"
                      onClick={() => onConvertCurrency(balance.currency)}
                    >
                      Convert
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {displayedBalances.length === 0 && !isLoading && (
          <div className="text-center py-8 text-gray-500">
            {showZeroBalances ? 'No currencies found' : 'No currencies with balance > 0'}
          </div>
        )}

        <div className="mt-4 text-xs text-gray-500 text-center">
          Last updated: {lastUpdated.toLocaleString()}
        </div>
      </Card>
    </div>
  );
};