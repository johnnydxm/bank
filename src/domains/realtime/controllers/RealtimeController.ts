import { Request, Response } from 'express';
import { injectable, inject } from 'inversify';
import { ILogger } from '../../../shared/interfaces/ILogger';
import { TYPES } from '../../../infrastructure/ioc/types';
import { RealtimeEventService } from '../services/RealtimeEventService';
import { TransactionQueueService } from '../services/TransactionQueueService';
import { WebSocketService } from '../services/WebSocketService';
import { RealtimeEventType } from '../entities/RealtimeEvent';

export interface RealtimeMetricsResponse {
  eventService: {
    totalEventsProcessed: number;
    totalEventsFailed: number;
    averageProcessingTimeMs: number;
    throughputPerSecond: number;
    queueStatus: {
      pendingEvents: number;
      processingEvents: number;
      totalEventsInHistory: number;
      isProcessing: boolean;
    };
  };
  queueService: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    healthScore: number;
    metrics: {
      totalQueued: number;
      totalProcessing: number;
      totalCompleted: number;
      totalFailed: number;
      averageProcessingTimeMs: number;
      throughputPerSecond: number;
      errorRate: number;
      queueDepth: number;
    };
  };
  webSocketService: {
    totalConnections: number;
    authenticatedConnections: number;
    subscriptions: number;
    bufferedUsers: number;
    metrics: {
      totalConnections: number;
      activeConnections: number;
      totalMessagesSent: number;
      totalMessagesReceived: number;
      averageLatencyMs: number;
      errorRate: number;
      subscriptionsCount: number;
    };
  };
  timestamp: Date;
  systemHealth: 'healthy' | 'degraded' | 'critical';
}

@injectable()
export class RealtimeController {
  constructor(
    @inject(TYPES.Logger) private logger: ILogger,
    @inject(TYPES.RealtimeEventService) private eventService: RealtimeEventService,
    @inject(TYPES.TransactionQueueService) private queueService: TransactionQueueService,
    @inject(TYPES.WebSocketService) private webSocketService: WebSocketService
  ) {}

  // ========== Health and Status Endpoints ==========

