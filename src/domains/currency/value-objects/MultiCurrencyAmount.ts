import { ValueObject } from '../../../shared/domain/ValueObject';
import { CurrencyEntity } from '../entities/Currency';
import { Money } from './Money';

export interface MultiCurrencyAmountProps {
  amount: bigint;
  currency: CurrencyEntity;
}

export class MultiCurrencyAmount extends ValueObject<MultiCurrencyAmountProps> {
  constructor(amount: bigint, currency: CurrencyEntity) {
    super({ amount, currency });
  }

  protected validate(): void {
    if (this._value.amount < 0n) {
      throw new Error('MultiCurrencyAmount cannot be negative');
    }

    if (!this._value.currency) {
      throw new Error('Currency is required');
    }

    if (!this._value.currency.is_active) {
      throw new Error('Currency is not active');
    }

    // Validate amount against currency constraints
    const validation = this._value.currency.validateAmount(this._value.amount);
    if (!validation.valid) {
      throw new Error(`Invalid amount for currency ${this._value.currency.code}: ${validation.errors.join(', ')}`);
    }
  }

  // Getters
  public get amount(): bigint {
    return this._value.amount;
  }

  public get currency(): CurrencyEntity {
    return this._value.currency;
  }

  public get currencyCode(): string {
    return this._value.currency.code;
  }

  public get currencySymbol(): string {
    return this._value.currency.metadata.symbol;
  }

  public get decimalPlaces(): number {
    return this._value.currency.metadata.decimal_places;
  }

  // Utility methods
  public isZero(): boolean {
    return this._value.amount === 0n;
  }

  public isPositive(): boolean {
    return this._value.amount > 0n;
  }

  public isFiat(): boolean {
    return this._value.currency.isFiat();
  }

  public isCrypto(): boolean {
    return this._value.currency.isCrypto();
  }

  public isStableCoin(): boolean {
    return this._value.currency.isStableCoin();
  }

  // Arithmetic operations (same currency only)
  public add(other: MultiCurrencyAmount): MultiCurrencyAmount {
    if (this._value.currency.code !== other.currency.code) {
      throw new Error('Cannot add amounts with different currencies');
    }
    return new MultiCurrencyAmount(this._value.amount + other.amount, this._value.currency);
  }

  public subtract(other: MultiCurrencyAmount): MultiCurrencyAmount {
    if (this._value.currency.code !== other.currency.code) {
      throw new Error('Cannot subtract amounts with different currencies');
    }
    if (this._value.amount < other.amount) {
      throw new Error('Insufficient funds');
    }
    return new MultiCurrencyAmount(this._value.amount - other.amount, this._value.currency);
  }

  public multiply(multiplier: number): MultiCurrencyAmount {
    if (multiplier < 0) {
      throw new Error('Multiplier cannot be negative');
    }
    const result = this._value.amount * BigInt(Math.floor(multiplier * 100)) / 100n;
    return new MultiCurrencyAmount(result, this._value.currency);
  }

  public divide(divisor: number): MultiCurrencyAmount {
    if (divisor <= 0) {
      throw new Error('Divisor must be positive');
    }
    const result = this._value.amount / BigInt(Math.floor(divisor));
    return new MultiCurrencyAmount(result, this._value.currency);
  }

  // Comparison operations (same currency only)
  public isGreaterThan(other: MultiCurrencyAmount): boolean {
    if (this._value.currency.code !== other.currency.code) {
      throw new Error('Cannot compare amounts with different currencies');
    }
    return this._value.amount > other.amount;
  }

  public isLessThan(other: MultiCurrencyAmount): boolean {
    if (this._value.currency.code !== other.currency.code) {
      throw new Error('Cannot compare amounts with different currencies');
    }
    return this._value.amount < other.amount;
  }

  public isEqualTo(other: MultiCurrencyAmount): boolean {
    return this._value.currency.code === other.currency.code && this._value.amount === other.amount;
  }

  public isGreaterThanOrEqualTo(other: MultiCurrencyAmount): boolean {
    return this.isGreaterThan(other) || this.isEqualTo(other);
  }

  public isLessThanOrEqualTo(other: MultiCurrencyAmount): boolean {
    return this.isLessThan(other) || this.isEqualTo(other);
  }

  // Formatting
  public format(): string {
    return this._value.currency.formatAmount(this._value.amount);
  }

  public toString(): string {
    return this.format();
  }

  public toDecimalString(): string {
    const divisor = 10n ** BigInt(this.decimalPlaces);
    const whole = this._value.amount / divisor;
    const fractional = this._value.amount % divisor;
    
    if (fractional === 0n) {
      return whole.toString();
    }
    
    const fractionalStr = fractional.toString().padStart(this.decimalPlaces, '0');
    return `${whole.toString()}.${fractionalStr}`;
  }

