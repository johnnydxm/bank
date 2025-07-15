import { ValueObject } from '../../../shared/domain/ValueObject';
import { Money } from '../../currency/value-objects/Money';

export interface CardLimitsProps {
  dailyLimit: bigint;
  weeklyLimit: bigint;
  monthlyLimit: bigint;
  yearlyLimit?: bigint | undefined;
  currency: string;
  perTransactionLimit?: bigint | undefined;
  merchantCategoryLimits?: Record<string, bigint> | undefined;
  channels: string[];
  geography: string[];
  transactionFrequency: {
    maxPerHour?: number | undefined;
    maxPerDay?: number | undefined;
    maxPerWeek?: number | undefined;
    maxPerMonth?: number | undefined;
  };
}

export class CardLimits extends ValueObject<CardLimitsProps> {
  constructor(props: CardLimitsProps) {
    super(props);
  }

  public get daily(): { amount: bigint } {
    return { amount: this._value.dailyLimit };
  }

  public get dailyLimit(): bigint {
    return this._value.dailyLimit;
  }

  public get weekly(): { amount: bigint } {
    return { amount: this._value.weeklyLimit };
  }

  public get weeklyLimit(): bigint {
    return this._value.weeklyLimit;
  }

  public get monthly(): { amount: bigint } {
    return { amount: this._value.monthlyLimit };
  }

  public get monthlyLimit(): bigint {
    return this._value.monthlyLimit;
  }

  public get yearly(): { amount: bigint } {
    return { amount: this._value.yearlyLimit || 0n };
  }

  public get yearlyLimit(): bigint | undefined {
    return this._value.yearlyLimit;
  }

  public get currency(): string {
    return this._value.currency;
  }

  public get perTransactionLimit(): bigint | undefined {
    return this._value.perTransactionLimit;
  }

  public get merchantCategoryLimits(): Record<string, bigint> | undefined {
    return this._value.merchantCategoryLimits;
  }

  public get channels(): string[] {
    return [...this._value.channels];
  }

  public get geography(): string[] {
    return [...this._value.geography];
  }

  public get transactionFrequency(): CardLimitsProps['transactionFrequency'] {
    return { ...this._value.transactionFrequency };
  }

  protected validate(): void {
    if (this._value.dailyLimit <= 0n) {
      throw new Error('Daily limit must be positive');
    }

    if (this._value.weeklyLimit <= 0n) {
      throw new Error('Weekly limit must be positive');
    }

    if (this._value.monthlyLimit <= 0n) {
      throw new Error('Monthly limit must be positive');
    }

    if (this._value.weeklyLimit < this._value.dailyLimit) {
      throw new Error('Weekly limit cannot be less than daily limit');
    }

    if (this._value.monthlyLimit < this._value.weeklyLimit) {
      throw new Error('Monthly limit cannot be less than weekly limit');
    }

    if (this._value.yearlyLimit && this._value.yearlyLimit < this._value.monthlyLimit) {
      throw new Error('Yearly limit cannot be less than monthly limit');
    }

    if (this._value.perTransactionLimit && this._value.perTransactionLimit > this._value.dailyLimit) {
      throw new Error('Per transaction limit cannot exceed daily limit');
    }

    if (!this._value.currency || this._value.currency.trim().length === 0) {
      throw new Error('Currency is required');
    }

    if (!this._value.channels || this._value.channels.length === 0) {
      throw new Error('At least one channel is required');
    }

    if (!this._value.geography || this._value.geography.length === 0) {
      throw new Error('At least one geography is required');
    }
  }

  public getDailyLimit(): bigint {
    return this._value.dailyLimit;
  }

  public getWeeklyLimit(): bigint {
    return this._value.weeklyLimit;
  }

  public getMonthlyLimit(): bigint {
    return this._value.monthlyLimit;
  }

  public getYearlyLimit(): bigint | undefined {
    return this._value.yearlyLimit;
  }

  public canSpend(amount: bigint, currentDailySpent: bigint, currentWeeklySpent: bigint, currentMonthlySpent: bigint, currentYearlySpent?: bigint): boolean {
    // Check daily limit
    if (currentDailySpent + amount > this._value.dailyLimit) {
      return false;
    }

    // Check weekly limit
    if (currentWeeklySpent + amount > this._value.weeklyLimit) {
      return false;
    }

    // Check monthly limit
    if (currentMonthlySpent + amount > this._value.monthlyLimit) {
      return false;
    }

    // Check yearly limit if exists
    if (this._value.yearlyLimit && currentYearlySpent && currentYearlySpent + amount > this._value.yearlyLimit) {
      return false;
    }

    // Check per transaction limit if exists
    if (this._value.perTransactionLimit && amount > this._value.perTransactionLimit) {
      return false;
    }

    return true;
  }

  public getRemainingDaily(currentDailySpent: bigint): bigint {
    return this._value.dailyLimit - currentDailySpent;
  }

  public getRemainingWeekly(currentWeeklySpent: bigint): bigint {
    return this._value.weeklyLimit - currentWeeklySpent;
  }

  public getRemainingMonthly(currentMonthlySpent: bigint): bigint {
    return this._value.monthlyLimit - currentMonthlySpent;
  }

  public getRemainingYearly(currentYearlySpent: bigint): bigint {
    if (!this._value.yearlyLimit) return BigInt(Number.MAX_SAFE_INTEGER);
    return this._value.yearlyLimit - currentYearlySpent;
  }

  public updateLimits(daily?: bigint, weekly?: bigint, monthly?: bigint, yearly?: bigint): CardLimits {
    return new CardLimits({
      ...this._value,
      dailyLimit: daily ?? this._value.dailyLimit,
      weeklyLimit: weekly ?? this._value.weeklyLimit,
      monthlyLimit: monthly ?? this._value.monthlyLimit,
      yearlyLimit: yearly ?? this._value.yearlyLimit
    });
  }

  public static createDefault(currency: string): CardLimits {
    const dailyLimit = currency === 'USD' ? 100000n : 10000000n; // $1000 or equivalent
    const weeklyLimit = dailyLimit * 7n;
    const monthlyLimit = dailyLimit * 30n;
    const yearlyLimit = monthlyLimit * 12n;

    return new CardLimits({
      dailyLimit,
      weeklyLimit,
      monthlyLimit,
      yearlyLimit,
      currency,
      perTransactionLimit: dailyLimit / 2n,
      merchantCategoryLimits: undefined,
      channels: ['online', 'pos', 'atm'],
      geography: ['US', 'CA', 'MX'],
      transactionFrequency: {
        maxPerHour: 10,
        maxPerDay: 50,
        maxPerWeek: 300,
        maxPerMonth: 1000
      }
    });
  }

  public static createUnlimited(currency: string): CardLimits {
    const maxLimit = BigInt(Number.MAX_SAFE_INTEGER);
    
    return new CardLimits({
      dailyLimit: maxLimit,
      weeklyLimit: maxLimit,
      monthlyLimit: maxLimit,
      yearlyLimit: maxLimit,
      currency,
      perTransactionLimit: undefined,
      merchantCategoryLimits: undefined,
      channels: ['online', 'pos', 'atm', 'contactless'],
      geography: ['*'], // Global access
      transactionFrequency: {
        maxPerHour: undefined,
        maxPerDay: undefined,
        maxPerWeek: undefined,
        maxPerMonth: undefined
      }
    });
  }
}