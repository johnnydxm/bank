import { BaseDomainEvent } from '../../../shared/domain/DomainEvent';

export interface BusinessAccountCreatedEventData {
  accountId: string;
  businessName: string;
  accountType: string;
  ownerId: string;
  initialBalance: bigint;
  currency: string;
  metadata?: Record<string, any>;
}

export class BusinessAccountCreatedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    eventData: BusinessAccountCreatedEventData,
    metadata?: Record<string, any>
  ) {
    super(
      'BusinessAccountCreated',
      aggregateId,
      'BusinessAccountAggregate',
      eventData,
      metadata,
      '1.0.0'
    );
  }

  public get accountId(): string {
    return this.eventData.accountId;
  }

  public get businessName(): string {
    return this.eventData.businessName;
  }

  public get accountType(): string {
    return this.eventData.accountType;
  }

  public get ownerId(): string {
    return this.eventData.ownerId;
  }

  public get initialBalance(): bigint {
    return this.eventData.initialBalance;
  }

  public get currency(): string {
    return this.eventData.currency;
  }
}