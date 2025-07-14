import { injectable, inject } from 'inversify';
import { ILogger } from '../../../shared/interfaces/ILogger';
import { TYPES } from '../../../infrastructure/ioc/types';
import { 
  BankConnection, 
  BankAccountDetails, 
  BankTransfer,
  BankConnectionCapability 
} from '../entities/BankAccount';
import { 
  BankConnectionEntity, 
  BankAccountEntity, 
  BankTransferEntity 
} from '../entities/BankAccount';

export interface BankingProvider {
  providerId: string;
  providerName: string;
  connectionType: 'plaid' | 'yodlee' | 'open_banking' | 'manual' | 'swift';
  capabilities: BankConnectionCapability[];
  supportedCountries: string[];
  isActive: boolean;
}

export interface ConnectionRequest {
  userId: string;
  providerId: string;
  credentials?: {
    publicToken?: string;
    username?: string;
    password?: string;
    mfaCode?: string;
    [key: string]: any;
  };
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    [key: string]: any;
  };
}

export interface TransferRequest {
  userId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: bigint;
  currency: string;
  transferType: 'deposit' | 'withdrawal' | 'transfer';
  paymentMethod: 'ach' | 'wire' | 'instant' | 'check';
  metadata?: {
    description?: string;
    reference?: string;
    memo?: string;
    scheduledAt?: Date;
    regulatoryInfo?: {
      purpose: string;
      category: string;
    };
  };
}

export interface BankBalance {
  accountId: string;
  availableBalance: bigint;
  currentBalance: bigint;
  currency: string;
  lastUpdated: Date;
}

export interface IBankingProvider {
  getProviderId(): string;
  connect(request: ConnectionRequest): Promise<BankConnectionEntity>;
  disconnect(connectionId: string): Promise<void>;
  refreshConnection(connection: BankConnectionEntity): Promise<BankConnectionEntity>;
  getAccounts(connection: BankConnectionEntity): Promise<BankAccountEntity[]>;
  getBalances(connection: BankConnectionEntity, accountIds?: string[]): Promise<BankBalance[]>;
  initiateTransfer(connection: BankConnectionEntity, request: TransferRequest): Promise<BankTransferEntity>;
  getTransferStatus(connection: BankConnectionEntity, transferId: string): Promise<BankTransferEntity>;
  cancelTransfer(connection: BankConnectionEntity, transferId: string): Promise<boolean>;
  validateAccount(accountDetails: Partial<BankAccountDetails>): Promise<{ valid: boolean; errors: string[] }>;
}

@injectable()
export class BankingIntegrationService {
  private providers: Map<string, IBankingProvider> = new Map();
  private connections: Map<string, BankConnectionEntity> = new Map();
  private transfers: Map<string, BankTransferEntity> = new Map();

  constructor(
    @inject(TYPES.Logger) private logger: ILogger
  ) {}

  // ========== Provider Management ==========

  public registerProvider(provider: IBankingProvider): void {
    this.providers.set(provider.getProviderId(), provider);
    this.logger.info('Banking provider registered', {
      providerId: provider.getProviderId(),
      totalProviders: this.providers.size
    });
  }

  public getAvailableProviders(): BankingProvider[] {
    return Array.from(this.providers.keys()).map(providerId => {
      const provider = this.providers.get(providerId)!;
      return {
        providerId,
        providerName: providerId, // Provider should implement getName()
        connectionType: 'plaid', // Provider should implement getConnectionType()
        capabilities: [], // Provider should implement getCapabilities()
        supportedCountries: [], // Provider should implement getSupportedCountries()
        isActive: true
      };
    });
  }

  public getProvider(providerId: string): IBankingProvider | null {
    return this.providers.get(providerId) || null;
  }

  // ========== Connection Management ==========

  public async createConnection(request: ConnectionRequest): Promise<BankConnectionEntity> {
    const provider = this.getProvider(request.providerId);
    if (!provider) {
      throw new Error(`Banking provider not found: ${request.providerId}`);
    }

    try {
      this.logger.info('Creating bank connection', {
        userId: request.userId,
        providerId: request.providerId
      });

      const connection = await provider.connect(request);
      this.connections.set(connection.id, connection);

      this.logger.info('Bank connection created successfully', {
        connectionId: connection.id,
        userId: request.userId,
        providerId: request.providerId,
        accountCount: connection.accounts.length
      });

      return connection;
    } catch (error) {
      this.logger.error('Failed to create bank connection', error as Error, {
        userId: request.userId,
        providerId: request.providerId
      });
      throw error;
    }
  }

