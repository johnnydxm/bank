import { ValueObject } from '../../../shared/domain/ValueObject';

export class AccountAddress extends ValueObject<string> {
  constructor(value: string) {
    super(value);
  }

  protected validate(): void {
    if (!this._value || this._value.trim().length === 0) {
      throw new Error('AccountAddress cannot be empty');
    }

    if (this._value.length < 5 || this._value.length > 200) {
      throw new Error('AccountAddress must be between 5 and 200 characters');
    }

    // Validate address format patterns
    const validPatterns = [
      /^business:[a-zA-Z0-9\-_]+$/,                              // business:business-id
      /^business:[a-zA-Z0-9\-_]+:sub:[a-zA-Z0-9\-_]+$/,         // business:business-id:sub:sub-id
      /^business:[a-zA-Z0-9\-_]+:card:[a-zA-Z0-9\-_]+$/,        // business:business-id:card:card-id
      /^user:[a-zA-Z0-9\-_]+$/,                                  // user:user-id
      /^user:[a-zA-Z0-9\-_]+:wallet:[a-zA-Z0-9\-_]+$/,          // user:user-id:wallet:wallet-id
      /^world$/,                                                 // world (for external accounts)
      /^[a-zA-Z0-9\-_:]+$/                                       // general pattern
    ];

    const isValid = validPatterns.some(pattern => pattern.test(this._value));
    if (!isValid) {
      throw new Error('Invalid AccountAddress format');
    }
  }

  public get value(): string {
    return this._value;
  }

  public isBusinessAccount(): boolean {
    return this._value.startsWith('business:');
  }

  public isUserAccount(): boolean {
    return this._value.startsWith('user:');
  }

  public isSubAccount(): boolean {
    return this._value.includes(':sub:');
  }

  public isCardAccount(): boolean {
    return this._value.includes(':card:');
  }

  public isWalletAccount(): boolean {
    return this._value.includes(':wallet:');
  }

  public isWorldAccount(): boolean {
    return this._value === 'world';
  }

  public getBusinessId(): string | null {
    if (!this.isBusinessAccount()) return null;
    const parts = this._value.split(':');
    return parts[1] || null;
  }

  public getUserId(): string | null {
    if (!this.isUserAccount()) return null;
    const parts = this._value.split(':');
    return parts[1] || null;
  }

  public getSubAccountId(): string | null {
    if (!this.isSubAccount()) return null;
    const parts = this._value.split(':');
    const subIndex = parts.indexOf('sub');
    return subIndex >= 0 && parts[subIndex + 1] ? parts[subIndex + 1] || null : null;
  }

  public getCardId(): string | null {
    if (!this.isCardAccount()) return null;
    const parts = this._value.split(':');
    const cardIndex = parts.indexOf('card');
    return cardIndex >= 0 && parts[cardIndex + 1] ? parts[cardIndex + 1] || null : null;
  }

  public getWalletId(): string | null {
    if (!this.isWalletAccount()) return null;
    const parts = this._value.split(':');
    const walletIndex = parts.indexOf('wallet');
    return walletIndex >= 0 && parts[walletIndex + 1] ? parts[walletIndex + 1] || null : null;
  }

  public equals(other: AccountAddress): boolean {
    return this._value === other._value;
  }

  public static createBusinessAccount(businessId: string): AccountAddress {
    return new AccountAddress(`business:${businessId}`);
  }

  public static createUserAccount(userId: string): AccountAddress {
    return new AccountAddress(`user:${userId}`);
  }

  public static createSubAccount(businessId: string, subAccountId: string): AccountAddress {
    return new AccountAddress(`business:${businessId}:sub:${subAccountId}`);
  }

  public static createCardAccount(businessId: string, cardId: string): AccountAddress {
    return new AccountAddress(`business:${businessId}:card:${cardId}`);
  }

  public static createWalletAccount(userId: string, walletId: string): AccountAddress {
    return new AccountAddress(`user:${userId}:wallet:${walletId}`);
  }

  public static createWorldAccount(): AccountAddress {
    return new AccountAddress('world');
  }
}