export interface RealtimeEvent {
  id: string;
  type: RealtimeEventType;
  userId: string;
  data: any;
  timestamp: Date;
  correlationId: string;
  metadata: EventMetadata;
}

export type RealtimeEventType = 
  | 'transaction_created'
  | 'transaction_processing'
  | 'transaction_completed'
  | 'transaction_failed'
  | 'balance_updated'
  | 'currency_converted'
  | 'account_created'
  | 'exchange_rate_updated'
  | 'system_alert'
  | 'performance_metric';

export interface EventMetadata {
  source: string;
  version: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  retryable: boolean;
  expiresAt?: Date | undefined;
  tags?: string[] | undefined;
  [key: string]: any;
}

export interface EventSubscription {
  id: string;
  userId: string;
  eventTypes: RealtimeEventType[];
  channels: SubscriptionChannel[];
  filters?: EventFilter[] | undefined;
  isActive: boolean;
  createdAt: Date;
  lastActivity?: Date | undefined;
}

export type SubscriptionChannel = 'websocket' | 'webhook' | 'sse' | 'push';

export interface EventFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
  value: any;
}

export interface WebSocketConnection {
  id: string;
  userId: string;
  connectionId: string;
  isAuthenticated: boolean;
  subscribedEvents: RealtimeEventType[];
  lastPing: Date;
  connectionStarted: Date;
  metadata: {
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
    [key: string]: any;
  };
}

