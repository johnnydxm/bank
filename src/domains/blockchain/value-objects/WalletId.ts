import { ValueObject } from '../../../shared/domain/ValueObject';

export class WalletId extends ValueObject<string> {
  constructor(value: string) {
    super(value);
  }

  protected validate(): void {
    if (!this._value || this._value.trim().length === 0) {
      throw new Error('WalletId cannot be empty');
    }

    if (this._value.length < 10 || this._value.length > 100) {
      throw new Error('WalletId must be between 10 and 100 characters');
    }

    // Basic format validation for common wallet ID patterns
    if (!/^[a-zA-Z0-9\-_]+$/.test(this._value)) {
      throw new Error('WalletId contains invalid characters');
    }
  }

  public static generate(): WalletId {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return new WalletId(`wallet_${timestamp}_${random}`);
  }
}