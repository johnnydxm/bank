import { injectable, inject } from 'inversify';
import axios, { AxiosResponse } from 'axios';
import { ILogger } from '../../shared/interfaces/ILogger';
import { TYPES } from '../ioc/types';
import { 
  IExchangeRateRepository, 
  ICurrencyConversionService,
  CurrencyOperationResult,
  ExchangeRateProviderConfig 
} from '../../domains/currency/repositories/ICurrencyRepository';
import { 
  ExchangeRateEntity, 
  ExchangeRateCalculator,
  ExchangeRateProviders 
} from '../../domains/currency/entities/ExchangeRate';
import { SupportedCurrencies } from '../../domains/currency/entities/Currency';

interface ExchangeRateCache {
  [pair: string]: {
    rate: ExchangeRateEntity;
    expiresAt: Date;
  };
}

@injectable()
export class ExchangeRateService implements ICurrencyConversionService {
  private cache: ExchangeRateCache = {};
  private calculator = new ExchangeRateCalculator();
  private providers: Map<string, ExchangeRateProviderConfig> = new Map();
  private rateLimits: Map<string, { count: number; resetAt: Date }> = new Map();

  constructor(
    @inject(TYPES.Logger) private logger: ILogger
  ) {
    this.initializeProviders();
  }

  public async convert(
    amount: bigint,
    fromCurrency: string,
    toCurrency: string,
    options: {
      useSpread?: boolean;
      maxRateAge?: number;
      preferredSources?: string[];
    } = {}
  ): Promise<{
    convertedAmount: bigint;
    exchangeRate: number;
    conversionPath: string[];
    timestamp: Date;
    fees?: bigint;
    source: string;
  }> {
    this.logger.info('Converting currency', {
      amount: amount.toString(),
      fromCurrency,
      toCurrency,
      options
    });

    if (fromCurrency === toCurrency) {
      return {
        convertedAmount: amount,
        exchangeRate: 1,
        conversionPath: [fromCurrency],
        timestamp: new Date(),
        source: 'direct'
      };
    }

    // Get exchange rate
    const rateResult = await this.getExchangeRate(
      `${fromCurrency}/${toCurrency}`,
      options.preferredSources,
      options.maxRateAge
    );

    if (!rateResult) {
      throw new Error(`No exchange rate available for ${fromCurrency}/${toCurrency}`);
    }

    // Convert amount using bigint arithmetic to maintain precision
    const fromCurrencyEntity = SupportedCurrencies[fromCurrency as keyof typeof SupportedCurrencies];
    const toCurrencyEntity = SupportedCurrencies[toCurrency as keyof typeof SupportedCurrencies];

    if (!fromCurrencyEntity || !toCurrencyEntity) {
      throw new Error(`Unsupported currency: ${fromCurrency} or ${toCurrency}`);
    }

    // Calculate conversion with proper decimal handling
    const rate = BigInt(Math.round(rateResult.rate * 1e8)); // Use 8 decimal places for precision
    const scaleFactor = BigInt(1e8);
    
    // Adjust for decimal place differences
    const fromDecimals = fromCurrencyEntity.metadata.decimal_places;
    const toDecimals = toCurrencyEntity.metadata.decimal_places;
    const decimalAdjustment = toDecimals - fromDecimals;
    
    let convertedAmount = (amount * rate) / scaleFactor;
    
    if (decimalAdjustment > 0) {
      convertedAmount = convertedAmount * BigInt(Math.pow(10, decimalAdjustment));
    } else if (decimalAdjustment < 0) {
      convertedAmount = convertedAmount / BigInt(Math.pow(10, Math.abs(decimalAdjustment)));
    }

    // Calculate fees (0.1% for now, can be configurable)
    const feePercentage = BigInt(10); // 0.1% = 10/10000
    const fees = (convertedAmount * feePercentage) / BigInt(10000);

    return {
      convertedAmount: convertedAmount - fees,
      exchangeRate: rateResult.rate,
      conversionPath: [fromCurrency, toCurrency],
      timestamp: rateResult.timestamp,
      fees,
      source: rateResult.source
    };
  }

