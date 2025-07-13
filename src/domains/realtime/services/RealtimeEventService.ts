import { injectable, inject } from 'inversify';
import { ILogger } from '../../../shared/interfaces/ILogger';
import { TYPES } from '../../../infrastructure/ioc/types';
import { 
  RealtimeEvent, 
  RealtimeEventType,
  EventMetadata 
} from '../entities/RealtimeEvent';
import { 
  RealtimeEventEntity, 
  RealtimeEventFactory 
} from '../entities/RealtimeEvent';
import { WebSocketService } from './WebSocketService';

export interface IRealtimeEventService {
  emit(event: RealtimeEvent): Promise<void>;
  emitToUser(userId: string, event: RealtimeEvent): Promise<void>;
  emitTransactionEvent(
    type: 'transaction_created' | 'transaction_processing' | 'transaction_completed' | 'transaction_failed',
    userId: string,
    transactionData: any,
    priority?: 'critical' | 'high' | 'medium' | 'low'
  ): Promise<void>;
  emitBalanceUpdate(userId: string, balanceData: any): Promise<void>;
  emitSystemAlert(message: string, severity: 'critical' | 'high' | 'medium' | 'low', affectedUsers?: string[]): Promise<void>;
  subscribe(userId: string, eventTypes: RealtimeEventType[]): Promise<void>;
  unsubscribe(userId: string, eventTypes: RealtimeEventType[]): Promise<void>;
}

export interface EventProcessingMetrics {
  totalEventsProcessed: number;
  totalEventsFailed: number;
  averageProcessingTimeMs: number;
  eventTypeMetrics: Map<RealtimeEventType, {
    count: number;
    averageProcessingTime: number;
    errorCount: number;
  }>;
  throughputPerSecond: number;
  lastProcessedAt: Date;
}

export interface EventFilter {
  eventTypes?: RealtimeEventType[];
  userIds?: string[];
  priorities?: Array<'critical' | 'high' | 'medium' | 'low'>;
  timeRange?: {
    startTime: Date;
    endTime: Date;
  };
  metadata?: {
    source?: string;
    tags?: string[];
  };
}

@injectable()
export class RealtimeEventService implements IRealtimeEventService {
  private eventQueue: RealtimeEventEntity[] = [];
  private processingQueue: RealtimeEventEntity[] = [];
  private eventHistory: Map<string, RealtimeEventEntity> = new Map();
  
  private metrics: EventProcessingMetrics = {
    totalEventsProcessed: 0,
    totalEventsFailed: 0,
    averageProcessingTimeMs: 0,
    eventTypeMetrics: new Map(),
    throughputPerSecond: 0,
    lastProcessedAt: new Date()
  };

  private isProcessing: boolean = false;
  private processingInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private historyCleanupInterval?: NodeJS.Timeout;

  constructor(
    @inject(TYPES.Logger) private logger: ILogger,
    @inject(TYPES.WebSocketService) private webSocketService: WebSocketService
  ) {
    this.startEventProcessing();
    this.startMetricsCollection();
    this.startHistoryCleanup();
  }

  // ========== Core Event Emission ==========

  public async emit(event: RealtimeEvent): Promise<void> {
    const eventEntity = this.createEventEntity(event);
    await this.queueEvent(eventEntity);
  }

  public async emitToUser(userId: string, event: RealtimeEvent): Promise<void> {
    // Ensure event is targeted to specific user
    const targetedEvent = {
      ...event,
      userId,
      correlationId: event.correlationId || `user_${userId}_${Date.now()}`
    };

    const eventEntity = this.createEventEntity(targetedEvent);
    await this.queueEvent(eventEntity);
  }

  public async emitTransactionEvent(
    type: 'transaction_created' | 'transaction_processing' | 'transaction_completed' | 'transaction_failed',
    userId: string,
    transactionData: any,
    priority: 'critical' | 'high' | 'medium' | 'low' = 'high'
  ): Promise<void> {
    const event = RealtimeEventFactory.createTransactionEvent(
      type,
      userId,
      transactionData,
      priority
    );

    await this.queueEvent(event);

    this.logger.info('Transaction event emitted', {
      eventType: type,
      userId,
      transactionId: transactionData.id || transactionData.transactionId,
      priority
    });
  }

  public async emitBalanceUpdate(userId: string, balanceData: any): Promise<void> {
    const event = RealtimeEventFactory.createBalanceEvent(
      userId,
      balanceData,
      'medium'
    );

    await this.queueEvent(event);

    this.logger.info('Balance update event emitted', {
      userId,
      currencies: balanceData.currencies || Object.keys(balanceData),
      totalValue: balanceData.totalValue
    });
  }