export class RealtimeEventEntity implements RealtimeEvent {
  constructor(
    public readonly id: string,
    public readonly type: RealtimeEventType,
    public readonly userId: string,
    public readonly data: any,
    public readonly timestamp: Date = new Date(),
    public readonly correlationId: string = `corr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    public readonly metadata: EventMetadata = {
      source: 'dway-platform',
      version: '1.0.0',
      priority: 'medium',
      retryable: true
    }
  ) {}

  public isExpired(): boolean {
    if (!this.metadata.expiresAt) return false;
    return new Date() > this.metadata.expiresAt;
  }

  public shouldRetry(): boolean {
    return this.metadata.retryable && !this.isExpired();
  }

  public matchesFilter(filter: EventFilter): boolean {
    const fieldValue = this.getFieldValue(filter.field);
    
    switch (filter.operator) {
      case 'equals':
        return fieldValue === filter.value;
      case 'contains':
        return String(fieldValue).includes(String(filter.value));
      case 'startsWith':
        return String(fieldValue).startsWith(String(filter.value));
      case 'endsWith':
        return String(fieldValue).endsWith(String(filter.value));
      case 'greaterThan':
        return Number(fieldValue) > Number(filter.value);
      case 'lessThan':
        return Number(fieldValue) < Number(filter.value);
      default:
        return false;
    }
  }

  public getPriorityScore(): number {
    switch (this.metadata.priority) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  public toJSON(): RealtimeEvent {
    return {
      id: this.id,
      type: this.type,
      userId: this.userId,
      data: this.data,
      timestamp: this.timestamp,
      correlationId: this.correlationId,
      metadata: this.metadata
    };
  }

  private getFieldValue(field: string): any {
    const fieldParts = field.split('.');
    let value: any = this;
    
    for (const part of fieldParts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }
}

export class EventSubscriptionEntity implements EventSubscription {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public eventTypes: RealtimeEventType[],
    public channels: SubscriptionChannel[],
    public filters?: EventFilter[] | undefined,
    public isActive: boolean = true,
    public readonly createdAt: Date = new Date(),
    public lastActivity?: Date | undefined
  ) {}

  public updateActivity(): void {
    this.lastActivity = new Date();
  }

  public subscribe(eventType: RealtimeEventType): void {
    if (!this.eventTypes.includes(eventType)) {
      this.eventTypes.push(eventType);
      this.updateActivity();
    }
  }

  public unsubscribe(eventType: RealtimeEventType): void {
    const index = this.eventTypes.indexOf(eventType);
    if (index > -1) {
      this.eventTypes.splice(index, 1);
      this.updateActivity();
    }
  }

  public addChannel(channel: SubscriptionChannel): void {
    if (!this.channels.includes(channel)) {
      this.channels.push(channel);
      this.updateActivity();
    }
  }

  public removeChannel(channel: SubscriptionChannel): void {
    const index = this.channels.indexOf(channel);
    if (index > -1) {
      this.channels.splice(index, 1);
      this.updateActivity();
    }
  }

  public matchesEvent(event: RealtimeEvent): boolean {
    if (!this.isActive) return false;
    if (!this.eventTypes.includes(event.type)) return false;
    if (this.userId !== event.userId) return false;

    if (this.filters) {
      return this.filters.every(filter => {
        const eventEntity = new RealtimeEventEntity(
          event.id,
          event.type,
          event.userId,
          event.data,
          event.timestamp,
          event.correlationId,
          event.metadata
        );
        return eventEntity.matchesFilter(filter);
      });
    }

    return true;
  }

  public isStale(staleThresholdMs: number = 3600000): boolean { // 1 hour default
    if (!this.lastActivity) return false;
    const now = new Date();
    return (now.getTime() - this.lastActivity.getTime()) > staleThresholdMs;
  }

  public toJSON(): EventSubscription {
    return {
      id: this.id,
      userId: this.userId,
      eventTypes: this.eventTypes,
      channels: this.channels,
      filters: this.filters,
      isActive: this.isActive,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity
    };
  }
}

export class WebSocketConnectionEntity implements WebSocketConnection {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly connectionId: string,
    public isAuthenticated: boolean = false,
    public subscribedEvents: RealtimeEventType[] = [],
    public lastPing: Date = new Date(),
    public readonly connectionStarted: Date = new Date(),
    public readonly metadata: {
      userAgent?: string | undefined;
      ipAddress?: string | undefined;
      [key: string]: any;
    } = {}
  ) {}

  public updatePing(): void {
    this.lastPing = new Date();
  }

  public subscribe(eventType: RealtimeEventType): void {
    if (!this.subscribedEvents.includes(eventType)) {
      this.subscribedEvents.push(eventType);
    }
  }

  public unsubscribe(eventType: RealtimeEventType): void {
    const index = this.subscribedEvents.indexOf(eventType);
    if (index > -1) {
      this.subscribedEvents.splice(index, 1);
    }
  }

  public isConnected(timeoutMs: number = 30000): boolean { // 30 seconds default
    const now = new Date();
    return (now.getTime() - this.lastPing.getTime()) <= timeoutMs;
  }

  public getConnectionDuration(): number {
    const now = new Date();
    return now.getTime() - this.connectionStarted.getTime();
  }

  public shouldReceiveEvent(event: RealtimeEvent): boolean {
    return this.isAuthenticated &&
           this.isConnected() &&
           this.subscribedEvents.includes(event.type) &&
           this.userId === event.userId;
  }

  public toJSON(): WebSocketConnection {
    return {
      id: this.id,
      userId: this.userId,
      connectionId: this.connectionId,
      isAuthenticated: this.isAuthenticated,
      subscribedEvents: this.subscribedEvents,
      lastPing: this.lastPing,
      connectionStarted: this.connectionStarted,
      metadata: this.metadata
    };
  }
}

// Event factory for creating common events
export class RealtimeEventFactory {
  public static createTransactionEvent(
    type: 'transaction_created' | 'transaction_processing' | 'transaction_completed' | 'transaction_failed',
    userId: string,
    transactionData: any,
    priority: 'critical' | 'high' | 'medium' | 'low' = 'high'
  ): RealtimeEventEntity {
    return new RealtimeEventEntity(
      `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      userId,
      transactionData,
      new Date(),
      `corr_${transactionData.id || Date.now()}`,
      {
        source: 'transaction-processor',
        version: '1.0.0',
        priority,
        retryable: true,
        tags: ['transaction', 'financial']
      }
    );
  }

  public static createBalanceEvent(
    userId: string,
    balanceData: any,
    priority: 'critical' | 'high' | 'medium' | 'low' = 'medium'
  ): RealtimeEventEntity {
    return new RealtimeEventEntity(
      `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      'balance_updated',
      userId,
      balanceData,
      new Date(),
      `corr_balance_${userId}_${Date.now()}`,
      {
        source: 'balance-service',
        version: '1.0.0',
        priority,
        retryable: true,
        tags: ['balance', 'account']
      }
    );
  }

  public static createSystemAlert(
    message: string,
    severity: 'critical' | 'high' | 'medium' | 'low' = 'high',
    affectedUsers: string[] = []
  ): RealtimeEventEntity {
    return new RealtimeEventEntity(
      `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      'system_alert',
      'system',
      {
        message,
        severity,
        affectedUsers,
        timestamp: new Date()
      },
      new Date(),
      `corr_alert_${Date.now()}`,
      {
        source: 'system-monitor',
        version: '1.0.0',
        priority: severity,
        retryable: false,
        tags: ['system', 'alert']
      }
    );
  }
}