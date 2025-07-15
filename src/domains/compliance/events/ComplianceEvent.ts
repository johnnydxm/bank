import { BaseDomainEvent } from '../../../shared/domain/DomainEvent';
import { UserId } from '../value-objects/UserId';

export type ComplianceEventType = 
  | 'profile_created'
  | 'kyc_initiated'
  | 'kyc_completed'
  | 'aml_screening_completed'
  | 'risk_score_updated'
  | 'periodic_review_due'
  | 'compliance_alert'
  | 'document_uploaded'
  | 'sanctions_check_completed'
  | 'pep_check_completed';

export interface ComplianceEventData {
  userId: UserId;
  eventType: ComplianceEventType;
  description: string;
  occurredAt: Date;
  additionalData?: Record<string, any> | undefined;
}

export class ComplianceEvent extends BaseDomainEvent {
  constructor(
    userId: UserId,
    eventType: ComplianceEventType,
    description: string,
    occurredAt: Date,
    additionalData?: Record<string, any> | undefined,
    metadata?: Record<string, any> | undefined
  ) {
    super(
      'ComplianceEvent',
      `compliance:${userId.stringValue}`,
      'ComplianceProfileAggregate',
      {
        userId: userId.stringValue,
        eventType,
        description,
        occurredAt: occurredAt.toISOString(),
        additionalData
      },
      metadata,
      '1.0.0'
    );
  }

  public get userId(): string {
    return this.eventData.userId;
  }

  public get complianceEventType(): ComplianceEventType {
    return this.eventData.eventType;
  }

  public get description(): string {
    return this.eventData.description;
  }

  public get occurredAtDate(): Date {
    return new Date(this.eventData.occurredAt);
  }

  public get additionalData(): Record<string, any> | undefined {
    return this.eventData.additionalData;
  }
}