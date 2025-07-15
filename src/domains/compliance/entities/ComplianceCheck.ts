import { Entity } from '../../../shared/domain/Entity';

export type ComplianceCheckType = 'identity_verification' | 'document_verification' | 'sanctions_screening' | 'pep_screening' | 'behavior_analysis';
export type ComplianceCheckStatus = 'pending' | 'passed' | 'failed' | 'requires_review';

export interface ComplianceCheckProps {
  readonly type: ComplianceCheckType;
  readonly provider: string;
  readonly status: ComplianceCheckStatus;
  readonly confidence: number; // 0-1
  readonly details: Record<string, any>;
  readonly checkedAt: Date;
  readonly reviewedAt?: Date | undefined;
  readonly reviewedBy?: string | undefined;
  readonly reviewNotes?: string | undefined;
}

export class ComplianceCheck extends Entity {
  private _props: ComplianceCheckProps;

  constructor(id: string, props: ComplianceCheckProps) {
    super(id);
    this._props = { ...props };
  }

  get type(): ComplianceCheckType {
    return this._props.type;
  }

  get provider(): string {
    return this._props.provider;
  }

  get status(): ComplianceCheckStatus {
    return this._props.status;
  }

  get confidence(): number {
    return this._props.confidence;
  }

  get details(): Record<string, any> {
    return this._props.details;
  }

  get checkedAt(): Date {
    return this._props.checkedAt;
  }

  get reviewedAt(): Date | undefined {
    return this._props.reviewedAt;
  }

  get reviewedBy(): string | undefined {
    return this._props.reviewedBy;
  }

  get reviewNotes(): string | undefined {
    return this._props.reviewNotes;
  }

  public static create(props: ComplianceCheckProps): ComplianceCheck {
    const id = ComplianceCheck.generateId();
    return new ComplianceCheck(id, props);
  }

  public static generateId(): string {
    return `check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public markForReview(reviewNotes?: string): void {
    this._props = {
      ...this._props,
      status: 'requires_review',
      reviewNotes
    };
    this.updateTimestamp();
  }

  public approveCheck(reviewedBy: string, reviewNotes?: string): void {
    this._props = {
      ...this._props,
      status: 'passed',
      reviewedAt: new Date(),
      reviewedBy,
      reviewNotes
    };
    this.updateTimestamp();
  }

  public rejectCheck(reviewedBy: string, reviewNotes: string): void {
    this._props = {
      ...this._props,
      status: 'failed',
      reviewedAt: new Date(),
      reviewedBy,
      reviewNotes
    };
    this.updateTimestamp();
  }

  public isHighConfidence(): boolean {
    return this._props.confidence >= 0.8;
  }

  public isLowConfidence(): boolean {
    return this._props.confidence < 0.5;
  }

  public requiresManualReview(): boolean {
    return this._props.status === 'requires_review' || this.isLowConfidence();
  }

  public isPassed(): boolean {
    return this._props.status === 'passed';
  }

  public isFailed(): boolean {
    return this._props.status === 'failed';
  }

  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this._props.type) {
      errors.push('Compliance check type is required');
    }

    if (!this._props.provider || this._props.provider.trim().length === 0) {
      errors.push('Provider is required');
    }

    if (!this._props.status) {
      errors.push('Status is required');
    }

    if (this._props.confidence < 0 || this._props.confidence > 1) {
      errors.push('Confidence must be between 0 and 1');
    }

    if (!this._props.checkedAt) {
      errors.push('Checked date is required');
    }

    const validTypes: ComplianceCheckType[] = ['identity_verification', 'document_verification', 'sanctions_screening', 'pep_screening', 'behavior_analysis'];
    if (!validTypes.includes(this._props.type)) {
      errors.push(`Invalid compliance check type: ${this._props.type}`);
    }

    const validStatuses: ComplianceCheckStatus[] = ['pending', 'passed', 'failed', 'requires_review'];
    if (!validStatuses.includes(this._props.status)) {
      errors.push(`Invalid status: ${this._props.status}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}