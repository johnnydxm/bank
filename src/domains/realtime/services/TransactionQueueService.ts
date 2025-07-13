import { injectable, inject } from 'inversify';
import { ILogger } from '../../../shared/interfaces/ILogger';
import { TYPES } from '../../../infrastructure/ioc/types';
import { 
  TransactionQueueEntity, 
  QueuedTransaction, 
  QueueConfiguration, 
  QueueMetrics,
  QueueConfigurationEntity,
  QueueMetricsEntity 
} from '../entities/TransactionQueue';
import { 
  RealtimeEventEntity, 
  RealtimeEventFactory, 
  RealtimeEventType 
} from '../entities/RealtimeEvent';

export interface ITransactionProcessor {
  processTransaction(transaction: QueuedTransaction): Promise<void>;
}

export interface QueueManagerConfig {
  redisUrl?: string | undefined;
  persistenceEnabled: boolean;
  metricsIntervalMs: number;
  cleanupIntervalMs: number;
  deadLetterQueueEnabled: boolean;
}

@injectable()
export class TransactionQueueService {
  private queue: Map<string, TransactionQueueEntity> = new Map();
  private processingQueue: Map<string, TransactionQueueEntity> = new Map();
  private deadLetterQueue: Map<string, TransactionQueueEntity> = new Map();
  private completedQueue: Map<string, TransactionQueueEntity> = new Map();
  
  private config: QueueConfigurationEntity;
  private metrics: QueueMetricsEntity;
  private processors: ITransactionProcessor[] = [];
  
  private isProcessing: boolean = false;
  private processingInterval?: NodeJS.Timeout | undefined;
  private metricsInterval?: NodeJS.Timeout | undefined;
  private cleanupInterval?: NodeJS.Timeout | undefined;

  constructor(
    @inject(TYPES.Logger) private logger: ILogger,
    config?: Partial<QueueConfiguration>
  ) {
    this.config = new QueueConfigurationEntity(
      config?.maxConcurrentProcessing,
      config?.retryDelayMs,
      config?.maxRetryDelayMs,
      config?.deadLetterQueueThreshold,
      config?.batchSize,
      config?.processingTimeoutMs
    );
    this.metrics = new QueueMetricsEntity();
    this.validateConfiguration();
  }

  // ========== Queue Management ==========

  public async enqueue(transaction: QueuedTransaction): Promise<void> {
    const queueEntity = new TransactionQueueEntity(
      transaction.id,
      transaction.userId,
      transaction.transactionData,
      transaction.priority,
      transaction.retryCount,
      transaction.maxRetries,
      'pending',
      transaction.scheduledAt,
      transaction.processedAt,
      transaction.completedAt,
      transaction.errorMessage,
      transaction.metadata
    );

    this.queue.set(transaction.id, queueEntity);
    this.metrics.totalQueued++;
    
    this.logger.info('Transaction enqueued', {
      transactionId: transaction.id,
      userId: transaction.userId,
      priority: transaction.priority,
      queueSize: this.queue.size
    });

    // Start processing if not already running
    if (!this.isProcessing) {
      await this.startProcessing();
    }
  }

  public async dequeue(): Promise<TransactionQueueEntity | null> {
    if (this.queue.size === 0) return null;

    // Get highest priority transaction
    const transactions = Array.from(this.queue.values())
      .filter(t => t.status === 'pending')
      .sort((a, b) => {
        // Sort by priority (higher first), then by scheduled time (earlier first)
        const priorityDiff = b.getPriority() - a.getPriority();
        if (priorityDiff !== 0) return priorityDiff;
        return a.scheduledAt.getTime() - b.scheduledAt.getTime();
      });

    if (transactions.length === 0) return null;

    const transaction = transactions[0];
    if (!transaction) return null;
    
    this.queue.delete(transaction.id);
    this.processingQueue.set(transaction.id, transaction);
    this.metrics.totalProcessing++;

    return transaction;
  }

  public async requeueForRetry(transaction: TransactionQueueEntity, errorMessage: string): Promise<void> {
    transaction.markFailed(errorMessage);

    if (transaction.canRetry()) {
      const retryDelay = this.config.calculateRetryDelay(transaction.retryCount);
      
      // Schedule retry
      setTimeout(() => {
        transaction.status = 'pending';
        this.queue.set(transaction.id, transaction);
        this.logger.info('Transaction requeued for retry', {
          transactionId: transaction.id,
          retryCount: transaction.retryCount,
          retryDelay
        });
      }, retryDelay);
    } else {
      // Move to dead letter queue
      this.deadLetterQueue.set(transaction.id, transaction);
      this.logger.error('Transaction moved to dead letter queue', {
        message: `Transaction ${transaction.id} moved to dead letter queue after ${transaction.retryCount} retries: ${errorMessage}`
      });
    }

    this.processingQueue.delete(transaction.id);
    this.metrics.totalProcessing--;
    this.metrics.totalFailed++;
  }

