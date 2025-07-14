import { ValueObject } from '../../../shared/domain/ValueObject';

export class BusinessId extends ValueObject<string> {
  constructor(value: string) {
    super(value);
  }

  protected validate(): void {
    if (!this._value || this._value.trim().length === 0) {
      throw new Error('BusinessId cannot be empty');
    }

    if (this._value.length < 3 || this._value.length > 50) {
      throw new Error('BusinessId must be between 3 and 50 characters');
    }

    // Basic format validation
    if (!/^[a-zA-Z0-9\-_]+$/.test(this._value)) {
      throw new Error('BusinessId can only contain letters, numbers, hyphens, and underscores');
    }
  }

  public static generate(businessName: string): BusinessId {
    const timestamp = Date.now().toString(36);
    const cleanName = businessName.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 20);
    
    return new BusinessId(`biz-${cleanName}-${timestamp}`);
  }

  public equals(other: BusinessId): boolean {
    return this._value === other._value;
  }
}