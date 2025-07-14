import { BaseDomainEvent } from '../../../shared/domain/DomainEvent';

export interface VirtualCardIssuedEventData {
  cardId: string;
  accountId: string;
  cardholderName: string;
  cardType: 'debit' | 'credit';
  currency: string;
  dailyLimit: bigint;
  monthlyLimit: bigint;
  allowedChannels: string[];
  allowedMerchants?: string[] | undefined;
  expiryDate: Date;
  isActive: boolean;
  assignedUserId?: string | undefined;
}

export class VirtualCardIssuedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    eventData: VirtualCardIssuedEventData,
    metadata?: Record<string, any>
  ) {
    super(
      'VirtualCardIssued',
      aggregateId,
      'BusinessAccountAggregate',
      eventData,
      metadata,
      '1.0.0'
    );
  }

  public get cardId(): string {
    return this.eventData.cardId;
  }

  public get accountId(): string {
    return this.eventData.accountId;
  }

  public get cardholderName(): string {
    return this.eventData.cardholderName;
  }

  public get cardType(): 'debit' | 'credit' {
    return this.eventData.cardType;
  }

  public get currency(): string {
    return this.eventData.currency;
  }

  public get dailyLimit(): bigint {
    return this.eventData.dailyLimit;
  }

  public get monthlyLimit(): bigint {
    return this.eventData.monthlyLimit;
  }

  public get allowedChannels(): string[] {
    return this.eventData.allowedChannels;
  }

  public get isActive(): boolean {
    return this.eventData.isActive;
  }
}