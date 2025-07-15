import { ValueObject } from '../../../shared/domain/ValueObject';

export type KYCStatusType = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'expired' | 'incomplete';

export interface KYCStatusProps {
  readonly status: KYCStatusType;
  readonly verificationLevel: 'basic' | 'standard' | 'enhanced';
  readonly lastUpdated: Date;
  readonly expiryDate?: Date | undefined;
  readonly rejectionReason?: string | undefined;
  readonly verifiedBy?: string | undefined;
}

export class KYCStatus extends ValueObject<KYCStatusProps> {
  get status(): KYCStatusType {
    return this._value.status;
  }

  get verificationLevel(): 'basic' | 'standard' | 'enhanced' {
    return this._value.verificationLevel;
  }

  get lastUpdated(): Date {
    return this._value.lastUpdated;
  }

  get expiryDate(): Date | undefined {
    return this._value.expiryDate;
  }

  get rejectionReason(): string | undefined {
    return this._value.rejectionReason;
  }

  get verifiedBy(): string | undefined {
    return this._value.verifiedBy;
  }

  protected validate(): void {
    if (!this._value.status) {
      throw new Error('KYC status is required');
    }

    if (!this._value.verificationLevel) {
      throw new Error('Verification level is required');
    }

    if (!this._value.lastUpdated) {
      throw new Error('Last updated date is required');
    }

    const validStatuses: KYCStatusType[] = ['pending', 'in_progress', 'approved', 'rejected', 'expired', 'incomplete'];
    if (!validStatuses.includes(this._value.status)) {
      throw new Error(`Invalid KYC status: ${this._value.status}`);
    }

    const validLevels = ['basic', 'standard', 'enhanced'];
    if (!validLevels.includes(this._value.verificationLevel)) {
      throw new Error(`Invalid verification level: ${this._value.verificationLevel}`);
    }
  }

  public static create(props: Omit<KYCStatusProps, 'lastUpdated'>): KYCStatus {
    return new KYCStatus({
      ...props,
      lastUpdated: new Date()
    });
  }

  public static pending(verificationLevel: 'basic' | 'standard' | 'enhanced' = 'basic'): KYCStatus {
    return new KYCStatus({
      status: 'pending',
      verificationLevel,
      lastUpdated: new Date()
    });
  }

  public static approved(verificationLevel: 'basic' | 'standard' | 'enhanced', verifiedBy: string): KYCStatus {
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 2); // 2 years validity

    return new KYCStatus({
      status: 'approved',
      verificationLevel,
      lastUpdated: new Date(),
      expiryDate,
      verifiedBy
    });
  }

  public static rejected(rejectionReason: string): KYCStatus {
    return new KYCStatus({
      status: 'rejected',
      verificationLevel: 'basic',
      lastUpdated: new Date(),
      rejectionReason
    });
  }

  public isExpired(): boolean {
    if (!this.expiryDate) return false;
    return new Date() > this.expiryDate;
  }

  public isValid(): boolean {
    return this.status === 'approved' && !this.isExpired();
  }

  public canUpgrade(): boolean {
    return this.status === 'approved' && this.verificationLevel !== 'enhanced';
  }

  public getDaysUntilExpiry(): number | null {
    if (!this.expiryDate) return null;
    const now = new Date();
    const diffTime = this.expiryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  public isCompleted(): boolean {
    return this.status === 'approved';
  }

  // Static factory methods for enum-like access
  public static get PENDING(): KYCStatus {
    return KYCStatus.pending();
  }

  public static get IN_PROGRESS(): KYCStatus {
    return new KYCStatus({
      status: 'in_progress',
      verificationLevel: 'basic',
      lastUpdated: new Date()
    });
  }

  public static get VERIFIED(): KYCStatus {
    return KYCStatus.approved('standard', 'system');
  }

  public static get FAILED(): KYCStatus {
    return KYCStatus.rejected('Verification failed');
  }
}