  public async emitSystemAlert(
    message: string,
    severity: 'critical' | 'high' | 'medium' | 'low',
    affectedUsers: string[] = []
  ): Promise<void> {
    if (affectedUsers.length === 0) {
      // System-wide alert
      const event = RealtimeEventFactory.createSystemAlert(message, severity, []);
      await this.queueEvent(event);
    } else {
      // User-specific alerts
      const alertPromises = affectedUsers.map(userId => {
        const event = RealtimeEventFactory.createSystemAlert(message, severity, [userId]);
        // Create new event entity with correct userId
        const userTargetedEvent = new RealtimeEventEntity(
          event.id,
          event.type,
          userId,
          event.data,
          event.timestamp,
          event.correlationId,
          event.metadata
        );
        return this.queueEvent(userTargetedEvent);
      });

      await Promise.all(alertPromises);
    }

    this.logger.warn('System alert emitted', {
      message,
      severity,
      affectedUserCount: affectedUsers.length
    });
  }

  // ========== Subscription Management ==========

  public async subscribe(userId: string, eventTypes: RealtimeEventType[]): Promise<void> {
    // This method interfaces with WebSocketService for subscription management
    // For now, we'll track subscriptions at the WebSocket level
    this.logger.info('User subscribed to events', {
      userId,
      eventTypes,
      subscriptionCount: eventTypes.length
    });
  }

  public async unsubscribe(userId: string, eventTypes: RealtimeEventType[]): Promise<void> {
    // This method interfaces with WebSocketService for subscription management
    this.logger.info('User unsubscribed from events', {
      userId,
      eventTypes,
      unsubscriptionCount: eventTypes.length
    });
  }

  // ========== Event Processing Engine ==========

  private async queueEvent(event: RealtimeEventEntity): Promise<void> {
    // Validate event before queueing
    if (this.shouldSkipEvent(event)) {
      this.logger.debug('Event skipped due to filters', {
        eventId: event.id,
        eventType: event.type,
        userId: event.userId
      });
      return;
    }

    // Add to processing queue
    this.eventQueue.push(event);
    this.eventHistory.set(event.id, event);

    this.logger.debug('Event queued for processing', {
      eventId: event.id,
      eventType: event.type,
      userId: event.userId,
      queueSize: this.eventQueue.length,
      priority: event.metadata.priority
    });

    // Process immediately if queue was empty
    if (!this.isProcessing && this.eventQueue.length === 1) {
      await this.processNextBatch();
    }
  }

  private startEventProcessing(): void {
    this.processingInterval = setInterval(async () => {
      if (this.eventQueue.length > 0 && !this.isProcessing) {
        await this.processNextBatch();
      }
    }, 50); // Process every 50ms for high throughput
  }

  private async processNextBatch(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) return;

    this.isProcessing = true;
    const batchSize = Math.min(10, this.eventQueue.length); // Process up to 10 events at once
    const batch = this.eventQueue.splice(0, batchSize);

    // Sort batch by priority
    batch.sort((a, b) => b.getPriorityScore() - a.getPriorityScore());

    this.processingQueue.push(...batch);

    const processingPromises = batch.map(event => this.processEvent(event));
    await Promise.allSettled(processingPromises);

    // Remove processed events from processing queue
    batch.forEach(event => {
      const index = this.processingQueue.findIndex(e => e.id === event.id);
      if (index > -1) {
        this.processingQueue.splice(index, 1);
      }
    });

