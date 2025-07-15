import { Entity } from '../../../shared/domain/Entity';

export type DocumentType = 'passport' | 'national_id' | 'drivers_license' | 'utility_bill' | 'bank_statement' | 'proof_of_address' | 'employment_verification' | 'other';
export type DocumentStatus = 'pending' | 'processing' | 'approved' | 'rejected' | 'expired';

export interface ComplianceDocumentProps {
  readonly userId: string;
  readonly type: DocumentType;
  readonly status: DocumentStatus;
  readonly fileName: string;
  readonly fileSize: number;
  readonly mimeType: string;
  readonly uploadedAt: Date;
  readonly processedAt?: Date | undefined;
  readonly expiryDate?: Date | undefined;
  readonly rejectionReason?: string | undefined;
  readonly metadata?: {
    readonly extractedData?: Record<string, any> | undefined;
    readonly verificationResults?: Record<string, any> | undefined;
    readonly processingFlags?: string[] | undefined;
  } | undefined;
}

export class ComplianceDocument extends Entity {
  private _props: ComplianceDocumentProps;

  constructor(id: string, props: ComplianceDocumentProps) {
    super(id);
    this._props = { ...props };
  }
  get userId(): string {
    return this._props.userId;
  }

  get type(): DocumentType {
    return this._props.type;
  }

  get status(): DocumentStatus {
    return this._props.status;
  }

  get fileName(): string {
    return this._props.fileName;
  }

  get fileSize(): number {
    return this._props.fileSize;
  }

  get mimeType(): string {
    return this._props.mimeType;
  }

  get uploadedAt(): Date {
    return this._props.uploadedAt;
  }

  get processedAt(): Date | undefined {
    return this._props.processedAt;
  }

  get expiryDate(): Date | undefined {
    return this._props.expiryDate;
  }

  get rejectionReason(): string | undefined {
    return this._props.rejectionReason;
  }

  get metadata(): ComplianceDocumentProps['metadata'] {
    return this._props.metadata;
  }

  public static create(props: Omit<ComplianceDocumentProps, 'uploadedAt' | 'status'>): ComplianceDocument {
    const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return new ComplianceDocument(id, {
      ...props,
      status: 'pending',
      uploadedAt: new Date()
    });
  }

  public static generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public markAsProcessing(): void {
    this._props = {
      ...this._props,
      status: 'processing'
    };
    this.updateTimestamp();
  }

  public approve(extractedData?: Record<string, any>, expiryDate?: Date): void {
    this._props = {
      ...this._props,
      status: 'approved',
      processedAt: new Date(),
      expiryDate,
      metadata: {
        ...this._props.metadata,
        extractedData,
        verificationResults: { verified: true, verifiedAt: new Date() }
      }
    };
    this.updateTimestamp();
  }

  public reject(reason: string): void {
    this._props = {
      ...this._props,
      status: 'rejected',
      processedAt: new Date(),
      rejectionReason: reason
    };
    this.updateTimestamp();
  }

  public isExpired(): boolean {
    if (!this.expiryDate) return false;
    return new Date() > this.expiryDate;
  }

  public isValid(): boolean {
    return this.status === 'approved' && !this.isExpired();
  }

  public isIdentityDocument(): boolean {
    return ['passport', 'national_id', 'drivers_license'].includes(this.type);
  }

  public isAddressProof(): boolean {
    return ['utility_bill', 'bank_statement', 'proof_of_address'].includes(this.type);
  }

  public getValidityDays(): number | null {
    if (!this.expiryDate) return null;
    const now = new Date();
    const diffTime = this.expiryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  public addProcessingFlag(flag: string): void {
    const currentFlags = this.metadata?.processingFlags || [];
    if (!currentFlags.includes(flag)) {
      this._props = {
        ...this._props,
        metadata: {
          ...this._props.metadata,
          processingFlags: [...currentFlags, flag]
        }
      };
      this.updateTimestamp();
    }
  }

  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this._props.userId || this._props.userId.trim().length === 0) {
      errors.push('User ID is required');
    }

    if (!this._props.fileName || this._props.fileName.trim().length === 0) {
      errors.push('File name is required');
    }

    if (this._props.fileSize <= 0) {
      errors.push('File size must be greater than 0');
    }

    if (!this._props.mimeType || this._props.mimeType.trim().length === 0) {
      errors.push('MIME type is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}