  public async fetchLatestRates(pairs: string[]): Promise<ExchangeRateEntity[]> {
    this.logger.info('Fetching latest exchange rates', { pairs });
    
    const results: ExchangeRateEntity[] = [];
    const providers = Array.from(this.providers.values())
      .filter(p => p.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const pair of pairs) {
      let rateFound = false;
      
      for (const provider of providers) {
        if (rateFound) break;
        
        try {
          const rate = await this.fetchRateFromProvider(pair, provider);
          if (rate) {
            results.push(rate);
            this.cacheRate(rate);
            this.calculator.addRate(rate);
            rateFound = true;
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch rate from ${provider.name}`, {
            pair,
            error: (error as Error).message
          });
        }
      }
      
      if (!rateFound) {
        this.logger.warn(`No rate found for pair: ${pair}`);
      }
    }

    return results;
  }

  public async refreshExchangeRates(forceRefresh: boolean = false): Promise<void> {
    this.logger.info('Refreshing exchange rates', { forceRefresh });

    // Define priority pairs to refresh
    const priorityPairs = [
      'USD/EUR', 'USD/GBP', 'USD/JPY',
      'BTC/USD', 'ETH/USD', 'USDC/USD', 'USDT/USD',
      'EUR/GBP', 'EUR/JPY', 'GBP/JPY'
    ];

    const staleRates = this.getStaleRatesFromCache(30); // 30 minutes
    const pairsToRefresh = forceRefresh 
      ? priorityPairs 
      : [...new Set([...priorityPairs, ...staleRates.map(r => r.pair)])];

    try {
      const refreshedRates = await this.fetchLatestRates(pairsToRefresh);
      this.logger.info(`Refreshed ${refreshedRates.length} exchange rates`);
    } catch (error) {
      this.logger.error('Failed to refresh exchange rates', error as Error);
      throw error;
    }
  }

  public async calculateCrossRate(
    baseCurrency: string,
    quoteCurrency: string,
    intermediateCurrency: string = 'USD'
  ): Promise<number | null> {
    this.logger.debug('Calculating cross rate', {
      baseCurrency,
      quoteCurrency,
      intermediateCurrency
    });

    const result = this.calculator.convert(1, baseCurrency, quoteCurrency);
    if (result) {
      return result.rate;
    }

    // Try with intermediate currency
    const baseToIntermediate = await this.getExchangeRate(`${baseCurrency}/${intermediateCurrency}`);
    const intermediateToQuote = await this.getExchangeRate(`${intermediateCurrency}/${quoteCurrency}`);

    if (baseToIntermediate && intermediateToQuote) {
      return baseToIntermediate.rate * intermediateToQuote.rate;
    }

    return null;
  }

  public async convertPortfolio(
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
  }> {
    this.logger.info('Converting portfolio', {
      balanceCount: balances.length,
      targetCurrency
    });

    const conversions: Array<{
      fromCurrency: string;
      amount: bigint;
      convertedAmount: bigint;
      rate: number;
    }> = [];

    let totalValue = BigInt(0);
    const timestamp = new Date();

    for (const balance of balances) {
      if (balance.currency === targetCurrency) {
        conversions.push({
          fromCurrency: balance.currency,
          amount: balance.amount,
          convertedAmount: balance.amount,
          rate: 1
        });
        totalValue += balance.amount;
      } else {
        try {
          const conversion = await this.convert(balance.amount, balance.currency, targetCurrency);
          conversions.push({
            fromCurrency: balance.currency,
            amount: balance.amount,
            convertedAmount: conversion.convertedAmount,
            rate: conversion.exchangeRate
          });
          totalValue += conversion.convertedAmount;
        } catch (error) {
          this.logger.warn(`Failed to convert ${balance.currency} to ${targetCurrency}`, {
            error: (error as Error).message
          });
          // Add with zero value if conversion fails
          conversions.push({
            fromCurrency: balance.currency,
            amount: balance.amount,
            convertedAmount: BigInt(0),
            rate: 0
          });
        }
      }
    }

    return {
      totalValue,
      conversions,
      timestamp
    };
  }

  // Private helper methods

  private async getExchangeRate(
    pair: string,
    preferredSources?: string[],
    maxAgeMinutes: number = 30
  ): Promise<ExchangeRateEntity | null> {
    // Check cache first
    const cached = this.getCachedRate(pair);
    if (cached && !cached.rate.isStale(maxAgeMinutes)) {
      return cached.rate;
    }

    // Check calculator
    const calculatorRate = this.calculator.getRate(pair);
    if (calculatorRate && !calculatorRate.isStale(maxAgeMinutes)) {
      return calculatorRate;
    }

    // Fetch from providers
    const providers = preferredSources 
      ? preferredSources.map(name => this.providers.get(name)).filter(Boolean) as ExchangeRateProviderConfig[]
      : Array.from(this.providers.values()).filter(p => p.enabled);

    for (const provider of providers) {
      try {
        const rate = await this.fetchRateFromProvider(pair, provider);
        if (rate) {
          this.cacheRate(rate);
          this.calculator.addRate(rate);
          return rate;
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch rate from ${provider.name}`, {
          pair,
          error: (error as Error).message
        });
      }
    }

    return null;
  }

  private async fetchRateFromProvider(
    pair: string,
    provider: ExchangeRateProviderConfig
  ): Promise<ExchangeRateEntity | null> {
    // Check rate limit
    if (!this.canMakeRequest(provider.name)) {
      throw new Error(`Rate limit exceeded for ${provider.name}`);
    }

    const [base, quote] = pair.split('/');
    
    try {
      let rate: ExchangeRateEntity | null = null;

      switch (provider.name) {
        case 'Coinbase':
          if (base && quote) rate = await this.fetchFromCoinbase(base, quote);
          break;
        case 'Binance':
          if (base && quote) rate = await this.fetchFromBinance(base, quote);
          break;
        case 'Fixer.io':
          if (base && quote) rate = await this.fetchFromFixer(base, quote);
          break;
        case 'ExchangeRate-API':
          if (base && quote) rate = await this.fetchFromExchangeRateAPI(base, quote);
          break;
        case 'CoinGecko':
          if (base && quote) rate = await this.fetchFromCoinGecko(base, quote);
          break;
        default:
          throw new Error(`Unknown provider: ${provider.name}`);
      }

      this.updateRateLimit(provider.name);
      return rate;

    } catch (error) {
      this.logger.error(`Error fetching from ${provider.name}`, {
        message: `Error fetching ${pair} from ${provider.name}: ${(error as Error).message}`
      });
      throw error;
    }
  }

  private async fetchFromCoinbase(base: string, quote: string): Promise<ExchangeRateEntity | null> {
    const response = await axios.get(`https://api.coinbase.com/v2/exchange-rates?currency=${base}`, {
      timeout: 5000
    });

    const rates = response.data?.data?.rates;
    if (rates && rates[quote]) {
      return new ExchangeRateEntity(
        `${base}/${quote}`,
        parseFloat(rates[quote]),
        new Date(),
        'Coinbase'
      );
    }

    return null;
  }

  private async fetchFromBinance(base: string, quote: string): Promise<ExchangeRateEntity | null> {
    // Binance uses different symbol format
    const symbol = `${base}${quote}`;
    
    try {
      const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, {
        timeout: 5000
      });

      if (response.data?.price) {
        return new ExchangeRateEntity(
          `${base}/${quote}`,
          parseFloat(response.data.price),
          new Date(),
          'Binance'
        );
      }
    } catch (error) {
      // Try reverse pair
      const reverseSymbol = `${quote}${base}`;
      try {
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${reverseSymbol}`, {
          timeout: 5000
        });

        if (response.data?.price) {
          return new ExchangeRateEntity(
            `${base}/${quote}`,
            1 / parseFloat(response.data.price),
            new Date(),
            'Binance'
          );
        }
      } catch (reverseError) {
        // Both failed
      }
    }

    return null;
  }

  private async fetchFromFixer(base: string, quote: string): Promise<ExchangeRateEntity | null> {
    // Fixer.io typically uses EUR as base
    const apiKey = process.env.FIXER_API_KEY;
    if (!apiKey) {
      throw new Error('Fixer.io API key not configured');
    }

    const response = await axios.get(`https://api.fixer.io/latest?access_key=${apiKey}&base=${base}&symbols=${quote}`, {
      timeout: 5000
    });

    const rates = response.data?.rates;
    if (rates && rates[quote]) {
      return new ExchangeRateEntity(
        `${base}/${quote}`,
        rates[quote],
        new Date(),
        'Fixer.io'
      );
    }

    return null;
  }