  public toSmallestUnit(): bigint {
    return this._value.amount;
  }

  // Conversion to Money (for backward compatibility)
  public toMoney(): Money {
    return new Money(this._value.amount, this._value.currency.code);
  }

  // JSON serialization
  public toJSON(): {
    amount: string;
    currency: string;
    currencyName: string;
    currencySymbol: string;
    decimalPlaces: number;
    type: 'fiat' | 'crypto';
    formatted: string;
  } {
    return {
      amount: this._value.amount.toString(),
      currency: this._value.currency.code,
      currencyName: this._value.currency.metadata.name,
      currencySymbol: this._value.currency.metadata.symbol,
      decimalPlaces: this._value.currency.metadata.decimal_places,
      type: this._value.currency.metadata.type,
      formatted: this.format()
    };
  }

  // Utility methods for exchange calculations
  public getExchangeValue(exchangeRate: number): bigint {
    if (exchangeRate <= 0) {
      throw new Error('Exchange rate must be positive');
    }
    // Convert to floating point for calculation, then back to bigint
    const floatAmount = Number(this._value.amount) / Math.pow(10, this.decimalPlaces);
    const exchangedFloat = floatAmount * exchangeRate;
    return BigInt(Math.floor(exchangedFloat * Math.pow(10, this.decimalPlaces)));
  }

  public applyFee(feePercentage: number): MultiCurrencyAmount {
    if (feePercentage < 0 || feePercentage > 100) {
      throw new Error('Fee percentage must be between 0 and 100');
    }
    const feeAmount = this._value.amount * BigInt(Math.floor(feePercentage * 100)) / 10000n;
    return new MultiCurrencyAmount(this._value.amount - feeAmount, this._value.currency);
  }

  public getFeeAmount(feePercentage: number): MultiCurrencyAmount {
    if (feePercentage < 0 || feePercentage > 100) {
      throw new Error('Fee percentage must be between 0 and 100');
    }
    const feeAmount = this._value.amount * BigInt(Math.floor(feePercentage * 100)) / 10000n;
    return new MultiCurrencyAmount(feeAmount, this._value.currency);
  }

  public equals(other: MultiCurrencyAmount): boolean {
    return this.isEqualTo(other);
  }

  // Factory methods
  public static zero(currency: CurrencyEntity): MultiCurrencyAmount {
    return new MultiCurrencyAmount(0n, currency);
  }

  public static fromDecimal(amount: string, currency: CurrencyEntity): MultiCurrencyAmount {
    const parsedAmount = currency.parseAmount(amount);
    return new MultiCurrencyAmount(parsedAmount, currency);
  }

  public static fromMoney(money: Money, currency: CurrencyEntity): MultiCurrencyAmount {
    if (money.currency !== currency.code) {
      throw new Error('Money currency does not match provided currency');
    }
    return new MultiCurrencyAmount(money.amount, currency);
  }

  public static fromSmallestUnit(amount: bigint, currency: CurrencyEntity): MultiCurrencyAmount {
    return new MultiCurrencyAmount(amount, currency);
  }

  // Currency-specific factory methods
  public static usd(amount: bigint): MultiCurrencyAmount {
    const { SupportedCurrencies } = require('../entities/Currency');
    return new MultiCurrencyAmount(amount, SupportedCurrencies.USD);
  }

  public static eur(amount: bigint): MultiCurrencyAmount {
    const { SupportedCurrencies } = require('../entities/Currency');
    return new MultiCurrencyAmount(amount, SupportedCurrencies.EUR);
  }

  public static gbp(amount: bigint): MultiCurrencyAmount {
    const { SupportedCurrencies } = require('../entities/Currency');
    return new MultiCurrencyAmount(amount, SupportedCurrencies.GBP);
  }

  public static jpy(amount: bigint): MultiCurrencyAmount {
    const { SupportedCurrencies } = require('../entities/Currency');
    return new MultiCurrencyAmount(amount, SupportedCurrencies.JPY);
  }

  public static btc(amount: bigint): MultiCurrencyAmount {
    const { SupportedCurrencies } = require('../entities/Currency');
    return new MultiCurrencyAmount(amount, SupportedCurrencies.BTC);
  }

  public static eth(amount: bigint): MultiCurrencyAmount {
    const { SupportedCurrencies } = require('../entities/Currency');
    return new MultiCurrencyAmount(amount, SupportedCurrencies.ETH);
  }

  public static usdc(amount: bigint): MultiCurrencyAmount {
    const { SupportedCurrencies } = require('../entities/Currency');
    return new MultiCurrencyAmount(amount, SupportedCurrencies.USDC);
  }

  public static usdt(amount: bigint): MultiCurrencyAmount {
    const { SupportedCurrencies } = require('../entities/Currency');
    return new MultiCurrencyAmount(amount, SupportedCurrencies.USDT);
  }
}