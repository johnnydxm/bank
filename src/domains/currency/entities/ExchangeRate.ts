export interface ExchangeRateData {
  pair: string; // e.g., "USD/EUR"
  rate: number;
  bid?: number; // Buy price
  ask?: number; // Sell price
  timestamp: Date;
  source: string;
  volume_24h?: number;
  change_24h?: number;
  change_percentage_24h?: number;
}

export interface ExchangeRateProvider {
  name: string;
  supports_fiat: boolean;
  supports_crypto: boolean;
  rate_limit_per_minute: number;
  api_key_required: boolean;
  base_url: string;
  reliability_score: number; // 0-100
}

export interface ExchangeRateHistory {
  pair: string;
  rates: {
    rate: number;
    timestamp: Date;
  }[];
  timeframe: 'hourly' | 'daily' | 'weekly' | 'monthly';
}

export class ExchangeRateEntity implements ExchangeRateData {
  constructor(
    public readonly pair: string,
    public rate: number,
    public timestamp: Date = new Date(),
    public readonly source: string = 'unknown',
    public bid?: number,
    public ask?: number,
    public volume_24h?: number,
    public change_24h?: number,
    public change_percentage_24h?: number
  ) {
    this.validatePair();
    this.validateRate();
    this.validateBidAsk();
  }

  public getBaseCurrency(): string {
    return this.pair.split('/')[0];
  }

  public getQuoteCurrency(): string {
    return this.pair.split('/')[1];
  }

  public isStale(maxAgeMinutes: number = 30): boolean {
    const now = new Date();
    const ageMinutes = (now.getTime() - this.timestamp.getTime()) / (1000 * 60);
    return ageMinutes > maxAgeMinutes;
  }

  public getSpread(): number | null {
    if (this.bid && this.ask) {
      return this.ask - this.bid;
    }
    return null;
  }

  public getSpreadPercentage(): number | null {
    const spread = this.getSpread();
    if (spread && this.bid) {
      return (spread / this.bid) * 100;
    }
    return null;
  }

  public getMidPrice(): number {
    if (this.bid && this.ask) {
      return (this.bid + this.ask) / 2;
    }
    return this.rate;
  }

  public convert(amount: number, useSpread: boolean = false): number {
    if (useSpread && this.ask) {
      return amount * this.ask; // Use ask price for buying
    }
    return amount * this.rate;
  }

  public convertReverse(amount: number, useSpread: boolean = false): number {
    if (useSpread && this.bid) {
      return amount / this.bid; // Use bid price for selling
    }
    return amount / this.rate;
  }

  public updateRate(
    newRate: number,
    newBid?: number,
    newAsk?: number,
    newTimestamp?: Date
  ): void {
    this.validateRate(newRate);
    this.rate = newRate;
    this.timestamp = newTimestamp || new Date();
    
    if (newBid !== undefined) {
      this.bid = newBid;
    }
    if (newAsk !== undefined) {
      this.ask = newAsk;
    }
    
    this.validateBidAsk();
  }

  public getAgeInMinutes(): number {
    const now = new Date();
    return (now.getTime() - this.timestamp.getTime()) / (1000 * 60);
  }

  public getAgeInHours(): number {
    return this.getAgeInMinutes() / 60;
  }

  public isReliable(maxAgeMinutes: number = 30): boolean {
    return !this.isStale(maxAgeMinutes) && this.rate > 0;
  }

  public toJSON(): ExchangeRateData {
    return {
      pair: this.pair,
      rate: this.rate,
      bid: this.bid,
      ask: this.ask,
      timestamp: this.timestamp,
      source: this.source,
      volume_24h: this.volume_24h,
      change_24h: this.change_24h,
      change_percentage_24h: this.change_percentage_24h
    };
  }

  private validatePair(): void {
    if (!this.pair || !this.pair.includes('/')) {
      throw new Error('Exchange rate pair must be in format "BASE/QUOTE"');
    }

    const [base, quote] = this.pair.split('/');
    if (!base || !quote) {
      throw new Error('Both base and quote currencies must be specified');
    }

    if (base === quote) {
      throw new Error('Base and quote currencies cannot be the same');
    }
  }

  private validateRate(rate: number = this.rate): void {
    if (!rate || rate <= 0) {
      throw new Error('Exchange rate must be positive');
    }

    if (!isFinite(rate)) {
      throw new Error('Exchange rate must be finite');
    }
  }

  private validateBidAsk(): void {
    if (this.bid && this.ask) {
      if (this.bid <= 0 || this.ask <= 0) {
        throw new Error('Bid and ask prices must be positive');
      }
      
      if (this.bid > this.ask) {
        throw new Error('Bid price cannot be greater than ask price');
      }
    }
    
    if (this.bid && this.bid <= 0) {
      throw new Error('Bid price must be positive');
    }
    
    if (this.ask && this.ask <= 0) {
      throw new Error('Ask price must be positive');
    }
  }
}

// Exchange rate calculation utilities
export class ExchangeRateCalculator {
  private rates: Map<string, ExchangeRateEntity> = new Map();

