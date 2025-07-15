import { BaseDomainEvent } from '../../../shared/domain/DomainEvent';
import { UserId } from '../value-objects/UserId';
import { KYCStatus } from '../value-objects/KYCStatus';

export interface KYCStatusUpdatedEventData {
  userId: string;
  oldStatus: {
    status: string;
    verificationLevel: string;
    lastUpdated: string;
  };
  newStatus: {
    status: string;
    verificationLevel: string;
    lastUpdated: string;
  };
  updatedAt: string;
  reason?: string | undefined;
}

export class KYCStatusUpdatedEvent extends BaseDomainEvent {
  constructor(
    userId: UserId,
    oldStatus: KYCStatus,
    newStatus: KYCStatus,
    updatedAt: Date,
    reason?: string | undefined,
    metadata?: Record<string, any> | undefined
  ) {
    super(
      'KYCStatusUpdated',
      `compliance:${userId.stringValue}`,
      'ComplianceProfileAggregate',
      {
        userId: userId.stringValue,
        oldStatus: {
          status: oldStatus.status,
          verificationLevel: oldStatus.verificationLevel,
          lastUpdated: oldStatus.lastUpdated.toISOString()
        },
        newStatus: {
          status: newStatus.status,
          verificationLevel: newStatus.verificationLevel,
          lastUpdated: newStatus.lastUpdated.toISOString()
        },
        updatedAt: updatedAt.toISOString(),
        reason
      },
      metadata,
      '1.0.0'
    );
  }

  public get userId(): string {
    return this.eventData.userId;
  }

  public get oldStatus(): KYCStatusUpdatedEventData['oldStatus'] {
    return this.eventData.oldStatus;
  }

  public get newStatus(): KYCStatusUpdatedEventData['newStatus'] {
    return this.eventData.newStatus;
  }

  public get updatedAtDate(): Date {
    return new Date(this.eventData.updatedAt);
  }

  public get reason(): string | undefined {
    return this.eventData.reason;
  }

  public get isUpgrade(): boolean {
    const oldLevel = this.oldStatus.verificationLevel;
    const newLevel = this.newStatus.verificationLevel;
    
    const levels = ['basic', 'standard', 'enhanced'];
    return levels.indexOf(newLevel) > levels.indexOf(oldLevel);
  }

  public get isApproval(): boolean {
    return this.newStatus.status === 'approved' && this.oldStatus.status !== 'approved';
  }

  public get isRejection(): boolean {
    return this.newStatus.status === 'rejected' && this.oldStatus.status !== 'rejected';
  }
}