  public async getConnection(connectionId: string): Promise<BankConnectionEntity | null> {
    return this.connections.get(connectionId) || null;
  }

  public async getUserConnections(userId: string): Promise<BankConnectionEntity[]> {
    return Array.from(this.connections.values())
      .filter(connection => connection.userId === userId);
  }

  public async refreshConnection(connectionId: string): Promise<BankConnectionEntity> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const provider = this.getProvider(connection.providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${connection.providerId}`);
    }

    try {
      this.logger.info('Refreshing bank connection', {
        connectionId,
        userId: connection.userId,
        providerId: connection.providerId
      });

      const refreshedConnection = await provider.refreshConnection(connection);
      this.connections.set(connectionId, refreshedConnection);

      this.logger.info('Bank connection refreshed successfully', {
        connectionId,
        accountCount: refreshedConnection.accounts.length,
        status: refreshedConnection.status
      });

      return refreshedConnection;
    } catch (error) {
      this.logger.error('Failed to refresh bank connection', error as Error, {
        connectionId
      });
      
      // Update connection status to error
      connection.updateStatus('error', {
        code: 'REFRESH_FAILED',
        message: (error as Error).message,
        requiresUserAction: true
      });

      throw error;
    }
  }

  public async disconnectBank(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const provider = this.getProvider(connection.providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${connection.providerId}`);
    }

    try {
      await provider.disconnect(connectionId);
      connection.updateStatus('inactive');
      
      this.logger.info('Bank connection disconnected', {
        connectionId,
        userId: connection.userId,
        providerId: connection.providerId
      });
    } catch (error) {
      this.logger.error('Failed to disconnect bank connection', error as Error, {
        connectionId
      });
      throw error;
    }
  }

  // ========== Account Management ==========

  public async getAccounts(connectionId: string): Promise<BankAccountEntity[]> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const provider = this.getProvider(connection.providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${connection.providerId}`);
    }

    try {
      const accounts = await provider.getAccounts(connection);
      
      // Update connection with latest account info
      connection.accounts = accounts.map(account => account.toJSON());
      connection.markSynced();

      this.logger.info('Bank accounts retrieved', {
        connectionId,
        accountCount: accounts.length
      });

      return accounts;
    } catch (error) {
      this.logger.error('Failed to get bank accounts', error as Error, {
        connectionId
      });
      throw error;
    }
  }

  public async getBalances(connectionId: string, accountIds?: string[]): Promise<BankBalance[]> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const provider = this.getProvider(connection.providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${connection.providerId}`);
    }

    try {
      const balances = await provider.getBalances(connection, accountIds);
      
      this.logger.info('Bank balances retrieved', {
        connectionId,
        accountCount: balances.length
      });

      return balances;
    } catch (error) {
      this.logger.error('Failed to get bank balances', error as Error, {
        connectionId
      });
      throw error;
    }
  }

  public async validateBankAccount(accountDetails: Partial<BankAccountDetails>): Promise<{ valid: boolean; errors: string[] }> {
    // Basic validation
    const errors: string[] = [];

    if (!accountDetails.accountNumber) {
      errors.push('Account number is required');
    }

    if (!accountDetails.routingNumber) {
      errors.push('Routing number is required');
    }

    if (!accountDetails.bankName) {
      errors.push('Bank name is required');
    }

    if (!accountDetails.accountType) {
      errors.push('Account type is required');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Try validation with providers
    for (const provider of this.providers.values()) {
      try {
        const result = await provider.validateAccount(accountDetails);
        if (!result.valid) {
          return result;
        }
      } catch (error) {
        this.logger.warn('Provider validation failed', {
          providerId: provider.getProviderId(),
          error: (error as Error).message
        });
      }
    }

    return { valid: true, errors: [] };
  }

  // ========== Transfer Management ==========

  public async initiateTransfer(connectionId: string, request: TransferRequest): Promise<BankTransferEntity> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const provider = this.getProvider(connection.providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${connection.providerId}`);
    }

    // Validate connection can initiate transfers
    if (!connection.canInitiateTransfers()) {
      throw new Error('Connection does not support transfer initiation');
    }

    try {
      this.logger.info('Initiating bank transfer', {
        connectionId,
        userId: request.userId,
        transferType: request.transferType,
        amount: request.amount.toString(),
        currency: request.currency,
        paymentMethod: request.paymentMethod
      });

      const transfer = await provider.initiateTransfer(connection, request);
      this.transfers.set(transfer.id, transfer);

      this.logger.info('Bank transfer initiated successfully', {
        transferId: transfer.id,
        status: transfer.status,
        estimatedSettlement: transfer.getEstimatedSettlementDate()
      });

      return transfer;
    } catch (error) {
      this.logger.error('Failed to initiate bank transfer', error as Error, {
        connectionId,
        transferType: request.transferType,
        amount: request.amount.toString()
      });
      throw error;
    }
  }

  public async getTransfer(transferId: string): Promise<BankTransferEntity | null> {
    return this.transfers.get(transferId) || null;
  }

  public async getTransferStatus(transferId: string): Promise<BankTransferEntity> {
    const transfer = this.transfers.get(transferId);
    if (!transfer) {
      throw new Error(`Transfer not found: ${transferId}`);
    }

    const connection = this.connections.get(transfer.bankConnectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${transfer.bankConnectionId}`);
    }

    const provider = this.getProvider(connection.providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${connection.providerId}`);
    }

    try {
      const updatedTransfer = await provider.getTransferStatus(connection, transferId);
      this.transfers.set(transferId, updatedTransfer);

      this.logger.info('Transfer status updated', {
        transferId,
        status: updatedTransfer.status,
        previousStatus: transfer.status
      });

      return updatedTransfer;
    } catch (error) {
      this.logger.error('Failed to get transfer status', error as Error, {
        transferId
      });
      throw error;
    }
  }

  public async cancelTransfer(transferId: string): Promise<boolean> {
    const transfer = this.transfers.get(transferId);
    if (!transfer) {
      throw new Error(`Transfer not found: ${transferId}`);
    }

    if (!transfer.canCancel()) {
      throw new Error('Transfer cannot be cancelled in current status');
    }

    const connection = this.connections.get(transfer.bankConnectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${transfer.bankConnectionId}`);
    }

    const provider = this.getProvider(connection.providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${connection.providerId}`);
    }

    try {
      const cancelled = await provider.cancelTransfer(connection, transferId);
      
      if (cancelled) {
        transfer.updateStatus('cancelled');
        this.logger.info('Transfer cancelled successfully', { transferId });
      }

      return cancelled;
    } catch (error) {
      this.logger.error('Failed to cancel transfer', error as Error, {
        transferId
      });
      throw error;
    }
  }

  public async getUserTransfers(userId: string): Promise<BankTransferEntity[]> {
    return Array.from(this.transfers.values())
      .filter(transfer => transfer.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ========== Monitoring and Maintenance ==========

  public async syncAllConnections(): Promise<{ successful: number; failed: number }> {
    const connections = Array.from(this.connections.values())
      .filter(connection => connection.status === 'active' && connection.needsSync());

    let successful = 0;
    let failed = 0;

    const syncPromises = connections.map(async (connection) => {
      try {
        await this.refreshConnection(connection.id);
        successful++;
      } catch (error) {
        failed++;
        this.logger.warn('Connection sync failed', {
          connectionId: connection.id,
          error: (error as Error).message
        });
      }
    });

    await Promise.allSettled(syncPromises);

    this.logger.info('Bulk connection sync completed', {
      totalConnections: connections.length,
      successful,
      failed
    });

    return { successful, failed };
  }

  public getSystemMetrics(): {
    providers: number;
    connections: number;
    activeConnections: number;
    transfers: number;
    pendingTransfers: number;
  } {
    const activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.status === 'active').length;

    const pendingTransfers = Array.from(this.transfers.values())
      .filter(transfer => ['pending', 'processing'].includes(transfer.status)).length;

    return {
      providers: this.providers.size,
      connections: this.connections.size,
      activeConnections,
      transfers: this.transfers.size,
      pendingTransfers
    };
  }
}