  // ========== Processing Engine ==========

  public async startProcessing(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.logger.info('Starting transaction queue processing', {
      maxConcurrent: this.config.maxConcurrentProcessing,
      batchSize: this.config.batchSize
    });

    // Start processing interval
    this.processingInterval = setInterval(async () => {
      await this.processBatch();
    }, 100); // Process every 100ms

    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
    }, 5000); // Update metrics every 5 seconds

    // Start cleanup process
    this.cleanupInterval = setInterval(() => {
      this.cleanupCompletedTransactions();
    }, 60000); // Cleanup every minute
  }

  public async stopProcessing(): Promise<void> {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Wait for current processing to complete
    while (this.processingQueue.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.logger.info('Transaction queue processing stopped');
  }

  private async processBatch(): Promise<void> {
    const availableSlots = this.config.maxConcurrentProcessing - this.processingQueue.size;
    if (availableSlots <= 0) return;

    const batchSize = Math.min(availableSlots, this.config.batchSize);
    const batch: TransactionQueueEntity[] = [];

    for (let i = 0; i < batchSize; i++) {
      const transaction = await this.dequeue();
      if (!transaction) break;
      batch.push(transaction);
    }

    if (batch.length === 0) return;

    // Process batch concurrently
    const processingPromises = batch.map(transaction => 
      this.processTransaction(transaction)
    );

    await Promise.allSettled(processingPromises);
  }

  private async processTransaction(transaction: TransactionQueueEntity): Promise<void> {
    const startTime = Date.now();
    transaction.startProcessing();

    try {
      // Check for timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Transaction processing timeout after ${this.config.processingTimeoutMs}ms`));
        }, this.config.processingTimeoutMs);
      });

      // Process with timeout
      await Promise.race([
        this.executeTransaction(transaction),
        timeoutPromise
      ]);

      // Mark as completed
      transaction.markCompleted();
      this.processingQueue.delete(transaction.id);
      this.completedQueue.set(transaction.id, transaction);
      this.metrics.totalProcessing--;
      this.metrics.totalCompleted++;

      const processingTime = Date.now() - startTime;
      this.logger.info('Transaction processed successfully', {
        transactionId: transaction.id,
        processingTimeMs: processingTime,
        userId: transaction.userId
      });

      // Emit completion event
      await this.emitTransactionEvent('transaction_completed', transaction);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = (error as Error).message;
      
      this.logger.error('Transaction processing failed', {
        message: `Transaction processing failed for ${transaction.id} (user: ${transaction.userId}): ${errorMessage}`,
        processingTimeMs: processingTime,
        retryCount: transaction.retryCount
      });

      await this.requeueForRetry(transaction, errorMessage);
      await this.emitTransactionEvent('transaction_failed', transaction);
    }
  }

  private async executeTransaction(transaction: TransactionQueueEntity): Promise<void> {
    // Emit processing event
    await this.emitTransactionEvent('transaction_processing', transaction);

    // Execute all registered processors
    for (const processor of this.processors) {
      await processor.processTransaction(transaction.toJSON());
    }
  }

  // ========== Processor Registration ==========

  public registerProcessor(processor: ITransactionProcessor): void {
    this.processors.push(processor);
    this.logger.info('Transaction processor registered', {
      processorCount: this.processors.length
    });
  }

  public unregisterProcessor(processor: ITransactionProcessor): void {
    const index = this.processors.indexOf(processor);
    if (index > -1) {
      this.processors.splice(index, 1);
      this.logger.info('Transaction processor unregistered', {
        processorCount: this.processors.length
      });
    }
  }

  // ========== Event Emission ==========

  private async emitTransactionEvent(
    eventType: 'transaction_processing' | 'transaction_completed' | 'transaction_failed',
    transaction: TransactionQueueEntity
  ): Promise<void> {
    try {
      const event = RealtimeEventFactory.createTransactionEvent(
        eventType,
        transaction.userId,
        {
          transactionId: transaction.id,
          status: transaction.status,
          processingTime: transaction.getProcessingDuration(),
          retryCount: transaction.retryCount,
          metadata: transaction.metadata
        },
        'high'
      );

      // TODO: Emit to realtime event service
      this.logger.debug('Transaction event emitted', {
        eventType,
        transactionId: transaction.id,
        userId: transaction.userId
      });
    } catch (error) {
      this.logger.warn('Failed to emit transaction event', {
        eventType,
        transactionId: transaction.id,
        error: (error as Error).message
      });
    }
  }

  // ========== Metrics and Monitoring ==========

  private updateMetrics(): void {
    const now = Date.now();
    const completedInLastInterval = this.getCompletedCountSince(now - 5000); // Last 5 seconds
    const failedInLastInterval = this.getFailedCountSince(now - 5000);
    
    // Calculate throughput (transactions per second)
    const throughput = completedInLastInterval / 5;
    
    // Calculate average processing time
    const recentCompleted = Array.from(this.completedQueue.values())
      .filter(t => t.completedAt && (now - t.completedAt.getTime()) < 60000); // Last minute
    
    const avgProcessingTime = recentCompleted.length > 0
      ? recentCompleted.reduce((sum, t) => sum + (t.getProcessingDuration() || 0), 0) / recentCompleted.length
      : 0;

    this.metrics.updateMetrics(
      completedInLastInterval,
      failedInLastInterval,
      avgProcessingTime,
      throughput
    );

    this.metrics.queueDepth = this.queue.size;
    this.metrics.totalQueued = this.queue.size + this.processingQueue.size + this.completedQueue.size + this.deadLetterQueue.size;

    // Log metrics periodically
    if (Math.random() < 0.1) { // 10% chance to log detailed metrics
      this.logger.info('Queue metrics updated', {
        metrics: this.metrics.toJSON(),
        healthScore: this.metrics.getHealthScore()
      });
    }
  }

  private getCompletedCountSince(timestamp: number): number {
    return Array.from(this.completedQueue.values())
      .filter(t => t.completedAt && t.completedAt.getTime() > timestamp)
      .length;
  }

  private getFailedCountSince(timestamp: number): number {
    return Array.from(this.deadLetterQueue.values())
      .filter(t => t.processedAt && t.processedAt.getTime() > timestamp)
      .length;
  }

  private cleanupCompletedTransactions(): void {
    const now = Date.now();
    const retentionPeriod = 24 * 60 * 60 * 1000; // 24 hours
    
    let cleanedCount = 0;
    for (const [id, transaction] of this.completedQueue.entries()) {
      if (transaction.completedAt && (now - transaction.completedAt.getTime()) > retentionPeriod) {
        this.completedQueue.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info('Completed transactions cleaned up', {
        cleanedCount,
        remainingCompleted: this.completedQueue.size
      });
    }
  }

  // ========== Public Interface ==========

  public getMetrics(): QueueMetrics {
    return this.metrics.toJSON();
  }

  public getQueueStatus(): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    healthScore: number;
  } {
    return {
      pending: this.queue.size,
      processing: this.processingQueue.size,
      completed: this.completedQueue.size,
      failed: this.deadLetterQueue.size,
      healthScore: this.metrics.getHealthScore()
    };
  }

  public async getTransaction(transactionId: string): Promise<QueuedTransaction | null> {
    const transaction = 
      this.queue.get(transactionId) ||
      this.processingQueue.get(transactionId) ||
      this.completedQueue.get(transactionId) ||
      this.deadLetterQueue.get(transactionId);

    return transaction ? transaction.toJSON() : null;
  }

  public async pauseProcessing(): Promise<void> {
    this.isProcessing = false;
    this.logger.info('Queue processing paused');
  }

  public async resumeProcessing(): Promise<void> {
    if (!this.isProcessing) {
      await this.startProcessing();
      this.logger.info('Queue processing resumed');
    }
  }

  public updateConfiguration(newConfig: Partial<QueueConfiguration>): void {
    this.config = new QueueConfigurationEntity(
      newConfig.maxConcurrentProcessing ?? this.config.maxConcurrentProcessing,
      newConfig.retryDelayMs ?? this.config.retryDelayMs,
      newConfig.maxRetryDelayMs ?? this.config.maxRetryDelayMs,
      newConfig.deadLetterQueueThreshold ?? this.config.deadLetterQueueThreshold,
      newConfig.batchSize ?? this.config.batchSize,
      newConfig.processingTimeoutMs ?? this.config.processingTimeoutMs
    );
    
    this.validateConfiguration();
    this.logger.info('Queue configuration updated', { config: this.config });
  }

  private validateConfiguration(): void {
    const validation = this.config.validate();
    if (!validation.valid) {
      throw new Error(`Invalid queue configuration: ${validation.errors.join(', ')}`);
    }
  }
}