  public addRate(rate: ExchangeRateEntity): void {
    this.rates.set(rate.pair, rate);
    
    // Also add the inverse rate
    const [base, quote] = rate.pair.split('/');
    const inversePair = `${quote}/${base}`;
    const inverseRate = new ExchangeRateEntity(
      inversePair,
      1 / rate.rate,
      rate.timestamp,
      rate.source,
      rate.ask ? 1 / rate.ask : undefined,
      rate.bid ? 1 / rate.bid : undefined
    );
    this.rates.set(inversePair, inverseRate);
  }

  public getRate(pair: string): ExchangeRateEntity | null {
    return this.rates.get(pair) || null;
  }

  public hasRate(pair: string): boolean {
    return this.rates.has(pair);
  }

  public convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    useSpread: boolean = false
  ): { amount: number; rate: number; path: string[] } | null {
    
    if (fromCurrency === toCurrency) {
      return { amount, rate: 1, path: [fromCurrency] };
    }

    // Direct conversion
    const directPair = `${fromCurrency}/${toCurrency}`;
    const directRate = this.getRate(directPair);
    
    if (directRate && directRate.isReliable()) {
      return {
        amount: directRate.convert(amount, useSpread),
        rate: directRate.rate,
        path: [fromCurrency, toCurrency]
      };
    }

    // Try USD as intermediate currency for cross-rates
    if (fromCurrency !== 'USD' && toCurrency !== 'USD') {
      const toUsdPair = `${fromCurrency}/USD`;
      const fromUsdPair = `USD/${toCurrency}`;
      
      const toUsdRate = this.getRate(toUsdPair);
      const fromUsdRate = this.getRate(fromUsdPair);
      
      if (toUsdRate && fromUsdRate && toUsdRate.isReliable() && fromUsdRate.isReliable()) {
        const usdAmount = toUsdRate.convert(amount, useSpread);
        const finalAmount = fromUsdRate.convert(usdAmount, useSpread);
        const combinedRate = toUsdRate.rate * fromUsdRate.rate;
        
        return {
          amount: finalAmount,
          rate: combinedRate,
          path: [fromCurrency, 'USD', toCurrency]
        };
      }
    }

    return null; // No conversion path found
  }

  public getConversionPath(fromCurrency: string, toCurrency: string): string[] | null {
    const result = this.convert(1, fromCurrency, toCurrency);
    return result ? result.path : null;
  }

  public getAllPairs(): string[] {
    return Array.from(this.rates.keys());
  }

  public getStaleRates(maxAgeMinutes: number = 30): ExchangeRateEntity[] {
    return Array.from(this.rates.values()).filter(rate => rate.isStale(maxAgeMinutes));
  }

  public removeStaleRates(maxAgeMinutes: number = 30): number {
    const staleRates = this.getStaleRates(maxAgeMinutes);
    let removedCount = 0;
    
    for (const rate of staleRates) {
      this.rates.delete(rate.pair);
      removedCount++;
    }
    
    return removedCount;
  }

  public clear(): void {
    this.rates.clear();
  }

  public size(): number {
    return this.rates.size;
  }

  public getLatestRates(): ExchangeRateEntity[] {
    return Array.from(this.rates.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  public getRatesBySource(source: string): ExchangeRateEntity[] {
    return Array.from(this.rates.values()).filter(rate => rate.source === source);
  }

  public getAverageRate(pair: string, sources: string[]): number | null {
    const rates = sources
      .map(source => this.getRatesBySource(source))
      .flat()
      .filter(rate => rate.pair === pair && rate.isReliable());
    
    if (rates.length === 0) return null;
    
    const sum = rates.reduce((acc, rate) => acc + rate.rate, 0);
    return sum / rates.length;
  }

  public getBestRate(pair: string, sources: string[]): ExchangeRateEntity | null {
    const rates = sources
      .map(source => this.getRatesBySource(source))
      .flat()
      .filter(rate => rate.pair === pair && rate.isReliable())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return rates[0] || null;
  }
}

// Common exchange rate providers
export const ExchangeRateProviders: { [key: string]: ExchangeRateProvider } = {
  COINBASE: {
    name: 'Coinbase',
    supports_fiat: true,
    supports_crypto: true,
    rate_limit_per_minute: 100,
    api_key_required: false,
    base_url: 'https://api.coinbase.com/v2/exchange-rates',
    reliability_score: 95
  },
  
  BINANCE: {
    name: 'Binance',
    supports_fiat: true,
    supports_crypto: true,
    rate_limit_per_minute: 1200,
    api_key_required: false,
    base_url: 'https://api.binance.com/api/v3/ticker',
    reliability_score: 98
  },
  
  FIXER: {
    name: 'Fixer.io',
    supports_fiat: true,
    supports_crypto: false,
    rate_limit_per_minute: 100,
    api_key_required: true,
    base_url: 'https://api.fixer.io/latest',
    reliability_score: 92
  },
  
  EXCHANGERATE_API: {
    name: 'ExchangeRate-API',
    supports_fiat: true,
    supports_crypto: false,
    rate_limit_per_minute: 1500,
    api_key_required: false,
    base_url: 'https://api.exchangerate-api.com/v4/latest',
    reliability_score: 90
  },
  
  COINGECKO: {
    name: 'CoinGecko',
    supports_fiat: true,
    supports_crypto: true,
    rate_limit_per_minute: 50,
    api_key_required: false,
    base_url: 'https://api.coingecko.com/api/v3/simple/price',
    reliability_score: 88
  }
};