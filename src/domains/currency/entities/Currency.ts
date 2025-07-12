export interface CurrencyMetadata {
  name: string;
  symbol: string;
  decimal_places: number;
  type: 'fiat' | 'crypto';
  country_code?: string; // ISO 3166-1 alpha-2 for fiat currencies
  blockchain_network?: string; // For crypto currencies
  contract_address?: string; // For ERC-20 tokens
  is_stable_coin?: boolean;
  regulatory_status: 'approved' | 'restricted' | 'pending';
  minimum_amount: bigint;
  maximum_amount: bigint;
}

export interface Currency {
  code: string; // ISO 4217 for fiat, symbol for crypto (e.g., 'USD', 'BTC', 'ETH')
  metadata: CurrencyMetadata;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SupportedCurrency extends Currency {
  exchange_rate_sources: string[]; // APIs that provide rates for this currency
  base_currency_pairs: string[]; // Pairs where this currency is the base
  quote_currency_pairs: string[]; // Pairs where this currency is the quote
}

export class CurrencyEntity implements Currency {
  constructor(
    public readonly code: string,
    public readonly metadata: CurrencyMetadata,
    public is_active: boolean = true,
    public readonly created_at: Date = new Date(),
    public updated_at: Date = new Date()
  ) {
    this.validateCurrencyCode();
    this.validateMetadata();
  }

  public updateMetadata(updates: Partial<CurrencyMetadata>): void {
    Object.assign(this.metadata, updates);
    this.updated_at = new Date();
    this.validateMetadata();
  }

  public deactivate(): void {
    this.is_active = false;
    this.updated_at = new Date();
  }

  public activate(): void {
    this.is_active = true;
    this.updated_at = new Date();
  }

  public isFiat(): boolean {
    return this.metadata.type === 'fiat';
  }

  public isCrypto(): boolean {
    return this.metadata.type === 'crypto';
  }

  public isStableCoin(): boolean {
    return this.metadata.is_stable_coin === true;
  }

  public getFormattedMinimum(): string {
    return this.formatAmount(this.metadata.minimum_amount);
  }

  public getFormattedMaximum(): string {
    return this.formatAmount(this.metadata.maximum_amount);
  }

  public formatAmount(amount: bigint): string {
    const divisor = BigInt(Math.pow(10, this.metadata.decimal_places));
    const whole = amount / divisor;
    const fraction = amount % divisor;
    
    if (fraction === BigInt(0)) {
      return `${whole.toString()} ${this.metadata.symbol}`;
    }
    
    const fractionStr = fraction.toString().padStart(this.metadata.decimal_places, '0');
    return `${whole.toString()}.${fractionStr} ${this.metadata.symbol}`;
  }

  public parseAmount(amountStr: string): bigint {
    const cleanAmount = amountStr.replace(/[^\d.-]/g, '');
    const parts = cleanAmount.split('.');
    
    const wholePart = BigInt(parts[0] || 0);
    const fractionPart = parts[1] || '0';
    const paddedFraction = fractionPart.padEnd(this.metadata.decimal_places, '0').slice(0, this.metadata.decimal_places);
    
    const multiplier = BigInt(Math.pow(10, this.metadata.decimal_places));
    return wholePart * multiplier + BigInt(paddedFraction);
  }

  public validateAmount(amount: bigint): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (amount < BigInt(0)) {
      errors.push('Amount cannot be negative');
    }

    if (amount < this.metadata.minimum_amount) {
      errors.push(`Amount below minimum: ${this.getFormattedMinimum()}`);
    }