  private async fetchFromExchangeRateAPI(base: string, quote: string): Promise<ExchangeRateEntity | null> {
    const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${base}`, {
      timeout: 5000
    });

    const rates = response.data?.rates;
    if (rates && rates[quote]) {
      return new ExchangeRateEntity(
        `${base}/${quote}`,
        rates[quote],
        new Date(),
        'ExchangeRate-API'
      );
    }

    return null;
  }

  private async fetchFromCoinGecko(base: string, quote: string): Promise<ExchangeRateEntity | null> {
    // CoinGecko uses different currency IDs
    const coinIds: { [key: string]: string } = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDC': 'usd-coin',
      'USDT': 'tether'
    };

    const baseCoinId = coinIds[base];
    if (!baseCoinId) return null;

    const quoteCurrency = quote.toLowerCase();
    
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${baseCoinId}&vs_currencies=${quoteCurrency}`,
      { timeout: 5000 }
    );

    const price = response.data?.[baseCoinId]?.[quoteCurrency];
    if (price) {
      return new ExchangeRateEntity(
        `${base}/${quote}`,
        price,
        new Date(),
        'CoinGecko'
      );
    }

    return null;
  }

  private initializeProviders(): void {
    // Initialize exchange rate providers with configurations
    const providerConfigs: ExchangeRateProviderConfig[] = [
      {
        name: 'Coinbase',
        enabled: true,
        base_url: 'https://api.coinbase.com/v2/exchange-rates',
        rate_limit_per_minute: 100,
        timeout_ms: 5000,
        retry_attempts: 3,
        priority: 95,
        supports_pairs: ['BTC/USD', 'ETH/USD', 'USDC/USD', 'USDT/USD']
      },
      {
        name: 'Binance',
        enabled: true,
        base_url: 'https://api.binance.com/api/v3/ticker',
        rate_limit_per_minute: 1200,
        timeout_ms: 5000,
        retry_attempts: 3,
        priority: 98,
        supports_pairs: ['BTC/USD', 'ETH/USD', 'BTC/EUR', 'ETH/EUR']
      },
      {
        name: 'ExchangeRate-API',
        enabled: true,
        base_url: 'https://api.exchangerate-api.com/v4/latest',
        rate_limit_per_minute: 1500,
        timeout_ms: 5000,
        retry_attempts: 3,
        priority: 90,
        supports_pairs: ['USD/EUR', 'USD/GBP', 'USD/JPY', 'EUR/GBP']
      }
    ];

    for (const config of providerConfigs) {
      this.providers.set(config.name, config);
    }
  }

  private canMakeRequest(providerName: string): boolean {
    const limit = this.rateLimits.get(providerName);
    if (!limit) return true;

    const now = new Date();
    if (now > limit.resetAt) {
      this.rateLimits.delete(providerName);
      return true;
    }

    const provider = this.providers.get(providerName);
    return limit.count < (provider?.rate_limit_per_minute || 100);
  }

  private updateRateLimit(providerName: string): void {
    const now = new Date();
    const resetAt = new Date(now.getTime() + 60 * 1000); // Reset in 1 minute
    
    const existing = this.rateLimits.get(providerName);
    if (existing && now < existing.resetAt) {
      existing.count++;
    } else {
      this.rateLimits.set(providerName, { count: 1, resetAt });
    }
  }

  private cacheRate(rate: ExchangeRateEntity): void {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    this.cache[rate.pair] = { rate, expiresAt };
  }

  private getCachedRate(pair: string): { rate: ExchangeRateEntity; expiresAt: Date } | null {
    const cached = this.cache[pair];
    if (cached && new Date() < cached.expiresAt) {
      return cached;
    }
    return null;
  }

  private getStaleRatesFromCache(maxAgeMinutes: number): ExchangeRateEntity[] {
    const staleRates: ExchangeRateEntity[] = [];
    const now = new Date();
    
    for (const [pair, cached] of Object.entries(this.cache)) {
      if (cached.rate.isStale(maxAgeMinutes)) {
        staleRates.push(cached.rate);
      }
    }
    
    return staleRates;
  }
}