    this.isProcessing = false;
  }

  private async processEvent(event: RealtimeEventEntity): Promise<void> {
    const startTime = Date.now();

    try {
      // Skip expired events
      if (event.isExpired()) {
        this.logger.debug('Skipping expired event', {
          eventId: event.id,
          eventType: event.type,
          age: Date.now() - event.timestamp.getTime()
        });
        return;
      }

      // Process the event through WebSocket service
      await this.webSocketService.processEvent(event.toJSON());

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateEventMetrics(event.type, processingTime, false);
      this.metrics.totalEventsProcessed++;
      this.metrics.lastProcessedAt = new Date();

      this.logger.debug('Event processed successfully', {
        eventId: event.id,
        eventType: event.type,
        userId: event.userId,
        processingTimeMs: processingTime
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = (error as Error).message;

      this.updateEventMetrics(event.type, processingTime, true);
      this.metrics.totalEventsFailed++;

      this.logger.error('Event processing failed', {
        message: `Event processing failed for ${event.type} (${event.id}): ${errorMessage}`,
        eventType: event.type,
        userId: event.userId,
        processingTimeMs: processingTime
      });

      // Retry logic for retryable events
      if (event.shouldRetry()) {
        setTimeout(() => {
          this.eventQueue.unshift(event); // Add to front of queue for retry
        }, 1000); // Retry after 1 second
      }
    }
  }

  // ========== Event Filtering ==========

  private shouldSkipEvent(event: RealtimeEventEntity): boolean {
    // Skip events that don't have valid users (system events excluded)
    if (event.type !== 'system_alert' && (!event.userId || event.userId === 'system')) {
      return false; // Don't skip, system events are valid
    }

    // Skip events that are already expired
    if (event.isExpired()) {
      return true;
    }

    // Add more filtering logic here as needed
    return false;
  }

  public async getEvents(filter: EventFilter): Promise<RealtimeEvent[]> {
    let events = Array.from(this.eventHistory.values());

    // Apply filters
    if (filter.eventTypes && filter.eventTypes.length > 0) {
      events = events.filter(event => filter.eventTypes!.includes(event.type));
    }

    if (filter.userIds && filter.userIds.length > 0) {
      events = events.filter(event => filter.userIds!.includes(event.userId));
    }

    if (filter.priorities && filter.priorities.length > 0) {
      events = events.filter(event => filter.priorities!.includes(event.metadata.priority));
    }

    if (filter.timeRange) {
      events = events.filter(event => 
        event.timestamp >= filter.timeRange!.startTime &&
        event.timestamp <= filter.timeRange!.endTime
      );
    }

    if (filter.metadata?.source) {
      events = events.filter(event => event.metadata.source === filter.metadata!.source);
    }

    if (filter.metadata?.tags && filter.metadata.tags.length > 0) {
      events = events.filter(event => 
        event.metadata.tags && 
        filter.metadata!.tags!.some(tag => event.metadata.tags!.includes(tag))
      );
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return events.map(event => event.toJSON());
  }

  // ========== Metrics and Monitoring ==========

  private updateEventMetrics(
    eventType: RealtimeEventType,
    processingTime: number,
    failed: boolean
  ): void {
    if (!this.metrics.eventTypeMetrics.has(eventType)) {
      this.metrics.eventTypeMetrics.set(eventType, {
        count: 0,
        averageProcessingTime: 0,
        errorCount: 0
      });
    }

    const typeMetrics = this.metrics.eventTypeMetrics.get(eventType)!;
    typeMetrics.count++;
    
    if (failed) {
      typeMetrics.errorCount++;
    }

    // Update average processing time using exponential moving average
    const alpha = 0.1;
    typeMetrics.averageProcessingTime = 
      (1 - alpha) * typeMetrics.averageProcessingTime + alpha * processingTime;

    // Update overall average processing time
    this.metrics.averageProcessingTimeMs = 
      (1 - alpha) * this.metrics.averageProcessingTimeMs + alpha * processingTime;
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.calculateThroughput();
      this.logMetricsSummary();
    }, 30000); // Update every 30 seconds
  }

  private calculateThroughput(): void {
    const now = Date.now();
    const timeWindow = 30000; // 30 seconds
    const recentEvents = Array.from(this.eventHistory.values())
      .filter(event => (now - event.timestamp.getTime()) < timeWindow);
    
    this.metrics.throughputPerSecond = recentEvents.length / (timeWindow / 1000);
  }

  private logMetricsSummary(): void {
    if (Math.random() < 0.1) { // 10% chance to log detailed metrics
      this.logger.info('Event processing metrics', {
        totalProcessed: this.metrics.totalEventsProcessed,
        totalFailed: this.metrics.totalEventsFailed,
        throughputPerSecond: this.metrics.throughputPerSecond,
        averageProcessingTime: this.metrics.averageProcessingTimeMs,
        queueSize: this.eventQueue.length,
        processingQueueSize: this.processingQueue.length,
        historySize: this.eventHistory.size
      });
    }
  }

  private startHistoryCleanup(): void {
    this.historyCleanupInterval = setInterval(() => {
      this.cleanupEventHistory();
    }, 300000); // Cleanup every 5 minutes
  }

  private cleanupEventHistory(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    let cleanedCount = 0;

    for (const [eventId, event] of this.eventHistory.entries()) {
      if ((now - event.timestamp.getTime()) > maxAge) {
        this.eventHistory.delete(eventId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info('Event history cleaned up', {
        cleanedCount,
        remainingEvents: this.eventHistory.size
      });
    }
  }

  // ========== Utility Methods ==========

  private createEventEntity(event: RealtimeEvent): RealtimeEventEntity {
    return new RealtimeEventEntity(
      event.id,
      event.type,
      event.userId,
      event.data,
      event.timestamp,
      event.correlationId,
      event.metadata
    );
  }

  // ========== Public Interface ==========

  public getMetrics(): EventProcessingMetrics {
    return {
      ...this.metrics,
      eventTypeMetrics: new Map(this.metrics.eventTypeMetrics)
    };
  }

  public getQueueStatus(): {
    pendingEvents: number;
    processingEvents: number;
    totalEventsInHistory: number;
    isProcessing: boolean;
  } {
    return {
      pendingEvents: this.eventQueue.length,
      processingEvents: this.processingQueue.length,
      totalEventsInHistory: this.eventHistory.size,
      isProcessing: this.isProcessing
    };
  }

  public async pause(): Promise<void> {
    this.isProcessing = false;
    this.logger.info('Event processing paused');
  }

  public async resume(): Promise<void> {
    this.isProcessing = false; // Reset flag
    if (this.eventQueue.length > 0) {
      await this.processNextBatch();
    }
    this.logger.info('Event processing resumed');
  }

  public async shutdown(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    if (this.historyCleanupInterval) {
      clearInterval(this.historyCleanupInterval);
    }

    // Process remaining events
    while (this.eventQueue.length > 0) {
      await this.processNextBatch();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.logger.info('Realtime event service shutdown completed');
  }
}