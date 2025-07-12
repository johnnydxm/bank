export interface IEventBus {
  publish(eventName: string, data: any): Promise<void>;
  subscribe(eventName: string, handler: EventHandler): void;
  unsubscribe(eventName: string, handler: EventHandler): void;
}

export type EventHandler = (data: any) => Promise<void> | void;

export interface DomainEvent {
  eventId: string;
  eventName: string;
  aggregateId: string;
  aggregateType: string;
  eventData: any;
  occurredAt: Date;
  version: number;
}
