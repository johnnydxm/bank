import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { SupportedCurrencies } from '../../../domains/currency/entities/Currency';
import { CurrencyFormatter } from '../../../shared/utils/currencyUtils';
import { ArrowUpDown, TrendingUp, AlertTriangle } from 'lucide-react';

interface CurrencyConverterProps {
  userId: string;
  onConvert?: ((conversion: CurrencyConversionResult) => void) | undefined;
  className?: string | undefined;
}

interface CurrencyConversionResult {
  fromCurrency: string;
  toCurrency: string;
  originalAmount: string;
  convertedAmount: string;
  exchangeRate: number;
  fees: string;
}

interface ExchangeRate {
  pair: string;
  rate: number;
  timestamp: Date;
  source: string;
}

export const CurrencyConverter: React.FC<CurrencyConverterProps> = ({
  userId,
  onConvert,
  className = ''
}) => {
  const [fromCurrency, setFromCurrency] = useState<string>('USD');
  const [toCurrency, setToCurrency] = useState<string>('EUR');
  const [amount, setAmount] = useState<string>('');
  const [convertedAmount, setConvertedAmount] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [warnings, setWarnings] = useState<string[]>([]);

  // Get supported currencies for dropdown
  const supportedCurrencies = Object.keys(SupportedCurrencies);
  const currencyOptions = supportedCurrencies.map(code => ({
    value: code,
    label: `${code} - ${SupportedCurrencies[code as keyof typeof SupportedCurrencies].metadata.name}`
  }));

  // Fetch exchange rate when currencies change
  useEffect(() => {
    if (fromCurrency !== toCurrency) {
      fetchExchangeRate();
    }
  }, [fromCurrency, toCurrency]);

  // Update converted amount when amount or rate changes
  useEffect(() => {
    if (amount && exchangeRate && fromCurrency !== toCurrency) {
      calculateConversion();
    } else if (fromCurrency === toCurrency) {
      setConvertedAmount(amount);
    }
  }, [amount, exchangeRate, fromCurrency, toCurrency]);

  const fetchExchangeRate = async () => {
    if (fromCurrency === toCurrency) {
      setExchangeRate({
        pair: `${fromCurrency}/${toCurrency}`,
        rate: 1,
        timestamp: new Date(),
        source: 'direct'
      });
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // This would call your exchange rate service
      // For now, using mock data
      const mockRate = await fetchMockExchangeRate(fromCurrency, toCurrency);
      setExchangeRate(mockRate);
    } catch (err) {
      setError(`Failed to fetch exchange rate: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateConversion = () => {
    if (!amount || !exchangeRate) return;

    try {
      const numAmount = parseFloat(amount);
      const converted = numAmount * exchangeRate.rate;
      
      const fromCurrencyEntity = SupportedCurrencies[fromCurrency as keyof typeof SupportedCurrencies];
      const toCurrencyEntity = SupportedCurrencies[toCurrency as keyof typeof SupportedCurrencies];
      
      const formattedAmount = converted.toFixed(toCurrencyEntity.metadata.decimal_places);
      setConvertedAmount(formattedAmount);

      // Check for warnings
      const newWarnings: string[] = [];
      
      if (fromCurrencyEntity.isFiat() && toCurrencyEntity.isCrypto()) {
        newWarnings.push('Converting to cryptocurrency may involve additional fees and regulatory considerations.');
      }
      
      if (fromCurrencyEntity.isCrypto() && toCurrencyEntity.isFiat()) {
        newWarnings.push('Converting from cryptocurrency may have tax implications.');
      }

      if (converted > 10000) {
        newWarnings.push('Large conversion amounts may require additional verification.');
      }

      setWarnings(newWarnings);
    } catch (err) {
      setError('Invalid amount format');
    }
  };

  const handleSwapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const handleConvert = async () => {
    if (!amount || !exchangeRate) return;

    setIsLoading(true);
    setError('');

    try {
      // This would call your multi-currency account service
      const result = await performMockConversion();
      
      if (onConvert) {
        onConvert(result);
      }

      // Reset form
      setAmount('');
      setConvertedAmount('');
    } catch (err) {
      setError(`Conversion failed: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrencyInfo = (currencyCode: string) => {
    return CurrencyFormatter.getCurrencyInfo(currencyCode);
  };

  // Mock functions (replace with actual service calls)
  const fetchMockExchangeRate = async (from: string, to: string): Promise<ExchangeRate> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock exchange rates
    const rates: Record<string, number> = {
      'USD/EUR': 0.85,
      'USD/GBP': 0.75,
      'USD/JPY': 110,
      'BTC/USD': 45000,
      'ETH/USD': 3000,
      'EUR/GBP': 0.88,
    };

    const pair = `${from}/${to}`;
    const reversePair = `${to}/${from}`;
    
    let rate = rates[pair];
    if (!rate && rates[reversePair]) {
      rate = 1 / rates[reversePair];
    }
    if (!rate) {
      rate = 1.0; // Fallback
    }

    return {
      pair,
      rate,
      timestamp: new Date(),
      source: 'Mock Exchange'
    };
  };

  const performMockConversion = async (): Promise<CurrencyConversionResult> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const fees = (parseFloat(amount) * 0.001).toFixed(2); // 0.1% fee
    
    return {
      fromCurrency,
      toCurrency,
      originalAmount: amount,
      convertedAmount,
      exchangeRate: exchangeRate?.rate || 1,
      fees
    };
  };

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Currency Converter</h3>
          {exchangeRate && (
            <Badge variant="secondary" className="text-xs">
              Rate: {exchangeRate.rate.toFixed(6)}
            </Badge>
          )}
        </div>

        {/* From Currency */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">From</label>
          <div className="flex space-x-2">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-right"
              />
            </div>
            <div className="w-32">
              <Select
                value={fromCurrency}
                onValueChange={setFromCurrency}
                options={currencyOptions}
              />
            </div>
          </div>
          {fromCurrency && (
            <div className="text-xs text-gray-500">
              {getCurrencyInfo(fromCurrency)?.name} ({getCurrencyInfo(fromCurrency)?.symbol})
            </div>
          )}
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSwapCurrencies}
            className="p-2"
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>

        {/* To Currency */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">To</label>
          <div className="flex space-x-2">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Converted amount"
                value={convertedAmount}
                readOnly
                className="text-right bg-gray-50"
              />
            </div>
            <div className="w-32">
              <Select
                value={toCurrency}
                onValueChange={setToCurrency}
                options={currencyOptions}
              />
            </div>
          </div>
          {toCurrency && (
            <div className="text-xs text-gray-500">
              {getCurrencyInfo(toCurrency)?.name} ({getCurrencyInfo(toCurrency)?.symbol})
            </div>
          )}
        </div>

        {/* Exchange Rate Info */}
        {exchangeRate && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center space-x-2 text-sm">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-blue-800">
                {CurrencyFormatter.formatExchangeRate(
                  exchangeRate.rate,
                  fromCurrency,
                  toCurrency
                )}
              </span>
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Updated: {exchangeRate.timestamp.toLocaleTimeString()} • Source: {exchangeRate.source}
            </div>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((warning, index) => (
              <div key={index} className="bg-yellow-50 p-3 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-yellow-800">{warning}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 p-3 rounded-lg">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {/* Convert Button */}
        <Button
          onClick={handleConvert}
          disabled={!amount || !convertedAmount || isLoading || !!error}
          className="w-full"
        >
          {isLoading ? 'Converting...' : 'Convert Currency'}
        </Button>

        {/* Fee Information */}
        {amount && exchangeRate && (
          <div className="text-xs text-gray-500 text-center">
            Estimated fee: ~0.1% • Final amount may vary based on market conditions
          </div>
        )}
      </div>
    </Card>
  );
};