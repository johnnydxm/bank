export interface QueuedTransaction {
  id: string;
  userId: string;
  transactionData: any;
  priority: 'high' | 'medium' | 'low';
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  scheduledAt: Date;
  processedAt?: Date | undefined;
  completedAt?: Date | undefined;
  errorMessage?: string | undefined;
  metadata: {
    source: string;
    correlationId: string;
    traceId: string;
    [key: string]: any;
  };
}

export interface QueueConfiguration {
  maxConcurrentProcessing: number;
  retryDelayMs: number;
  maxRetryDelayMs: number;
  deadLetterQueueThreshold: number;
  batchSize: number;
  processingTimeoutMs: number;
}

export interface QueueMetrics {
  totalQueued: number;
  totalProcessing: number;
  totalCompleted: number;
  totalFailed: number;
  averageProcessingTimeMs: number;
  throughputPerSecond: number;
  errorRate: number;
  queueDepth: number;
}

export class TransactionQueueEntity implements QueuedTransaction {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly transactionData: any,
    public priority: 'high' | 'medium' | 'low' = 'medium',
    public retryCount: number = 0,
    public readonly maxRetries: number = 3,
    public status: 'pending' | 'processing' | 'completed' | 'failed' = 'pending',
    public readonly scheduledAt: Date = new Date(),
    public processedAt?: Date | undefined,
    public completedAt?: Date | undefined,
    public errorMessage?: string | undefined,
    public readonly metadata: {
      source: string;
      correlationId: string;
      traceId: string;
      [key: string]: any;
    } = {
      source: 'unknown',
      correlationId: `corr_${Date.now()}`,
      traceId: `trace_${Date.now()}`
    }
  ) {}

  public startProcessing(): void {
    this.status = 'processing';
    this.processedAt = new Date();
  }

  public markCompleted(): void {
    this.status = 'completed';
    this.completedAt = new Date();
  }

  public markFailed(errorMessage: string): void {
    this.status = 'failed';
    this.errorMessage = errorMessage;
    this.retryCount++;
  }

  public canRetry(): boolean {
    return this.retryCount < this.maxRetries && this.status === 'failed';
  }

  public isExpired(timeoutMs: number): boolean {
    if (!this.processedAt) return false;
    const now = new Date();
    return (now.getTime() - this.processedAt.getTime()) > timeoutMs;
  }

  public getPriority(): number {
    switch (this.priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  public getProcessingDuration(): number | null {
    if (!this.processedAt) return null;
    const endTime = this.completedAt || new Date();
    return endTime.getTime() - this.processedAt.getTime();
  }

  public toJSON(): QueuedTransaction {
    return {
      id: this.id,
      userId: this.userId,
      transactionData: this.transactionData,
      priority: this.priority,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      status: this.status,
      scheduledAt: this.scheduledAt,
      processedAt: this.processedAt,
      completedAt: this.completedAt,
      errorMessage: this.errorMessage,
      metadata: this.metadata
    };
  }
}

export class QueueConfigurationEntity implements QueueConfiguration {
  constructor(
    public maxConcurrentProcessing: number = 10,
    public retryDelayMs: number = 1000,
    public maxRetryDelayMs: number = 30000,
    public deadLetterQueueThreshold: number = 5,
    public batchSize: number = 5,
    public processingTimeoutMs: number = 30000
  ) {}

  public calculateRetryDelay(retryCount: number): number {
    const delay = Math.min(
      this.retryDelayMs * Math.pow(2, retryCount),
      this.maxRetryDelayMs
    );
    return delay;
  }

  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.maxConcurrentProcessing <= 0) {
      errors.push('maxConcurrentProcessing must be greater than 0');
    }

    if (this.retryDelayMs <= 0) {
      errors.push('retryDelayMs must be greater than 0');
    }

    if (this.maxRetryDelayMs <= this.retryDelayMs) {
      errors.push('maxRetryDelayMs must be greater than retryDelayMs');
    }

    if (this.batchSize <= 0) {
      errors.push('batchSize must be greater than 0');
    }

    if (this.processingTimeoutMs <= 0) {
      errors.push('processingTimeoutMs must be greater than 0');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export class QueueMetricsEntity implements QueueMetrics {
  constructor(
    public totalQueued: number = 0,
    public totalProcessing: number = 0,
    public totalCompleted: number = 0,
    public totalFailed: number = 0,
    public averageProcessingTimeMs: number = 0,
    public throughputPerSecond: number = 0,
    public errorRate: number = 0,
    public queueDepth: number = 0
  ) {}

  public updateMetrics(
    completed: number,
    failed: number,
    avgProcessingTime: number,
    throughput: number
  ): void {
    this.totalCompleted += completed;
    this.totalFailed += failed;
    this.averageProcessingTimeMs = avgProcessingTime;
    this.throughputPerSecond = throughput;
    this.errorRate = this.totalFailed / (this.totalCompleted + this.totalFailed) || 0;
  }

  public getHealthScore(): number {
    if (this.totalCompleted === 0) return 100;
    
    const successRate = 1 - this.errorRate;
    const performanceScore = Math.max(0, 1 - (this.averageProcessingTimeMs / 10000)); // 10s baseline
    const throughputScore = Math.min(1, this.throughputPerSecond / 100); // 100/s baseline
    
    return Math.round((successRate * 0.5 + performanceScore * 0.3 + throughputScore * 0.2) * 100);
  }

  public toJSON(): QueueMetrics {
    return {
      totalQueued: this.totalQueued,
      totalProcessing: this.totalProcessing,
      totalCompleted: this.totalCompleted,
      totalFailed: this.totalFailed,
      averageProcessingTimeMs: this.averageProcessingTimeMs,
      throughputPerSecond: this.throughputPerSecond,
      errorRate: this.errorRate,
      queueDepth: this.queueDepth
    };
  }
}