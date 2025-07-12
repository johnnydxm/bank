import { Currency, CurrencyEntity, SupportedCurrency } from '../entities/Currency';
import { ExchangeRateEntity, ExchangeRateData, ExchangeRateHistory } from '../entities/ExchangeRate';

export interface ICurrencyRepository {
  // Currency management
  createCurrency(currency: Currency): Promise<Currency>;
  getCurrency(code: string): Promise<Currency | null>;
  listCurrencies(activeOnly?: boolean): Promise<Currency[]>;
  updateCurrency(code: string, updates: Partial<Currency>): Promise<Currency>;
  deleteCurrency(code: string): Promise<void>;
  
  // Currency validation
  isSupportedCurrency(code: string): Promise<boolean>;
  getSupportedCurrencies(): Promise<SupportedCurrency[]>;
  validateCurrencyPair(baseCurrency: string, quoteCurrency: string): Promise<boolean>;
}

export interface IExchangeRateRepository {
  // Exchange rate management
  saveExchangeRate(rate: ExchangeRateEntity): Promise<void>;
  getExchangeRate(pair: string, source?: string): Promise<ExchangeRateEntity | null>;
  getLatestExchangeRate(pair: string): Promise<ExchangeRateEntity | null>;
  listExchangeRates(pairs?: string[], sources?: string[]): Promise<ExchangeRateEntity[]>;
  
  // Historical data
  saveExchangeRateHistory(history: ExchangeRateHistory): Promise<void>;
  getExchangeRateHistory(
    pair: string, 
    timeframe: 'hourly' | 'daily' | 'weekly' | 'monthly',
    startDate?: Date,
    endDate?: Date
  ): Promise<ExchangeRateHistory | null>;
  
  // Rate cleanup and maintenance
  removeStaleRates(maxAgeMinutes: number): Promise<number>;
  getStaleRates(maxAgeMinutes: number): Promise<ExchangeRateEntity[]>;
  
  // Conversion utilities
  convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    useSpread?: boolean
  ): Promise<{ amount: number; rate: number; path: string[] } | null>;
}

export interface ICurrencyConversionService {
  // Real-time conversion
  convert(
    amount: bigint,
    fromCurrency: string,
    toCurrency: string,
    options?: {
      useSpread?: boolean;
      maxRateAge?: number; // minutes
      preferredSources?: string[];
    }
  ): Promise<{
    convertedAmount: bigint;
    exchangeRate: number;
    conversionPath: string[];
    timestamp: Date;
    fees?: bigint;
    source: string;
  }>;
  
  // Rate fetching
  fetchLatestRates(pairs: string[]): Promise<ExchangeRateEntity[]>;
  refreshExchangeRates(forceRefresh?: boolean): Promise<void>;
  
  // Multi-currency calculations
  calculateCrossRate(
    baseCurrency: string,
    quoteCurrency: string,
    intermediateCurrency?: string
  ): Promise<number | null>;
  
  // Portfolio conversions
  convertPortfolio(
    balances: { currency: string; amount: bigint }[],
    targetCurrency: string
  ): Promise<{
    totalValue: bigint;
    conversions: Array<{
      fromCurrency: string;
      amount: bigint;
      convertedAmount: bigint;
      rate: number;
    }>;
    timestamp: Date;
  }>;
}

export interface ICurrencyValidationService {
  // Amount validation
  validateAmount(amount: bigint, currency: string): Promise<{ valid: boolean; errors: string[] }>;
  
  // Currency pair validation
  validateCurrencyPair(base: string, quote: string): Promise<{ valid: boolean; errors: string[] }>;
  
  // Transaction validation
  validateCurrencyTransaction(
    fromCurrency: string,
    toCurrency: string,
    amount: bigint
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[] }>;
  
  // Formatting validation
  parseAndValidateAmount(amountStr: string, currency: string): Promise<{ amount: bigint; valid: boolean; errors: string[] }>;
}

// Error types for currency operations
export interface CurrencyError {
  code: string;
  message: string;
  details: Record<string, any>;
  retryable: boolean;
}

export interface CurrencyOperationResult<T> {
  success: boolean;
  data?: T;
  error?: CurrencyError;
  metadata: {
    request_id: string;
    duration_ms: number;
    source?: string;
    cached?: boolean;
  };
}

// Filter and query interfaces
export interface CurrencyFilter {
  type?: 'fiat' | 'crypto';
  active_only?: boolean;
  regulatory_status?: 'approved' | 'restricted' | 'pending';
  country_code?: string;
  blockchain_network?: string;
  is_stable_coin?: boolean;
  limit?: number;
  offset?: number;
}

export interface ExchangeRateFilter {
  pairs?: string[];
  sources?: string[];
  max_age_minutes?: number;
  min_reliability_score?: number;
  exclude_stale?: boolean;
  limit?: number;
  offset?: number;
}

// Configuration interfaces
export interface CurrencyServiceConfig {
  default_currency: string;
  supported_currencies: string[];
  exchange_rate_sources: string[];
  rate_refresh_interval_minutes: number;
  max_rate_age_minutes: number;
  conversion_fee_percentage: number;
  cache_ttl_minutes: number;
  fallback_to_usd: boolean;
}

export interface ExchangeRateProviderConfig {
  name: string;
  enabled: boolean;
  api_key?: string;
  base_url: string;
  rate_limit_per_minute: number;
  timeout_ms: number;
  retry_attempts: number;
  priority: number; // Higher priority providers are used first
  supports_pairs: string[];
}