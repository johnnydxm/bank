import { ValueObject } from '../../../shared/domain/ValueObject';

export enum PaymentProviderEnum {
  APPLE_PAY = 'apple_pay',
  GOOGLE_PAY = 'google_pay',
  DIRECT_BANK = 'direct_bank',
  VIRTUAL = 'virtual',
  CRYPTO = 'crypto',
  PLAID = 'plaid',
  STRIPE = 'stripe',
  ADYEN = 'adyen'
}

export class PaymentProvider extends ValueObject<PaymentProviderEnum> {
  constructor(value: PaymentProviderEnum) {
    super(value);
  }

  protected validate(): void {
    if (!Object.values(PaymentProviderEnum).includes(this._value)) {
      throw new Error(`Invalid payment provider: ${this._value}`);
    }
  }

  public get value(): PaymentProviderEnum {
    return this._value;
  }

  public equals(other: PaymentProvider): boolean {
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }

  // Provider type checks
  public isApplePay(): boolean {
    return this._value === PaymentProviderEnum.APPLE_PAY;
  }

  public isGooglePay(): boolean {
    return this._value === PaymentProviderEnum.GOOGLE_PAY;
  }

  public isDirectBank(): boolean {
    return this._value === PaymentProviderEnum.DIRECT_BANK;
  }

  public isVirtual(): boolean {
    return this._value === PaymentProviderEnum.VIRTUAL;
  }

  public isCrypto(): boolean {
    return this._value === PaymentProviderEnum.CRYPTO;
  }

  public isPlaid(): boolean {
    return this._value === PaymentProviderEnum.PLAID;
  }

  public isStripe(): boolean {
    return this._value === PaymentProviderEnum.STRIPE;
  }

  public isAdyen(): boolean {
    return this._value === PaymentProviderEnum.ADYEN;
  }

  public isMobileWallet(): boolean {
    return this.isApplePay() || this.isGooglePay();
  }

  public isThirdPartyProcessor(): boolean {
    return this.isStripe() || this.isAdyen();
  }

  public supportsTokenization(): boolean {
    return this.isApplePay() || this.isGooglePay() || this.isVirtual() || this.isStripe() || this.isAdyen();
  }

  public requiresKYC(): boolean {
    return this.isDirectBank() || this.isCrypto() || this.isPlaid();
  }

  public supportsRealTimeTransfers(): boolean {
    return this.isCrypto() || this.isVirtual() || this.isApplePay() || this.isGooglePay();
  }

  public getDisplayName(): string {
    const displayNames: Record<PaymentProviderEnum, string> = {
      [PaymentProviderEnum.APPLE_PAY]: 'Apple Pay',
      [PaymentProviderEnum.GOOGLE_PAY]: 'Google Pay',
      [PaymentProviderEnum.DIRECT_BANK]: 'Direct Bank',
      [PaymentProviderEnum.VIRTUAL]: 'Virtual Card',
      [PaymentProviderEnum.CRYPTO]: 'Cryptocurrency',
      [PaymentProviderEnum.PLAID]: 'Plaid',
      [PaymentProviderEnum.STRIPE]: 'Stripe',
      [PaymentProviderEnum.ADYEN]: 'Adyen'
    };
    return displayNames[this._value];
  }

  public getIcon(): string {
    const icons: Record<PaymentProviderEnum, string> = {
      [PaymentProviderEnum.APPLE_PAY]: '🍎',
      [PaymentProviderEnum.GOOGLE_PAY]: '🔍',
      [PaymentProviderEnum.DIRECT_BANK]: '🏦',
      [PaymentProviderEnum.VIRTUAL]: '💳',
      [PaymentProviderEnum.CRYPTO]: '₿',
      [PaymentProviderEnum.PLAID]: '🔗',
      [PaymentProviderEnum.STRIPE]: '💳',
      [PaymentProviderEnum.ADYEN]: '⚡'
    };
    return icons[this._value];
  }

  // Factory methods
  public static applePay(): PaymentProvider {
    return new PaymentProvider(PaymentProviderEnum.APPLE_PAY);
  }

  public static googlePay(): PaymentProvider {
    return new PaymentProvider(PaymentProviderEnum.GOOGLE_PAY);
  }

  public static directBank(): PaymentProvider {
    return new PaymentProvider(PaymentProviderEnum.DIRECT_BANK);
  }

  public static virtual(): PaymentProvider {
    return new PaymentProvider(PaymentProviderEnum.VIRTUAL);
  }

  public static crypto(): PaymentProvider {
    return new PaymentProvider(PaymentProviderEnum.CRYPTO);
  }

  public static plaid(): PaymentProvider {
    return new PaymentProvider(PaymentProviderEnum.PLAID);
  }

  public static stripe(): PaymentProvider {
    return new PaymentProvider(PaymentProviderEnum.STRIPE);
  }

  public static adyen(): PaymentProvider {
    return new PaymentProvider(PaymentProviderEnum.ADYEN);
  }

  public static from(value: string): PaymentProvider {
    const enumValue = Object.values(PaymentProviderEnum).find(
      provider => provider === value.toLowerCase()
    );
    
    if (!enumValue) {
      throw new Error(`Invalid payment provider: ${value}`);
    }
    
    return new PaymentProvider(enumValue);
  }

  public static getAllProviders(): PaymentProvider[] {
    return Object.values(PaymentProviderEnum).map(provider => new PaymentProvider(provider));
  }

  public static getMobileWalletProviders(): PaymentProvider[] {
    return [
      new PaymentProvider(PaymentProviderEnum.APPLE_PAY),
      new PaymentProvider(PaymentProviderEnum.GOOGLE_PAY)
    ];
  }

  public static getThirdPartyProcessors(): PaymentProvider[] {
    return [
      new PaymentProvider(PaymentProviderEnum.STRIPE),
      new PaymentProvider(PaymentProviderEnum.ADYEN)
    ];
  }
}

// For backward compatibility, export the enum constants
export const PaymentProviderConstants = {
  APPLE_PAY: PaymentProviderEnum.APPLE_PAY,
  GOOGLE_PAY: PaymentProviderEnum.GOOGLE_PAY,
  DIRECT_BANK: PaymentProviderEnum.DIRECT_BANK,
  VIRTUAL: PaymentProviderEnum.VIRTUAL,
  CRYPTO: PaymentProviderEnum.CRYPTO,
  PLAID: PaymentProviderEnum.PLAID,
  STRIPE: PaymentProviderEnum.STRIPE,
  ADYEN: PaymentProviderEnum.ADYEN
} as const;