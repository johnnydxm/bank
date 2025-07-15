import { Entity } from '../../../shared/domain/Entity';

export type VerificationStatus = 'pending' | 'passed' | 'failed' | 'requires_review';

export interface PersonalInformation {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  nationality: string;
  address: Address;
  phoneNumber: string;
  email: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface IdentityDocumentData {
  type: string;
  number: string;
  issuingCountry: string;
  issueDate: Date;
  expiryDate: Date;
  documentImage: string; // Base64 encoded
}

export interface VerificationResult {
  provider: string;
  status: VerificationStatus;
  confidence: number;
  details: Record<string, any>;
  verifiedAt: Date;
}

export interface IdentityVerificationProps {
  readonly personalInfo: PersonalInformation;
  readonly identityDocument: IdentityDocumentData;
  readonly initiatedAt: Date;
  readonly verificationResult?: VerificationResult | undefined;
  readonly status: VerificationStatus;
  readonly completedAt?: Date | undefined;
  readonly failureReason?: string | undefined;
}

export class IdentityVerification extends Entity {
  private _props: IdentityVerificationProps;

  constructor(id: string, props: IdentityVerificationProps) {
    super(id);
    this._props = { ...props };
  }

  get personalInfo(): PersonalInformation {
    return this._props.personalInfo;
  }

  get identityDocument(): IdentityDocumentData {
    return this._props.identityDocument;
  }

  get initiatedAt(): Date {
    return this._props.initiatedAt;
  }

  get verificationResult(): VerificationResult | undefined {
    return this._props.verificationResult;
  }

  get status(): VerificationStatus {
    return this._props.status;
  }

  get completedAt(): Date | undefined {
    return this._props.completedAt;
  }

  get failureReason(): string | undefined {
    return this._props.failureReason;
  }

  public static create(
    personalInfo: PersonalInformation,
    identityDocument: IdentityDocumentData,
    initiatedAt: Date
  ): IdentityVerification {
    const id = IdentityVerification.generateId();
    return new IdentityVerification(id, {
      personalInfo,
      identityDocument,
      initiatedAt,
      status: 'pending'
    });
  }

  public static generateId(): string {
    return `identity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public updateWithResults(verificationResult: VerificationResult): void {
    this._props = {
      ...this._props,
      verificationResult,
      status: verificationResult.status,
      completedAt: verificationResult.verifiedAt
    };
    this.updateTimestamp();
  }

  public markAsCompleted(status: VerificationStatus, reason?: string): void {
    this._props = {
      ...this._props,
      status,
      completedAt: new Date(),
      failureReason: status === 'failed' ? reason : undefined
    };
    this.updateTimestamp();
  }

  public isPending(): boolean {
    return this._props.status === 'pending';
  }

  public isCompleted(): boolean {
    return this._props.status === 'passed' || this._props.status === 'failed';
  }

  public isPassed(): boolean {
    return this._props.status === 'passed';
  }

  public isFailed(): boolean {
    return this._props.status === 'failed';
  }

  public requiresReview(): boolean {
    return this._props.status === 'requires_review';
  }

  public isDocumentExpired(): boolean {
    return new Date() > this._props.identityDocument.expiryDate;
  }

  public getAge(): number {
    const today = new Date();
    const birthDate = this._props.personalInfo.dateOfBirth;
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  public getFullName(): string {
    return `${this._props.personalInfo.firstName} ${this._props.personalInfo.lastName}`;
  }

  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Personal information validation
    if (!this._props.personalInfo.firstName || this._props.personalInfo.firstName.trim().length === 0) {
      errors.push('First name is required');
    }

    if (!this._props.personalInfo.lastName || this._props.personalInfo.lastName.trim().length === 0) {
      errors.push('Last name is required');
    }

    if (!this._props.personalInfo.email || !this.isValidEmail(this._props.personalInfo.email)) {
      errors.push('Valid email is required');
    }

    if (!this._props.personalInfo.dateOfBirth) {
      errors.push('Date of birth is required');
    } else if (this.getAge() < 18) {
      errors.push('User must be at least 18 years old');
    }

    // Identity document validation
    if (!this._props.identityDocument.number || this._props.identityDocument.number.trim().length === 0) {
      errors.push('Document number is required');
    }

    if (!this._props.identityDocument.issuingCountry || this._props.identityDocument.issuingCountry.trim().length === 0) {
      errors.push('Issuing country is required');
    }

    if (this.isDocumentExpired()) {
      errors.push('Identity document has expired');
    }

    // Address validation
    if (!this._props.personalInfo.address.street || this._props.personalInfo.address.street.trim().length === 0) {
      errors.push('Street address is required');
    }

    if (!this._props.personalInfo.address.city || this._props.personalInfo.address.city.trim().length === 0) {
      errors.push('City is required');
    }

    if (!this._props.personalInfo.address.country || this._props.personalInfo.address.country.trim().length === 0) {
      errors.push('Country is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}