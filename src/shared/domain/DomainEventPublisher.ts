import { DomainEvent } from './DomainEvent';

export interface DomainEventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishMany(events: DomainEvent[]): Promise<void>;
}

export interface DomainEventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
  canHandle(event: DomainEvent): boolean;
}

export interface DomainEventStore {
  store(event: DomainEvent): Promise<void>;
  getEvents(aggregateId: string): Promise<DomainEvent[]>;
  getEventsByType(eventType: string): Promise<DomainEvent[]>;
}

export class InMemoryDomainEventPublisher implements DomainEventPublisher {
  private handlers: Map<string, DomainEventHandler[]> = new Map();
  private eventStore?: DomainEventStore | undefined;

  constructor(eventStore?: DomainEventStore | undefined) {
    this.eventStore = eventStore;
  }

  public subscribe(eventType: string, handler: DomainEventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  public unsubscribe(eventType: string, handler: DomainEventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    }
  }

  public async publish(event: DomainEvent): Promise<void> {
    try {
      // Store the event first
      if (this.eventStore) {
        await this.eventStore.store(event);
      }

      // Find and execute handlers
      const handlers = this.handlers.get(event.eventType) || [];
      const matchingHandlers = handlers.filter(handler => handler.canHandle(event));

      // Execute all handlers in parallel
      const promises = matchingHandlers.map(handler => 
        handler.handle(event).catch(error => {
          console.error(`Error handling event ${event.eventType}:`, error);
          // Log but don't fail the entire operation
        })
      );

      await Promise.all(promises);
    } catch (error) {
      console.error(`Error publishing event ${event.eventType}:`, error);
      throw error;
    }
  }

  public async publishMany(events: DomainEvent[]): Promise<void> {
    const promises = events.map(event => this.publish(event));
    await Promise.all(promises);
  }

  public getHandlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.length || 0;
  }

  public getAllEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  public clearHandlers(): void {
    this.handlers.clear();
  }
}

export class InMemoryDomainEventStore implements DomainEventStore {
  private events: DomainEvent[] = [];

  public async store(event: DomainEvent): Promise<void> {
    this.events.push(event);
  }

  public async getEvents(aggregateId: string): Promise<DomainEvent[]> {
    return this.events.filter(event => event.aggregateId === aggregateId);
  }

  public async getEventsByType(eventType: string): Promise<DomainEvent[]> {
    return this.events.filter(event => event.eventType === eventType);
  }

  public async getAllEvents(): Promise<DomainEvent[]> {
    return [...this.events];
  }

  public async getEventCount(): Promise<number> {
    return this.events.length;
  }

  public async clear(): Promise<void> {
    this.events = [];
  }
}

export abstract class BaseDomainEventHandler<T extends DomainEvent> implements DomainEventHandler<T> {
  protected abstract eventType: string;

  public canHandle(event: DomainEvent): boolean {
    return event.eventType === this.eventType;
  }

  public abstract handle(event: T): Promise<void>;
}