  public async getHealthStatus(req: Request, res: Response): Promise<void> {
    try {
      const eventMetrics = this.eventService.getMetrics();
      const queueStatus = this.queueService.getQueueStatus();
      const queueMetrics = this.queueService.getMetrics();
      const wsStatus = this.webSocketService.getConnectionStatus();
      const wsMetrics = this.webSocketService.getMetrics();

      const response: RealtimeMetricsResponse = {
        eventService: {
          totalEventsProcessed: eventMetrics.totalEventsProcessed,
          totalEventsFailed: eventMetrics.totalEventsFailed,
          averageProcessingTimeMs: eventMetrics.averageProcessingTimeMs,
          throughputPerSecond: eventMetrics.throughputPerSecond,
          queueStatus: this.eventService.getQueueStatus()
        },
        queueService: {
          pending: queueStatus.pending,
          processing: queueStatus.processing,
          completed: queueStatus.completed,
          failed: queueStatus.failed,
          healthScore: queueStatus.healthScore,
          metrics: queueMetrics
        },
        webSocketService: {
          totalConnections: wsStatus.totalConnections,
          authenticatedConnections: wsStatus.authenticatedConnections,
          subscriptions: wsStatus.subscriptions,
          bufferedUsers: wsStatus.bufferedUsers,
          metrics: wsMetrics
        },
        timestamp: new Date(),
        systemHealth: this.calculateSystemHealth(queueStatus.healthScore, eventMetrics, wsMetrics)
      };

      this.logger.info('Health status requested', {
        systemHealth: response.systemHealth,
        queueHealthScore: queueStatus.healthScore,
        activeConnections: wsStatus.authenticatedConnections
      });

      res.status(200).json(response);
    } catch (error) {
      this.logger.error('Failed to get health status', {
        error: (error as Error).message
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ========== Event Management Endpoints ==========

  public async emitEvent(req: Request, res: Response): Promise<void> {
    try {
      const { type, userId, data, priority = 'medium' } = req.body;

      if (!type || !userId || !data) {
        res.status(400).json({ 
          error: 'Missing required fields: type, userId, data' 
        });
        return;
      }

      if (!this.isValidEventType(type)) {
        res.status(400).json({ 
          error: `Invalid event type: ${type}` 
        });
        return;
      }

      await this.eventService.emitToUser(userId, {
        id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: type as RealtimeEventType,
        userId,
        data,
        timestamp: new Date(),
        correlationId: `manual_${Date.now()}`,
        metadata: {
          source: 'manual-api',
          version: '1.0.0',
          priority: priority as 'critical' | 'high' | 'medium' | 'low',
          retryable: true,
          tags: ['manual', 'api']
        }
      });

      this.logger.info('Manual event emitted', {
        eventType: type,
        userId,
        priority
      });

      res.status(200).json({ 
        success: true, 
        message: 'Event emitted successfully' 
      });
    } catch (error) {
      this.logger.error('Failed to emit event', {
        error: (error as Error).message,
        body: req.body
      });
      res.status(500).json({ error: 'Failed to emit event' });
    }
  }

  public async emitTransactionEvent(req: Request, res: Response): Promise<void> {
    try {
      const { type, userId, transactionData, priority = 'high' } = req.body;

      if (!type || !userId || !transactionData) {
        res.status(400).json({ 
          error: 'Missing required fields: type, userId, transactionData' 
        });
        return;
      }

      const validTransactionTypes = [
        'transaction_created',
        'transaction_processing', 
        'transaction_completed',
        'transaction_failed'
      ];

      if (!validTransactionTypes.includes(type)) {
        res.status(400).json({ 
          error: `Invalid transaction event type: ${type}` 
        });
        return;
      }

      await this.eventService.emitTransactionEvent(
        type as 'transaction_created' | 'transaction_processing' | 'transaction_completed' | 'transaction_failed',
        userId,
        transactionData,
        priority as 'critical' | 'high' | 'medium' | 'low'
      );

      this.logger.info('Transaction event emitted', {
        eventType: type,
        userId,
        transactionId: transactionData.id || transactionData.transactionId,
        priority
      });

      res.status(200).json({ 
        success: true, 
        message: 'Transaction event emitted successfully' 
      });
    } catch (error) {
      this.logger.error('Failed to emit transaction event', {
        error: (error as Error).message,
        body: req.body
      });
      res.status(500).json({ error: 'Failed to emit transaction event' });
    }
  }

  public async emitSystemAlert(req: Request, res: Response): Promise<void> {
    try {
      const { message, severity = 'medium', affectedUsers = [] } = req.body;

      if (!message) {
        res.status(400).json({ 
          error: 'Missing required field: message' 
        });
        return;
      }

      await this.eventService.emitSystemAlert(
        message,
        severity as 'critical' | 'high' | 'medium' | 'low',
        affectedUsers
      );

      this.logger.info('System alert emitted', {
        message,
        severity,
        affectedUserCount: affectedUsers.length
      });

      res.status(200).json({ 
        success: true, 
        message: 'System alert emitted successfully' 
      });
    } catch (error) {
      this.logger.error('Failed to emit system alert', {
        error: (error as Error).message,
        body: req.body
      });
      res.status(500).json({ error: 'Failed to emit system alert' });
    }
  }

  // ========== Queue Management Endpoints ==========

  public async getQueueStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = this.queueService.getQueueStatus();
      const metrics = this.queueService.getMetrics();

      res.status(200).json({
        status,
        metrics,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to get queue status', {
        error: (error as Error).message
      });
      res.status(500).json({ error: 'Failed to get queue status' });
    }
  }

  public async pauseQueue(req: Request, res: Response): Promise<void> {
    try {
      await this.queueService.pauseProcessing();
      
      this.logger.info('Queue processing paused via API');
      
      res.status(200).json({ 
        success: true, 
        message: 'Queue processing paused' 
      });
    } catch (error) {
      this.logger.error('Failed to pause queue', {
        error: (error as Error).message
      });
      res.status(500).json({ error: 'Failed to pause queue' });
    }
  }

  public async resumeQueue(req: Request, res: Response): Promise<void> {
    try {
      await this.queueService.resumeProcessing();
      
      this.logger.info('Queue processing resumed via API');
      
      res.status(200).json({ 
        success: true, 
        message: 'Queue processing resumed' 
      });
    } catch (error) {
      this.logger.error('Failed to resume queue', {
        error: (error as Error).message
      });
      res.status(500).json({ error: 'Failed to resume queue' });
    }
  }

  public async getTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;

      if (!transactionId) {
        res.status(400).json({ 
          error: 'Transaction ID is required' 
        });
        return;
      }

      const transaction = await this.queueService.getTransaction(transactionId);

      if (!transaction) {
        res.status(404).json({ 
          error: 'Transaction not found' 
        });
        return;
      }

      res.status(200).json({
        transaction,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to get transaction', {
        error: (error as Error).message,
        transactionId: req.params.transactionId
      });
      res.status(500).json({ error: 'Failed to get transaction' });
    }
  }

