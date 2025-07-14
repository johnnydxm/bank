import { DomainEvent } from './DomainEvent';

export abstract class AggregateRoot {
  private _domainEvents: DomainEvent[] = [];
  protected _id: string;
  protected _version: number = 0;
  protected _createdAt: Date;
  protected _updatedAt: Date;

  constructor(id: string) {
    this._id = id;
    this._createdAt = new Date();
    this._updatedAt = new Date();
  }

  public get id(): string {
    return this._id;
  }

  public get version(): number {
    return this._version;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
    this._version++;
    this._updatedAt = new Date();
  }

  public getUncommittedEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  public markEventsAsCommitted(): void {
    this._domainEvents = [];
  }

  protected updateTimestamp(): void {
    this._updatedAt = new Date();
  }

  public equals(other: AggregateRoot): boolean {
    return this._id === other._id;
  }
}