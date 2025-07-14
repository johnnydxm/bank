import { injectable, inject } from 'inversify';
import { ILogger } from '../../../shared/interfaces/ILogger';
import { TYPES } from '../../../infrastructure/ioc/types';
import { 
  RealtimeEvent, 
  RealtimeEventType,
  WebSocketConnection,
  EventSubscription 
} from '../entities/RealtimeEvent';
import { 
  WebSocketConnectionEntity, 
  EventSubscriptionEntity,
  RealtimeEventEntity 
} from '../entities/RealtimeEvent';

export interface WebSocketMessage {
  type: 'event' | 'subscribe' | 'unsubscribe' | 'ping' | 'pong' | 'error' | 'auth';
  payload: any;
  timestamp: Date;
  messageId: string;
}

export interface WebSocketServer {
  broadcast(message: WebSocketMessage, filter?: (connection: WebSocketConnection) => boolean): Promise<void>;
  sendToUser(userId: string, message: WebSocketMessage): Promise<void>;
  sendToConnection(connectionId: string, message: WebSocketMessage): Promise<void>;
  close(): Promise<void>;
}

export interface WebSocketMetrics {
  totalConnections: number;
  activeConnections: number;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  averageLatencyMs: number;
  errorRate: number;
  subscriptionsCount: number;
}

@injectable()
export class WebSocketService implements WebSocketServer {
  private connections: Map<string, WebSocketConnectionEntity> = new Map();
  private subscriptions: Map<string, EventSubscriptionEntity> = new Map();
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> connectionIds
  private eventBuffer: Map<string, RealtimeEvent[]> = new Map(); // userId -> buffered events
  
