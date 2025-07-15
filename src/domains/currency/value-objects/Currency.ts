import { ValueObject } from '../../../shared/domain/ValueObject';
import { CurrencyEntity, SupportedCurrencies, SupportedCurrencyCode } from '../entities/Currency';

export class Currency extends ValueObject<CurrencyEntity> {
  constructor(currencyEntity: CurrencyEntity) {
    super(currencyEntity);
  }

  protected validate(): void {
    if (!this._value) {
      throw new Error('Currency entity is required');
    }

    if (!this._value.is_active) {
      throw new Error('Currency is not active');
    }
  }

  // Delegate to underlying CurrencyEntity
  public get code(): string {
    return this._value.code;
  }

  public get metadata(): CurrencyEntity['metadata'] {
    return this._value.metadata;
  }

  public get is_active(): boolean {
    return this._value.is_active;
  }

  public get created_at(): Date {
    return this._value.created_at;
  }

  public get updated_at(): Date {
    return this._value.updated_at;
  }

  public isFiat(): boolean {
    return this._value.isFiat();
  }

  public isCrypto(): boolean {
    return this._value.isCrypto();
  }

  public isStableCoin(): boolean {
    return this._value.isStableCoin();
  }

  public formatAmount(amount: bigint): string {
    return this._value.formatAmount(amount);
  }

  public parseAmount(amountStr: string): bigint {
    return this._value.parseAmount(amountStr);
  }

  public validateAmount(amount: bigint): { valid: boolean; errors: string[] } {
    return this._value.validateAmount(amount);
  }

  public updateMetadata(updates: Partial<CurrencyEntity['metadata']>): void {
    this._value.updateMetadata(updates);
  }

  public deactivate(): void {
    this._value.deactivate();
  }

  public activate(): void {
    this._value.activate();
  }

  public getFormattedMinimum(): string {
    return this._value.getFormattedMinimum();
  }

  public getFormattedMaximum(): string {
    return this._value.getFormattedMaximum();
  }

  public equals(other: Currency): boolean {
    return this._value.code === other.code;
  }

  public toString(): string {
    return this._value.code;
  }

  public toJSON(): any {
    return {
      code: this._value.code,
      metadata: this._value.metadata,
      is_active: this._value.is_active,
      created_at: this._value.created_at,
      updated_at: this._value.updated_at
    };
  }

  // Factory methods
  public static from(code: SupportedCurrencyCode): Currency {
    const currencyEntity = SupportedCurrencies[code];
    if (!currencyEntity) {
      throw new Error(`Unsupported currency code: ${code}`);
    }
    return new Currency(currencyEntity);
  }

  public static fromEntity(entity: CurrencyEntity): Currency {
    return new Currency(entity);
  }

  public static usd(): Currency {
    return new Currency(SupportedCurrencies.USD);
  }

  public static eur(): Currency {
    return new Currency(SupportedCurrencies.EUR);
  }

  public static gbp(): Currency {
    return new Currency(SupportedCurrencies.GBP);
  }

  public static jpy(): Currency {
    return new Currency(SupportedCurrencies.JPY);
  }

  public static btc(): Currency {
    return new Currency(SupportedCurrencies.BTC);
  }

  public static eth(): Currency {
    return new Currency(SupportedCurrencies.ETH);
  }

  public static usdc(): Currency {
    return new Currency(SupportedCurrencies.USDC);
  }

  public static usdt(): Currency {
    return new Currency(SupportedCurrencies.USDT);
  }

  public static getAllSupported(): Currency[] {
    return Object.values(SupportedCurrencies).map(entity => new Currency(entity));
  }

  public static getFiatCurrencies(): Currency[] {
    return Object.values(SupportedCurrencies)
      .filter(entity => entity.isFiat())
      .map(entity => new Currency(entity));
  }

  public static getCryptoCurrencies(): Currency[] {
    return Object.values(SupportedCurrencies)
      .filter(entity => entity.isCrypto())
      .map(entity => new Currency(entity));
  }

  public static getStableCoins(): Currency[] {
    return Object.values(SupportedCurrencies)
      .filter(entity => entity.isStableCoin())
      .map(entity => new Currency(entity));
  }
}