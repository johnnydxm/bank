import { Entity } from '../../../shared/domain/Entity';

export type DocumentType = 'passport' | 'national_id' | 'drivers_license' | 'utility_bill' | 'bank_statement' | 'proof_of_address' | 'employment_verification' | 'other';
export type DocumentStatus = 'pending' | 'processing' | 'approved' | 'rejected' | 'expired';

export interface ComplianceDocumentProps {
  readonly id: string;
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

export class ComplianceDocument extends Entity<ComplianceDocumentProps> {
  get userId(): string {
    return this.props.userId;
  }

  get type(): DocumentType {
    return this.props.type;
  }

  get status(): DocumentStatus {
    return this.props.status;
  }

  get fileName(): string {
    return this.props.fileName;
  }

  get fileSize(): number {
    return this.props.fileSize;
  }

  get mimeType(): string {
    return this.props.mimeType;
  }

  get uploadedAt(): Date {
    return this.props.uploadedAt;
  }

  get processedAt(): Date | undefined {
    return this.props.processedAt;
  }

  get expiryDate(): Date | undefined {
    return this.props.expiryDate;
  }

  get rejectionReason(): string | undefined {
    return this.props.rejectionReason;
  }

  get metadata(): ComplianceDocumentProps['metadata'] {
    return this.props.metadata;
  }

  public static create(props: Omit<ComplianceDocumentProps, 'id' | 'uploadedAt' | 'status'>): ComplianceDocument {
    return new ComplianceDocument({
      ...props,
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      uploadedAt: new Date()
    });
  }

  public markAsProcessing(): void {
    this.props = {
      ...this.props,
      status: 'processing'
    };
  }

  public approve(extractedData?: Record<string, any>, expiryDate?: Date): void {
    this.props = {
      ...this.props,
      status: 'approved',
      processedAt: new Date(),
      expiryDate,
      metadata: {
        ...this.props.metadata,
        extractedData,
        verificationResults: { verified: true, verifiedAt: new Date() }
      }
    };
  }

  public reject(reason: string): void {
    this.props = {
      ...this.props,
      status: 'rejected',
      processedAt: new Date(),
      rejectionReason: reason
    };
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
      this.props = {
        ...this.props,
        metadata: {
          ...this.props.metadata,
          processingFlags: [...currentFlags, flag]
        }
      };
    }
  }
}