    if (amount > this.metadata.maximum_amount) {
      errors.push(`Amount exceeds maximum: ${this.getFormattedMaximum()}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateCurrencyCode(): void {
    if (!this.code || this.code.length < 2 || this.code.length > 10) {
      throw new Error('Currency code must be between 2-10 characters');
    }

    // Validate fiat currency codes (ISO 4217)
    if (this.metadata.type === 'fiat' && this.code.length !== 3) {
      throw new Error('Fiat currency codes must be 3 characters (ISO 4217)');
    }

    // Ensure uppercase
    if (this.code !== this.code.toUpperCase()) {
      throw new Error('Currency code must be uppercase');
    }
  }

  private validateMetadata(): void {
    if (!this.metadata.name || this.metadata.name.trim().length === 0) {
      throw new Error('Currency name is required');
    }

    if (!this.metadata.symbol || this.metadata.symbol.trim().length === 0) {
      throw new Error('Currency symbol is required');
    }

    if (this.metadata.decimal_places < 0 || this.metadata.decimal_places > 18) {
      throw new Error('Decimal places must be between 0-18');
    }

    if (this.metadata.minimum_amount < BigInt(0)) {
      throw new Error('Minimum amount cannot be negative');
    }

    if (this.metadata.maximum_amount <= this.metadata.minimum_amount) {
      throw new Error('Maximum amount must be greater than minimum amount');
    }

    // Validate fiat-specific fields
    if (this.metadata.type === 'fiat') {
      if (!this.metadata.country_code || this.metadata.country_code.length !== 2) {
        throw new Error('Fiat currencies require valid 2-character country code');
      }
    }

    // Validate crypto-specific fields
    if (this.metadata.type === 'crypto') {
      if (!this.metadata.blockchain_network) {
        throw new Error('Crypto currencies require blockchain network specification');
      }
    }
  }
}

// Pre-configured currency definitions
export const SupportedCurrencies = {
  // Major Fiat Currencies
  USD: new CurrencyEntity('USD', {
    name: 'US Dollar',
    symbol: '$',
    decimal_places: 2,
    type: 'fiat',
    country_code: 'US',
    regulatory_status: 'approved',
    minimum_amount: BigInt(1), // $0.01
    maximum_amount: BigInt(100000000000) // $1,000,000,000.00
  }),

  EUR: new CurrencyEntity('EUR', {
    name: 'Euro',
    symbol: '€',
    decimal_places: 2,
    type: 'fiat',
    country_code: 'EU',
    regulatory_status: 'approved',
    minimum_amount: BigInt(1), // €0.01
    maximum_amount: BigInt(100000000000) // €1,000,000,000.00
  }),

  GBP: new CurrencyEntity('GBP', {
    name: 'British Pound Sterling',
    symbol: '£',
    decimal_places: 2,
    type: 'fiat',
    country_code: 'GB',
    regulatory_status: 'approved',
    minimum_amount: BigInt(1), // £0.01
    maximum_amount: BigInt(100000000000) // £1,000,000,000.00
  }),

  JPY: new CurrencyEntity('JPY', {
    name: 'Japanese Yen',
    symbol: '¥',
    decimal_places: 0,
    type: 'fiat',
    country_code: 'JP',
    regulatory_status: 'approved',
    minimum_amount: BigInt(1), // ¥1
    maximum_amount: BigInt(100000000000) // ¥100,000,000,000
  }),

  // Major Cryptocurrencies
  BTC: new CurrencyEntity('BTC', {
    name: 'Bitcoin',
    symbol: '₿',
    decimal_places: 8,
    type: 'crypto',
    blockchain_network: 'bitcoin',
    is_stable_coin: false,
    regulatory_status: 'approved',
    minimum_amount: BigInt(1), // 0.00000001 BTC (1 satoshi)
    maximum_amount: BigInt(2100000000000000) // 21,000,000 BTC
  }),

  ETH: new CurrencyEntity('ETH', {
    name: 'Ethereum',
    symbol: 'Ξ',
    decimal_places: 18,
    type: 'crypto',
    blockchain_network: 'ethereum',
    is_stable_coin: false,
    regulatory_status: 'approved',
    minimum_amount: BigInt(1), // 1 wei
    maximum_amount: BigInt('1000000000000000000000000000') // 1 billion ETH
  }),

  // Stablecoins
  USDC: new CurrencyEntity('USDC', {
    name: 'USD Coin',
    symbol: 'USDC',
    decimal_places: 6,
    type: 'crypto',
    blockchain_network: 'ethereum',
    contract_address: '0xA0b86a33E6417b49bBa21C75C12C8F69Ca5CB5a1',
    is_stable_coin: true,
    regulatory_status: 'approved',
    minimum_amount: BigInt(1), // 0.000001 USDC
    maximum_amount: BigInt(100000000000000) // 100,000,000 USDC
  }),

  USDT: new CurrencyEntity('USDT', {
    name: 'Tether USD',
    symbol: 'USDT',
    decimal_places: 6,
    type: 'crypto',
    blockchain_network: 'ethereum',
    contract_address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    is_stable_coin: true,
    regulatory_status: 'approved',
    minimum_amount: BigInt(1), // 0.000001 USDT
    maximum_amount: BigInt(100000000000000) // 100,000,000 USDT
  })
} as const;

export type SupportedCurrencyCode = keyof typeof SupportedCurrencies;

// Currency pair for exchange rates
export interface CurrencyPair {
  base: string; // Base currency code
  quote: string; // Quote currency code
  rate: number; // Exchange rate (1 base = rate quote)
  timestamp: Date;
  source: string; // Exchange rate provider
}

export class CurrencyPairEntity implements CurrencyPair {
  constructor(
    public readonly base: string,
    public readonly quote: string,
    public rate: number,
    public timestamp: Date = new Date(),
    public readonly source: string = 'unknown'
  ) {
    this.validatePair();
    this.validateRate();
  }

  public getPairSymbol(): string {
    return `${this.base}/${this.quote}`;
  }

  public getInversePair(): CurrencyPairEntity {
    return new CurrencyPairEntity(
      this.quote,
      this.base,
      1 / this.rate,
      this.timestamp,
      this.source
    );
  }

  public isStale(maxAgeMinutes: number = 30): boolean {
    const now = new Date();
    const ageMinutes = (now.getTime() - this.timestamp.getTime()) / (1000 * 60);
    return ageMinutes > maxAgeMinutes;
  }

  public updateRate(newRate: number, source?: string): void {
    this.validateRate(newRate);
    this.rate = newRate;
    this.timestamp = new Date();
    if (source) {
      (this as any).source = source;
    }
  }

  private validatePair(): void {
    if (!this.base || !this.quote) {
      throw new Error('Both base and quote currencies are required');
    }

    if (this.base === this.quote) {
      throw new Error('Base and quote currencies cannot be the same');
    }

    if (this.base.length < 2 || this.quote.length < 2) {
      throw new Error('Currency codes must be at least 2 characters');
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
}