  private metrics: WebSocketMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    totalMessagesSent: 0,
    totalMessagesReceived: 0,
    averageLatencyMs: 0,
    errorRate: 0,
    subscriptionsCount: 0
  };

  private heartbeatInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;

  constructor(
    @inject(TYPES.Logger) private logger: ILogger
  ) {
    this.startHeartbeat();
    this.startCleanup();
    this.startMetricsCollection();
  }

  // ========== Connection Management ==========

  public async addConnection(
    connectionId: string,
    userId: string,
    metadata: {
      userAgent?: string;
      ipAddress?: string;
      [key: string]: any;
    } = {}
  ): Promise<WebSocketConnectionEntity> {
    const connection = new WebSocketConnectionEntity(
      `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId,
      connectionId,
      false, // Will be authenticated separately
      [],
      new Date(),
      new Date(),
      metadata
    );

    this.connections.set(connectionId, connection);
    
    // Track user connections
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    this.metrics.totalConnections++;
    this.metrics.activeConnections++;

    this.logger.info('WebSocket connection added', {
      connectionId,
      userId,
      totalConnections: this.metrics.activeConnections
    });

    // Send buffered events if any
    await this.sendBufferedEvents(userId, connectionId);

    return connection;
  }

  public async removeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from user connections tracking
    const userConnections = this.userConnections.get(connection.userId);
    if (userConnections) {
      userConnections.delete(connectionId);
      if (userConnections.size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    // Remove connection
    this.connections.delete(connectionId);
    this.metrics.activeConnections--;

    this.logger.info('WebSocket connection removed', {
      connectionId,
      userId: connection.userId,
      connectionDuration: connection.getConnectionDuration(),
      remainingConnections: this.metrics.activeConnections
    });
  }

  public async authenticateConnection(
    connectionId: string,
    authToken: string
  ): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    try {
      // TODO: Implement proper JWT validation
      // For now, accept any non-empty token
      const isValid = Boolean(authToken && authToken.length > 0);
      
      if (isValid) {
        connection.isAuthenticated = true;
        this.logger.info('WebSocket connection authenticated', {
          connectionId,
          userId: connection.userId
        });
      }

      return isValid;
    } catch (error) {
      this.logger.error('WebSocket authentication failed', error as Error, {
        connectionId
      });
      return false;
    }
  }

  // ========== Event Broadcasting ==========

  public async broadcast(
    message: WebSocketMessage,
    filter?: (connection: WebSocketConnection) => boolean
  ): Promise<void> {
    const startTime = Date.now();
    let sentCount = 0;
    let errorCount = 0;

    const connections = Array.from(this.connections.values());
    const filteredConnections = filter 
      ? connections.filter(filter) 
      : connections.filter(conn => conn.isAuthenticated && conn.isConnected());

    const sendPromises = filteredConnections.map(async (connection) => {
      try {
        await this.sendToConnectionInternal(connection, message);
        sentCount++;
      } catch (error) {
        errorCount++;
        this.logger.warn('Failed to send broadcast message', {
          connectionId: connection.connectionId,
          userId: connection.userId,
          error: (error as Error).message
        });
      }
    });

    await Promise.allSettled(sendPromises);

    const latency = Date.now() - startTime;
    this.updateMetrics(sentCount, errorCount, latency);

    this.logger.debug('Broadcast completed', {
      messageType: message.type,
      totalRecipients: filteredConnections.length,
      successfulSends: sentCount,
      errors: errorCount,
      latencyMs: latency
    });
  }

  public async sendToUser(userId: string, message: WebSocketMessage): Promise<void> {
    const userConnections = this.userConnections.get(userId);
    
    if (!userConnections || userConnections.size === 0) {
      // Buffer the event for when user connects
      await this.bufferEvent(userId, message);
      return;
    }

    const connections = Array.from(userConnections)
      .map(connId => this.connections.get(connId))
      .filter((conn): conn is WebSocketConnectionEntity => 
        conn !== undefined && conn.isAuthenticated && conn.isConnected()
      );

    if (connections.length === 0) {
      await this.bufferEvent(userId, message);
      return;
    }

    const sendPromises = connections.map(connection => 
      this.sendToConnectionInternal(connection, message)
    );

    await Promise.allSettled(sendPromises);

    this.logger.debug('Message sent to user', {
      userId,
      messageType: message.type,
      connectionCount: connections.length
    });
  }

  public async sendToConnection(connectionId: string, message: WebSocketMessage): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    await this.sendToConnectionInternal(connection, message);
  }

  private async sendToConnectionInternal(
    connection: WebSocketConnectionEntity,
    message: WebSocketMessage
  ): Promise<void> {
    try {
      // TODO: Implement actual WebSocket sending
      // For now, just log the message
      this.logger.debug('Sending WebSocket message', {
        connectionId: connection.connectionId,
        userId: connection.userId,
        messageType: message.type,
        messageId: message.messageId
      });

      connection.updatePing(); // Update last activity
      this.metrics.totalMessagesSent++;

    } catch (error) {
      this.logger.error('Failed to send WebSocket message', error as Error, {
        connectionId: connection.connectionId,
        userId: connection.userId
      });
      throw error;
    }
  }

  // ========== Event Subscription Management ==========

  public async subscribe(
    connectionId: string,
    eventTypes: RealtimeEventType[],
    filters?: Array<{
      field: string;
      operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
      value: any;
    }>
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.isAuthenticated) {
      throw new Error('Connection not found or not authenticated');
    }

    // Update connection subscriptions
    eventTypes.forEach(eventType => {
      connection.subscribe(eventType);
    });

    // Create or update subscription entity
    const subscriptionId = `sub_${connection.userId}_${Date.now()}`;
    const subscription = new EventSubscriptionEntity(
      subscriptionId,
      connection.userId,
      eventTypes,
      ['websocket'],
      filters,
      true
    );

    this.subscriptions.set(subscriptionId, subscription);
    this.metrics.subscriptionsCount = this.subscriptions.size;

    this.logger.info('WebSocket subscription created', {
      subscriptionId,
      connectionId,
      userId: connection.userId,
      eventTypes,
      filterCount: filters?.length || 0
    });
  }

  public async unsubscribe(
    connectionId: string,
    eventTypes: RealtimeEventType[]
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    eventTypes.forEach(eventType => {
      connection.unsubscribe(eventType);
    });

    // Remove from subscription entities
    for (const [subId, subscription] of this.subscriptions.entries()) {
      if (subscription.userId === connection.userId) {
        eventTypes.forEach(eventType => {
          subscription.unsubscribe(eventType);
        });
        
        if (subscription.eventTypes.length === 0) {
          this.subscriptions.delete(subId);
        }
      }
    }

    this.metrics.subscriptionsCount = this.subscriptions.size;

    this.logger.info('WebSocket subscription updated', {
      connectionId,
      userId: connection.userId,
      unsubscribedEvents: eventTypes
    });
  }

  // ========== Event Processing ==========

  public async processEvent(event: RealtimeEvent): Promise<void> {
    const startTime = Date.now();

    // Find matching subscriptions
    const matchingSubscriptions = Array.from(this.subscriptions.values())
      .filter(subscription => subscription.matchesEvent(event));

    if (matchingSubscriptions.length === 0) {
      this.logger.debug('No matching subscriptions for event', {
        eventType: event.type,
        userId: event.userId,
        eventId: event.id
      });
      return;
    }

    // Create WebSocket message
    const message: WebSocketMessage = {
      type: 'event',
      payload: event,
      timestamp: new Date(),
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    };

    // Send to each matching user
    const userIds = [...new Set(matchingSubscriptions.map(sub => sub.userId))];
    const sendPromises = userIds.map(userId => this.sendToUser(userId, message));

    await Promise.allSettled(sendPromises);

    const processingTime = Date.now() - startTime;
    this.logger.debug('Event processed and distributed', {
      eventType: event.type,
      eventId: event.id,
      matchingSubscriptions: matchingSubscriptions.length,
      recipientUsers: userIds.length,
      processingTimeMs: processingTime
    });
  }

  // ========== Event Buffering ==========

  private async bufferEvent(userId: string, message: WebSocketMessage): Promise<void> {
    if (message.type !== 'event') return;

    const event = message.payload as RealtimeEvent;
    if (!this.eventBuffer.has(userId)) {
      this.eventBuffer.set(userId, []);
    }

    const buffer = this.eventBuffer.get(userId)!;
    buffer.push(event);

    // Limit buffer size to prevent memory issues
    const maxBufferSize = 100;
    if (buffer.length > maxBufferSize) {
      buffer.splice(0, buffer.length - maxBufferSize);
    }

    this.logger.debug('Event buffered for offline user', {
      userId,
      eventType: event.type,
      bufferSize: buffer.length
    });
  }

  private async sendBufferedEvents(userId: string, connectionId: string): Promise<void> {
    const bufferedEvents = this.eventBuffer.get(userId);
    if (!bufferedEvents || bufferedEvents.length === 0) return;

    const connection = this.connections.get(connectionId);
    if (!connection || !connection.isAuthenticated) return;

    for (const event of bufferedEvents) {
      const message: WebSocketMessage = {
        type: 'event',
        payload: event,
        timestamp: new Date(),
        messageId: `buffered_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      };

      try {
        await this.sendToConnectionInternal(connection, message);
      } catch (error) {
        this.logger.warn('Failed to send buffered event', {
          userId,
          eventId: event.id,
          error: (error as Error).message
        });
      }
    }

    // Clear buffer after sending
    this.eventBuffer.delete(userId);

    this.logger.info('Buffered events sent to reconnected user', {
      userId,
      eventCount: bufferedEvents.length
    });
  }

  // ========== Maintenance and Monitoring ==========

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      const pingMessage: WebSocketMessage = {
        type: 'ping',
        payload: { timestamp: new Date() },
        timestamp: new Date(),
        messageId: `ping_${Date.now()}`
      };

      await this.broadcast(pingMessage, (conn) => conn.isAuthenticated);
    }, 30000); // Ping every 30 seconds
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
      this.cleanupOldBufferedEvents();
    }, 300000); // Cleanup every 5 minutes
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.updateConnectionMetrics();
    }, 10000); // Update metrics every 10 seconds
  }

  private cleanupStaleConnections(): void {
    const staleConnections: string[] = [];
    
    for (const [connectionId, connection] of this.connections.entries()) {
      if (!connection.isConnected(60000)) { // 1 minute timeout
        staleConnections.push(connectionId);
      }
    }

    staleConnections.forEach(connectionId => {
      this.removeConnection(connectionId);
    });

    if (staleConnections.length > 0) {
      this.logger.info('Stale connections cleaned up', {
        cleanedCount: staleConnections.length,
        remainingConnections: this.connections.size
      });
    }
  }

  private cleanupOldBufferedEvents(): void {
    const maxBufferAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    let cleanedUsers = 0;

    for (const [userId, events] of this.eventBuffer.entries()) {
      const filteredEvents = events.filter(event => 
        (now - event.timestamp.getTime()) < maxBufferAge
      );

      if (filteredEvents.length === 0) {
        this.eventBuffer.delete(userId);
        cleanedUsers++;
      } else if (filteredEvents.length !== events.length) {
        this.eventBuffer.set(userId, filteredEvents);
      }
    }

    if (cleanedUsers > 0) {
      this.logger.info('Old buffered events cleaned up', {
        cleanedUsers,
        remainingBuffers: this.eventBuffer.size
      });
    }
  }

  private updateMetrics(sentCount: number, errorCount: number, latency: number): void {
    this.metrics.totalMessagesSent += sentCount;
    
    if (errorCount > 0) {
      const totalMessages = this.metrics.totalMessagesSent + this.metrics.totalMessagesReceived;
      this.metrics.errorRate = (this.metrics.errorRate * (totalMessages - sentCount) + errorCount) / totalMessages;
    }

    // Update average latency using exponential moving average
    const alpha = 0.1;
    this.metrics.averageLatencyMs = (1 - alpha) * this.metrics.averageLatencyMs + alpha * latency;
  }

  private updateConnectionMetrics(): void {
    this.metrics.activeConnections = this.connections.size;
    this.metrics.subscriptionsCount = this.subscriptions.size;
  }

  // ========== Public Interface ==========

  public getMetrics(): WebSocketMetrics {
    return { ...this.metrics };
  }

  public getConnectionStatus(): {
    totalConnections: number;
    authenticatedConnections: number;
    subscriptions: number;
    bufferedUsers: number;
  } {
    const authenticatedConnections = Array.from(this.connections.values())
      .filter(conn => conn.isAuthenticated).length;

    return {
      totalConnections: this.connections.size,
      authenticatedConnections,
      subscriptions: this.subscriptions.size,
      bufferedUsers: this.eventBuffer.size
    };
  }

  public async close(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Close all connections
    const closePromises = Array.from(this.connections.keys())
      .map(connectionId => this.removeConnection(connectionId));

    await Promise.all(closePromises);

    this.logger.info('WebSocket service closed');
  }
}