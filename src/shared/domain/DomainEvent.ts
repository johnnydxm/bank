export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly eventVersion: string;
  readonly occurredAt: Date;
  readonly eventData: Record<string, any>;
  readonly metadata?: Record<string, any> | undefined;
}

export abstract class BaseDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType: string;
  public readonly aggregateId: string;
  public readonly aggregateType: string;
  public readonly eventVersion: string;
  public readonly occurredAt: Date;
  public readonly eventData: Record<string, any>;
  public readonly metadata?: Record<string, any> | undefined;

  constructor(
    eventType: string,
    aggregateId: string,
    aggregateType: string,
    eventData: Record<string, any>,
    metadata?: Record<string, any> | undefined,
    eventVersion: string = '1.0.0'
  ) {
    this.eventId = crypto.randomUUID();
    this.eventType = eventType;
    this.aggregateId = aggregateId;
    this.aggregateType = aggregateType;
    this.eventVersion = eventVersion;
    this.occurredAt = new Date();
    this.eventData = eventData;
    this.metadata = metadata;
  }
}