import { ValueObject } from '../../../shared/domain/ValueObject';

export interface MoneyProps {
  amount: bigint;
  currency: string;
}

export class Money extends ValueObject<MoneyProps> {
  constructor(amount: bigint, currency: string) {
    super({ amount, currency });
  }

  public get amount(): bigint {
    return this._value.amount;
  }

  public get currency(): string {
    return this._value.currency;
  }

  protected validate(): void {
    if (this._value.amount < 0n) {
      throw new Error('Money amount cannot be negative');
    }

    if (!this._value.currency || this._value.currency.trim().length === 0) {
      throw new Error('Currency is required');
    }

    if (this._value.currency.length !== 3 && !this._value.currency.match(/^(BTC|ETH|USDC|USDT)$/)) {
      throw new Error('Invalid currency format');
    }
  }

  public add(other: Money): Money {
    if (this._value.currency !== other.currency) {
      throw new Error('Cannot add money with different currencies');
    }
    return new Money(this._value.amount + other.amount, this._value.currency);
  }

  public subtract(other: Money): Money {
    if (this._value.currency !== other.currency) {
      throw new Error('Cannot subtract money with different currencies');
    }
    if (this._value.amount < other.amount) {
      throw new Error('Insufficient funds');
    }
    return new Money(this._value.amount - other.amount, this._value.currency);
  }

  public multiply(multiplier: number): Money {
    if (multiplier < 0) {
      throw new Error('Multiplier cannot be negative');
    }
    const result = this._value.amount * BigInt(Math.floor(multiplier * 100)) / 100n;
    return new Money(result, this._value.currency);
  }

  public divide(divisor: number): Money {
    if (divisor <= 0) {
      throw new Error('Divisor must be positive');
    }
    const result = this._value.amount / BigInt(Math.floor(divisor));
    return new Money(result, this._value.currency);
  }

  public isZero(): boolean {
    return this._value.amount === 0n;
  }

  public isPositive(): boolean {
    return this._value.amount > 0n;
  }

  public isGreaterThan(other: Money): boolean {
    if (this._value.currency !== other.currency) {
      throw new Error('Cannot compare money with different currencies');
    }
    return this._value.amount > other.amount;
  }

  public isLessThan(other: Money): boolean {
    if (this._value.currency !== other.currency) {
      throw new Error('Cannot compare money with different currencies');
    }
    return this._value.amount < other.amount;
  }

  public isEqualTo(other: Money): boolean {
    return this._value.currency === other.currency && this._value.amount === other.amount;
  }

  public format(): string {
    const decimalPlaces = this.getDecimalPlaces();
    const divisor = 10n ** BigInt(decimalPlaces);
    const whole = this._value.amount / divisor;
    const fractional = this._value.amount % divisor;
    
    if (fractional === 0n) {
      return `${whole} ${this._value.currency}`;
    }
    
    const fractionalStr = fractional.toString().padStart(decimalPlaces, '0');
    return `${whole}.${fractionalStr} ${this._value.currency}`;
  }

  private getDecimalPlaces(): number {
    switch (this._value.currency) {
      case 'BTC':
        return 8;
      case 'ETH':
        return 18;
      case 'USDC':
      case 'USDT':
        return 6;
      default:
        return 2; // Fiat currencies
    }
  }

  public toSmallestUnit(): bigint {
    return this._value.amount;
  }

  public static fromDecimal(amount: string, currency: string): Money {
    const decimalPlaces = new Money(0n, currency).getDecimalPlaces();
    const [whole, fractional = ''] = amount.split('.');
    
    const wholeBigInt = BigInt(whole || '0');
    const fractionalPadded = fractional.padEnd(decimalPlaces, '0').substring(0, decimalPlaces);
    const fractionalBigInt = BigInt(fractionalPadded || '0');
    
    const totalAmount = wholeBigInt * (10n ** BigInt(decimalPlaces)) + fractionalBigInt;
    return new Money(totalAmount, currency);
  }

  public static zero(currency: string): Money {
    return new Money(0n, currency);
  }

  public toJSON(): MoneyProps {
    return {
      amount: this._value.amount,
      currency: this._value.currency
    };
  }
}