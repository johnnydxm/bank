import { ValueObject } from '../../../shared/domain/ValueObject';
import { PaymentProvider } from './PaymentProvider';

export interface CardTokenProps {
  id: string;
  token: string;
  provider: PaymentProvider;
  cardType: string;
  maskedNumber: string;
  expiryDate?: string | undefined;
  createdAt: Date;
  expiresAt: Date;
}

export class CardToken extends ValueObject<CardTokenProps> {
  constructor(
    id: string,
    token: string,
    provider: PaymentProvider,
    cardType: string,
    maskedNumber: string,
    expiryDate?: string | undefined,
    createdAt: Date = new Date(),
    expiresAt: Date = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)) // 1 year default
  ) {
    super({
      id,
      token,
      provider,
      cardType,
      maskedNumber,
      expiryDate,
      createdAt,
      expiresAt
    });
  }

  protected validate(): void {
    if (!this._value.id || this._value.id.trim().length === 0) {
      throw new Error('CardToken ID cannot be empty');
    }

    if (!this._value.token || this._value.token.trim().length === 0) {
      throw new Error('CardToken token cannot be empty');
    }

    if (!this._value.provider) {
      throw new Error('CardToken provider is required');
    }

    if (!this._value.cardType || this._value.cardType.trim().length === 0) {
      throw new Error('CardToken cardType cannot be empty');
    }

    if (!this._value.maskedNumber || this._value.maskedNumber.trim().length === 0) {
      throw new Error('CardToken maskedNumber cannot be empty');
    }

    // Validate ID format
    if (!/^[a-zA-Z0-9\-_]+$/.test(this._value.id)) {
      throw new Error('CardToken ID must contain only alphanumeric characters, hyphens, and underscores');
    }

    // Validate token format (should be secure)
    if (this._value.token.length < 16) {
      throw new Error('CardToken token must be at least 16 characters long');
    }

    // Validate masked number format
    if (!/[\*\d\-\s]+/.test(this._value.maskedNumber)) {
      throw new Error('CardToken maskedNumber must contain only digits, asterisks, hyphens, and spaces');
    }

    // Validate expiry date format if provided
    if (this._value.expiryDate && !/^\d{2}\/\d{2,4}$/.test(this._value.expiryDate)) {
      throw new Error('CardToken expiryDate must be in MM/YY or MM/YYYY format');
    }

    // Validate dates
    if (this._value.expiresAt <= this._value.createdAt) {
      throw new Error('CardToken expiresAt must be after createdAt');
    }
  }

  // Getters
  public get id(): string {
    return this._value.id;
  }

  public get token(): string {
    return this._value.token;
  }

  public get provider(): PaymentProvider {
    return this._value.provider;
  }

  public get cardType(): string {
    return this._value.cardType;
  }

  public get maskedNumber(): string {
    return this._value.maskedNumber;
  }

  public get expiryDate(): string | undefined {
    return this._value.expiryDate;
  }

  public get createdAt(): Date {
    return this._value.createdAt;
  }

  public get expiresAt(): Date {
    return this._value.expiresAt;
  }

  // Utility methods
  public isExpired(): boolean {
    return new Date() > this._value.expiresAt;
  }

  public isValid(): boolean {
    return !this.isExpired();
  }

  public getTimeUntilExpiry(): number {
    const now = new Date().getTime();
    const expires = this._value.expiresAt.getTime();
    return Math.max(0, expires - now);
  }

  public getDaysUntilExpiry(): number {
    return Math.floor(this.getTimeUntilExpiry() / (1000 * 60 * 60 * 24));
  }

  public isExpiringWithinDays(days: number): boolean {
    return this.getDaysUntilExpiry() <= days;
  }

  public isVirtual(): boolean {
    return this._value.provider.isVirtual();
  }

  public isMobileWallet(): boolean {
    return this._value.provider.isMobileWallet();
  }

  public isDirectBank(): boolean {
    return this._value.provider.isDirectBank();
  }

  public isCrypto(): boolean {
    return this._value.provider.isCrypto();
  }

  public getProviderDisplayName(): string {
    return this._value.provider.getDisplayName();
  }

  public getProviderIcon(): string {
    return this._value.provider.getIcon();
  }

  public getCardTypeDisplayName(): string {
    const displayNames: Record<string, string> = {
      'VISA': 'Visa',
      'MASTERCARD': 'Mastercard',
      'AMEX': 'American Express',
      'DISCOVER': 'Discover',
      'VIRTUAL': 'Virtual Card',
      'BANK_ACCOUNT': 'Bank Account',
      'DEBIT': 'Debit Card',
      'CREDIT': 'Credit Card'
    };
    return displayNames[this._value.cardType.toUpperCase()] || this._value.cardType;
  }

  public getSecurityLevel(): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (this._value.provider.isCrypto()) {
      return 'HIGH';
    }
    if (this._value.provider.isMobileWallet()) {
      return 'HIGH';
    }
    if (this._value.provider.isVirtual()) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  public canBeUsedForAmount(amount: bigint): boolean {
    // Virtual cards and mobile wallets typically have higher limits
    if (this._value.provider.isVirtual() || this._value.provider.isMobileWallet()) {
      return true;
    }
    
    // For demonstration purposes, assume a reasonable limit
    const maxAmount = BigInt(100000000); // $1,000,000 in cents
    return amount <= maxAmount;
  }

  public equals(other: CardToken): boolean {
    return this._value.id === other.id;
  }

  public toString(): string {
    return `${this._value.provider.getDisplayName()} - ${this._value.maskedNumber}`;
  }

  // Factory methods
  public static createVirtual(
    id: string,
    token: string,
    maskedNumber: string,
    expiryDate: string
  ): CardToken {
    return new CardToken(
      id,
      token,
      PaymentProvider.virtual(),
      'VIRTUAL',
      maskedNumber,
      expiryDate
    );
  }

  public static createApplePay(
    id: string,
    token: string,
    cardType: string,
    maskedNumber: string,
    expiryDate: string
  ): CardToken {
    return new CardToken(
      id,
      token,
      PaymentProvider.applePay(),
      cardType,
      maskedNumber,
      expiryDate
    );
  }

  public static createGooglePay(
    id: string,
    token: string,
    cardType: string,
    maskedNumber: string,
    expiryDate: string
  ): CardToken {
    return new CardToken(
      id,
      token,
      PaymentProvider.googlePay(),
      cardType,
      maskedNumber,
      expiryDate
    );
  }

  public static createDirectBank(
    id: string,
    token: string,
    maskedAccountNumber: string
  ): CardToken {
    return new CardToken(
      id,
      token,
      PaymentProvider.directBank(),
      'BANK_ACCOUNT',
      maskedAccountNumber,
      undefined, // Bank accounts don't have expiry dates
      new Date(),
      new Date(Date.now() + (5 * 365 * 24 * 60 * 60 * 1000)) // 5 years for bank accounts
    );
  }

  public static createCrypto(
    id: string,
    token: string,
    cryptoAddress: string
  ): CardToken {
    return new CardToken(
      id,
      token,
      PaymentProvider.crypto(),
      'CRYPTO',
      cryptoAddress,
      undefined, // Crypto addresses don't have expiry dates
      new Date(),
      new Date(Date.now() + (10 * 365 * 24 * 60 * 60 * 1000)) // 10 years for crypto
    );
  }

  public toJSON(): CardTokenProps {
    return {
      id: this._value.id,
      token: this._value.token,
      provider: this._value.provider,
      cardType: this._value.cardType,
      maskedNumber: this._value.maskedNumber,
      expiryDate: this._value.expiryDate,
      createdAt: this._value.createdAt,
      expiresAt: this._value.expiresAt
    };
  }
}