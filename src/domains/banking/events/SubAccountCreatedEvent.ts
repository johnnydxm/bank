import { BaseDomainEvent } from '../../../shared/domain/DomainEvent';

export interface SubAccountCreatedEventData {
  subAccountId: string;
  parentAccountId: string;
  name: string;
  purpose: string;
  assignedUserId?: string | undefined;
  initialBalance: bigint;
  currency: string;
  permissions: string[];
  limits?: Record<string, any> | undefined;
}

export class SubAccountCreatedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    eventData: SubAccountCreatedEventData,
    metadata?: Record<string, any>
  ) {
    super(
      'SubAccountCreated',
      aggregateId,
      'BusinessAccountAggregate',
      eventData,
      metadata,
      '1.0.0'
    );
  }

  public get subAccountId(): string {
    return this.eventData.subAccountId;
  }

  public get parentAccountId(): string {
    return this.eventData.parentAccountId;
  }

  public get name(): string {
    return this.eventData.name;
  }

  public get purpose(): string {
    return this.eventData.purpose;
  }

  public get assignedUserId(): string | undefined {
    return this.eventData.assignedUserId;
  }

  public get initialBalance(): bigint {
    return this.eventData.initialBalance;
  }

  public get currency(): string {
    return this.eventData.currency;
  }

  public get permissions(): string[] {
    return this.eventData.permissions;
  }
}