  // ========== WebSocket Management Endpoints ==========

  public async getWebSocketStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = this.webSocketService.getConnectionStatus();
      const metrics = this.webSocketService.getMetrics();

      res.status(200).json({
        status,
        metrics,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to get WebSocket status', {
        error: (error as Error).message
      });
      res.status(500).json({ error: 'Failed to get WebSocket status' });
    }
  }

  // ========== Event History and Analytics ==========

  public async getEventHistory(req: Request, res: Response): Promise<void> {
    try {
      const {
        eventTypes,
        userIds,
        priorities,
        startTime,
        endTime,
        source,
        tags,
        limit = 100
      } = req.query;

      const filter: any = {};

      if (eventTypes) {
        filter.eventTypes = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
      }

      if (userIds) {
        filter.userIds = Array.isArray(userIds) ? userIds : [userIds];
      }

      if (priorities) {
        filter.priorities = Array.isArray(priorities) ? priorities : [priorities];
      }

      if (startTime && endTime) {
        filter.timeRange = {
          startTime: new Date(startTime as string),
          endTime: new Date(endTime as string)
        };
      }

      if (source || tags) {
        filter.metadata = {};
        if (source) filter.metadata.source = source;
        if (tags) filter.metadata.tags = Array.isArray(tags) ? tags : [tags];
      }

      const events = await this.eventService.getEvents(filter);
      const limitedEvents = events.slice(0, Number(limit));

      res.status(200).json({
        events: limitedEvents,
        total: events.length,
        limit: Number(limit),
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to get event history', {
        error: (error as Error).message,
        query: req.query
      });
      res.status(500).json({ error: 'Failed to get event history' });
    }
  }

  // ========== Utility Methods ==========

  private isValidEventType(type: string): boolean {
    const validTypes: RealtimeEventType[] = [
      'transaction_created',
      'transaction_processing',
      'transaction_completed',
      'transaction_failed',
      'balance_updated',
      'currency_converted',
      'account_created',
      'exchange_rate_updated',
      'system_alert',
      'performance_metric'
    ];

    return validTypes.includes(type as RealtimeEventType);
  }

  private calculateSystemHealth(
    queueHealthScore: number,
    eventMetrics: any,
    wsMetrics: any
  ): 'healthy' | 'degraded' | 'critical' {
    // Calculate composite health score
    const queueWeight = 0.4;
    const eventWeight = 0.3;
    const wsWeight = 0.3;

    const eventHealthScore = eventMetrics.totalEventsFailed > 0 
      ? Math.max(0, 100 - (eventMetrics.totalEventsFailed / Math.max(eventMetrics.totalEventsProcessed, 1)) * 100)
      : 100;

    const wsHealthScore = wsMetrics.errorRate > 0 
      ? Math.max(0, 100 - wsMetrics.errorRate * 100)
      : 100;

    const compositeScore = 
      queueHealthScore * queueWeight +
      eventHealthScore * eventWeight +
      wsHealthScore * wsWeight;

    if (compositeScore >= 80) return 'healthy';
    if (compositeScore >= 60) return 'degraded';
    return 'critical';
  }
}