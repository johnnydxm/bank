import { ValueObject } from '../../../shared/domain/ValueObject';

export class TransactionId extends ValueObject<string> {
  constructor(value: string) {
    super(value);
  }

  protected validate(): void {
    if (!this._value || this._value.trim().length === 0) {
      throw new Error('TransactionId cannot be empty');
    }

    if (this._value.length < 3 || this._value.length > 100) {
      throw new Error('TransactionId must be between 3 and 100 characters');
    }

    // Validate format: alphanumeric, hyphens, underscores only
    if (!/^[a-zA-Z0-9\-_]+$/.test(this._value)) {
      throw new Error('TransactionId must contain only alphanumeric characters, hyphens, and underscores');
    }
  }

  public get value(): string {
    return this._value;
  }

  public equals(other: TransactionId): boolean {
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }

  /**
   * Generate a new unique transaction ID
   */
  public static generate(): TransactionId {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 9);
    return new TransactionId(`txn_${timestamp}_${randomPart}`);
  }

  /**
   * Create transaction ID from existing value
   */
  public static from(value: string): TransactionId {
    return new TransactionId(value);
  }

  /**
   * Create transaction ID for P2P transfer
   */
  public static forP2PTransfer(): TransactionId {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 9);
    return new TransactionId(`p2p_${timestamp}_${randomPart}`);
  }

  /**
   * Create transaction ID for card transaction
   */
  public static forCardTransaction(): TransactionId {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 9);
    return new TransactionId(`card_${timestamp}_${randomPart}`);
  }

  /**
   * Create transaction ID for crypto transaction
   */
  public static forCryptoTransaction(): TransactionId {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 9);
    return new TransactionId(`crypto_${timestamp}_${randomPart}`);
  }
}