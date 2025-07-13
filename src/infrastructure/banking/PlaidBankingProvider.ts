import { injectable, inject } from 'inversify';
import { ILogger } from '../../shared/interfaces/ILogger';
import { TYPES } from '../ioc/types';
import { IBankingProvider, ConnectionRequest, TransferRequest } from '../../domains/banking/services/BankingIntegrationService';
import { 
  BankConnectionEntity, 
  BankAccountEntity, 
  BankTransferEntity,
  BankAccountDetails 
} from '../../domains/banking/entities/BankAccount';
import { BankBalance } from '../../domains/banking/services/BankingIntegrationService';

export interface PlaidConfig {
  clientId: string;
  secret: string;
  environment: 'sandbox' | 'development' | 'production';
  webhookUrl?: string;
}

export interface PlaidAccount {
  account_id: string;
  balances: {
    available: number | null;
    current: number | null;
    iso_currency_code: string;
    limit: number | null;
    unofficial_currency_code: string | null;
  };
  mask: string;
  name: string;
  official_name: string | null;
  subtype: string;
  type: string;
  verification_status?: string;
}

export interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  iso_currency_code: string;
  date: string;
  datetime?: string;
  authorized_date?: string;
  name: string;
  merchant_name?: string;
  payment_channel: string;
  category: string[];
  subcategory?: string;
  transaction_type: string;
  pending: boolean;
  account_owner?: string;
}

export interface PlaidTransferCreateRequest {
  access_token: string;
  account_id: string;
  funding_account_id: string;
  type: 'debit' | 'credit';
  network: 'ach' | 'same-day-ach';
  amount: string;
  description: string;
  ach_class?: 'ppd' | 'web' | 'ccd';
  user: {
    legal_name: string;
    email_address?: string;
    phone_number?: string;
  };
  metadata?: Record<string, string>;
}

export interface PlaidTransferResponse {
  transfer: {
    id: string;
    ach_return_code?: string;
    amount: string;
    created: string;
    description: string;
    direction: 'outbound' | 'inbound';
    failure_reason?: string;
    iso_currency_code: string;
    metadata?: Record<string, string>;
    network: string;
    origination_account_id: string;
    status: 'pending' | 'posted' | 'cancelled' | 'failed' | 'returned';
    type: 'debit' | 'credit';
    user: {
      legal_name: string;
      email_address?: string;
      phone_number?: string;
    };
  };
  request_id: string;
}

@injectable()
export class PlaidBankingProvider implements IBankingProvider {
  private config: PlaidConfig;

  constructor(
    @inject(TYPES.Logger) private logger: ILogger
  ) {
    // Initialize with environment variables or default sandbox config
    this.config = {
      clientId: process.env.PLAID_CLIENT_ID || 'sandbox_client_id',
      secret: process.env.PLAID_SECRET || 'sandbox_secret',
      environment: (process.env.PLAID_ENV as 'sandbox' | 'development' | 'production') || 'sandbox',
      webhookUrl: process.env.PLAID_WEBHOOK_URL
    };
  }

  public getProviderId(): string {
    return 'plaid';
  }

  // ========== Connection Management ==========

  public async connect(request: ConnectionRequest): Promise<BankConnectionEntity> {
    const { userId, credentials, metadata } = request;

    if (!credentials?.publicToken) {
      throw new Error('Public token is required for Plaid connection');
    }

    try {
      // Exchange public token for access token
      const exchangeResponse = await this.exchangePublicToken(credentials.publicToken);
      
      // Get account information
      const accountsResponse = await this.getPlaidAccounts(exchangeResponse.access_token);
      
      // Create bank account entities
      const accounts = accountsResponse.accounts.map(account => 
        this.createBankAccountEntity(account, exchangeResponse.item_id)
      );

      // Create connection entity
      const connection = new BankConnectionEntity(
        `plaid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        userId,
        'plaid',
        'Plaid',
        'plaid',
        'active',
        {
          accessToken: exchangeResponse.access_token,
          itemId: exchangeResponse.item_id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        },
        accounts.map(account => account.toJSON()),
        ['read_accounts', 'read_balances', 'read_transactions', 'initiate_payments', 'ach_transfers']
      );

      this.logger.info('Plaid connection established', {
        connectionId: connection.id,
        userId,
        accountCount: accounts.length,
        itemId: exchangeResponse.item_id
      });

      return connection;
    } catch (error) {
      this.logger.error('Failed to establish Plaid connection', {
        userId,
        error: (error as Error).message
      });
      throw new Error(`Plaid connection failed: ${(error as Error).message}`);
    }
  }

  public async disconnect(connectionId: string): Promise<void> {
    this.logger.info('Plaid connection disconnected', { connectionId });
    // In a real implementation, you would revoke the access token with Plaid
  }

  public async refreshConnection(connection: BankConnectionEntity): Promise<BankConnectionEntity> {
    if (!connection.credentials.accessToken) {
      throw new Error('Access token not found in connection credentials');
    }

    try {
      // Get updated account information
      const accountsResponse = await this.getPlaidAccounts(connection.credentials.accessToken);
      
      // Update accounts
      const updatedAccounts = accountsResponse.accounts.map(account => 
        this.createBankAccountEntity(account, connection.credentials.itemId!)
      );

      connection.accounts = updatedAccounts.map(account => account.toJSON());
      connection.markSynced();
      connection.updateStatus('active');

      this.logger.info('Plaid connection refreshed', {
        connectionId: connection.id,
        accountCount: updatedAccounts.length
      });

      return connection;
    } catch (error) {
      this.logger.error('Failed to refresh Plaid connection', {
        connectionId: connection.id,
        error: (error as Error).message
      });

      connection.updateStatus('error', {
        code: 'REFRESH_FAILED',
        message: (error as Error).message,
        requiresUserAction: false
      });

      throw error;
    }
  }

  // ========== Account Management ==========

  public async getAccounts(connection: BankConnectionEntity): Promise<BankAccountEntity[]> {
    if (!connection.credentials.accessToken) {
      throw new Error('Access token not found in connection credentials');
    }

    try {
      const accountsResponse = await this.getPlaidAccounts(connection.credentials.accessToken);
      
      return accountsResponse.accounts.map(account => 
        this.createBankAccountEntity(account, connection.credentials.itemId!)
      );
    } catch (error) {
      this.logger.error('Failed to get Plaid accounts', {
        connectionId: connection.id,
        error: (error as Error).message
      });
      throw error;
    }
  }

  public async getBalances(connection: BankConnectionEntity, accountIds?: string[]): Promise<BankBalance[]> {
    if (!connection.credentials.accessToken) {
      throw new Error('Access token not found in connection credentials');
    }

    try {
      const accountsResponse = await this.getPlaidAccounts(connection.credentials.accessToken);
      
      let filteredAccounts = accountsResponse.accounts;
      if (accountIds && accountIds.length > 0) {
        filteredAccounts = accountsResponse.accounts.filter(account => 
          accountIds.includes(account.account_id)
        );
      }

      return filteredAccounts.map(account => ({
        accountId: account.account_id,
        availableBalance: BigInt(Math.round((account.balances.available || 0) * 100)),
        currentBalance: BigInt(Math.round((account.balances.current || 0) * 100)),
        currency: account.balances.iso_currency_code,
        lastUpdated: new Date()
      }));
    } catch (error) {
      this.logger.error('Failed to get Plaid balances', {
        connectionId: connection.id,
        error: (error as Error).message
      });
      throw error;
    }
  }

  // ========== Transfer Management ==========

  public async initiateTransfer(connection: BankConnectionEntity, request: TransferRequest): Promise<BankTransferEntity> {
    if (!connection.credentials.accessToken) {
      throw new Error('Access token not found in connection credentials');
    }

    if (request.paymentMethod !== 'ach') {
      throw new Error('Plaid only supports ACH transfers');
    }

    try {
      const transferRequest: PlaidTransferCreateRequest = {
        access_token: connection.credentials.accessToken,
        account_id: request.sourceAccountId,
        funding_account_id: request.destinationAccountId,
        type: request.transferType === 'withdrawal' ? 'debit' : 'credit',
        network: 'ach',
        amount: (Number(request.amount) / 100).toFixed(2), // Convert from cents to dollars
        description: request.metadata?.description || `${request.transferType} via Plaid`,
        user: {
          legal_name: 'User', // This should come from user profile
          email_address: 'user@example.com' // This should come from user profile
        },
        metadata: {
          userId: request.userId,
          transferType: request.transferType,
          ...(request.metadata || {})
        }
      };

      const response = await this.createPlaidTransfer(transferRequest);

      const transfer = new BankTransferEntity(
        response.transfer.id,
        request.userId,
        connection.id,
        request.sourceAccountId,
        request.destinationAccountId,
        request.transferType,
        'ach',
        request.amount,
        request.currency,
        this.mapPlaidStatusToTransferStatus(response.transfer.status),
        response.transfer.direction === 'outbound' ? 'outbound' : 'inbound',
        {
          description: response.transfer.description,
          reference: response.transfer.id,
          expectedSettlementDate: this.calculateSettlementDate(response.transfer.network),
          regulatoryInfo: request.metadata?.regulatoryInfo
        }
      );

      this.logger.info('Plaid transfer initiated', {
        transferId: transfer.id,
        plaidTransferId: response.transfer.id,
        amount: request.amount.toString(),
        currency: request.currency
      });

      return transfer;
    } catch (error) {
      this.logger.error('Failed to initiate Plaid transfer', {
        connectionId: connection.id,
        request,
        error: (error as Error).message
      });
      throw error;
    }
  }

  public async getTransferStatus(connection: BankConnectionEntity, transferId: string): Promise<BankTransferEntity> {
    if (!connection.credentials.accessToken) {
      throw new Error('Access token not found in connection credentials');
    }

    try {
      const response = await this.getPlaidTransfer(connection.credentials.accessToken, transferId);
      
      // Create transfer entity from Plaid response
      const transfer = new BankTransferEntity(
        response.transfer.id,
        connection.userId,
        connection.id,
        response.transfer.origination_account_id,
        '', // Destination account not provided in response
        response.transfer.type === 'debit' ? 'withdrawal' : 'deposit',
        'ach',
        BigInt(Math.round(parseFloat(response.transfer.amount) * 100)),
        response.transfer.iso_currency_code,
        this.mapPlaidStatusToTransferStatus(response.transfer.status),
        response.transfer.direction === 'outbound' ? 'outbound' : 'inbound',
        {
          description: response.transfer.description,
          reference: response.transfer.id
        }
      );

      if (response.transfer.failure_reason) {
        transfer.updateStatus('failed', {
          code: 'PLAID_TRANSFER_FAILED',
          message: response.transfer.failure_reason,
          retryable: false
        });
      }

      return transfer;
    } catch (error) {
      this.logger.error('Failed to get Plaid transfer status', {
        connectionId: connection.id,
        transferId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  public async cancelTransfer(connection: BankConnectionEntity, transferId: string): Promise<boolean> {
    if (!connection.credentials.accessToken) {
      throw new Error('Access token not found in connection credentials');
    }

    try {
      await this.cancelPlaidTransfer(connection.credentials.accessToken, transferId);
      
      this.logger.info('Plaid transfer cancelled', {
        connectionId: connection.id,
        transferId
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to cancel Plaid transfer', {
        connectionId: connection.id,
        transferId,
        error: (error as Error).message
      });
      return false;
    }
  }

  public async validateAccount(accountDetails: Partial<BankAccountDetails>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Basic validation for US accounts
    if (accountDetails.routingNumber) {
      if (!/^\d{9}$/.test(accountDetails.routingNumber)) {
        errors.push('Routing number must be 9 digits');
      }
    }

    if (accountDetails.accountNumber) {
      if (!/^\d{4,17}$/.test(accountDetails.accountNumber)) {
        errors.push('Account number must be 4-17 digits');
      }
    }

    if (accountDetails.country && accountDetails.country !== 'US') {
      errors.push('Plaid only supports US bank accounts');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ========== Private Helper Methods ==========

  private async exchangePublicToken(publicToken: string): Promise<{ access_token: string; item_id: string }> {
    // Simulate Plaid API call
    // In a real implementation, you would make an HTTP request to Plaid's /link/token/exchange endpoint
    this.logger.debug('Exchanging public token with Plaid', { publicToken });
    
    return {
      access_token: `access-sandbox-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      item_id: `item-sandbox-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    };
  }

  private async getPlaidAccounts(accessToken: string): Promise<{ accounts: PlaidAccount[] }> {
    // Simulate Plaid API call
    // In a real implementation, you would make an HTTP request to Plaid's /accounts/get endpoint
    this.logger.debug('Fetching accounts from Plaid', { accessToken });
    
    return {
      accounts: [
        {
          account_id: `acc_${Date.now()}_checking`,
          balances: {
            available: 1000.50,
            current: 1000.50,
            iso_currency_code: 'USD',
            limit: null,
            unofficial_currency_code: null
          },
          mask: '0000',
          name: 'Plaid Checking',
          official_name: 'Plaid Gold Standard 0% Interest Checking',
          subtype: 'checking',
          type: 'depository',
          verification_status: 'verified'
        },
        {
          account_id: `acc_${Date.now()}_savings`,
          balances: {
            available: 5000.75,
            current: 5000.75,
            iso_currency_code: 'USD',
            limit: null,
            unofficial_currency_code: null
          },
          mask: '1111',
          name: 'Plaid Saving',
          official_name: 'Plaid Silver Standard 0.1% Interest Saving',
          subtype: 'savings',
          type: 'depository',
          verification_status: 'verified'
        }
      ]
    };
  }

  private async createPlaidTransfer(request: PlaidTransferCreateRequest): Promise<PlaidTransferResponse> {
    // Simulate Plaid API call
    // In a real implementation, you would make an HTTP request to Plaid's /transfer/create endpoint
    this.logger.debug('Creating Plaid transfer', { request });
    
    return {
      transfer: {
        id: `transfer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        amount: request.amount,
        created: new Date().toISOString(),
        description: request.description,
        direction: request.type === 'debit' ? 'outbound' : 'inbound',
        iso_currency_code: 'USD',
        metadata: request.metadata,
        network: request.network,
        origination_account_id: request.account_id,
        status: 'pending',
        type: request.type,
        user: request.user
      },
      request_id: `req_${Date.now()}`
    };
  }

  private async getPlaidTransfer(accessToken: string, transferId: string): Promise<PlaidTransferResponse> {
    // Simulate Plaid API call
    // In a real implementation, you would make an HTTP request to Plaid's /transfer/get endpoint
    this.logger.debug('Getting Plaid transfer status', { accessToken, transferId });
    
    return {
      transfer: {
        id: transferId,
        amount: '100.00',
        created: new Date().toISOString(),
        description: 'Test transfer',
        direction: 'outbound',
        iso_currency_code: 'USD',
        network: 'ach',
        origination_account_id: 'acc_test',
        status: 'posted',
        type: 'debit',
        user: {
          legal_name: 'Test User'
        }
      },
      request_id: `req_${Date.now()}`
    };
  }

  private async cancelPlaidTransfer(accessToken: string, transferId: string): Promise<void> {
    // Simulate Plaid API call
    // In a real implementation, you would make an HTTP request to Plaid's /transfer/cancel endpoint
    this.logger.debug('Cancelling Plaid transfer', { accessToken, transferId });
  }

  private createBankAccountEntity(plaidAccount: PlaidAccount, itemId: string): BankAccountEntity {
    return new BankAccountEntity(
      plaidAccount.account_id,
      plaidAccount.account_id, // Plaid doesn't expose real account numbers
      'XXXXXXXXX', // Plaid doesn't expose routing numbers
      plaidAccount.subtype as 'checking' | 'savings' | 'business',
      plaidAccount.name,
      'PLAID', // Bank code
      'US',
      plaidAccount.balances.iso_currency_code,
      true,
      plaidAccount.verification_status === 'verified',
      {
        holderName: plaidAccount.official_name || plaidAccount.name,
        holderType: 'individual',
        verificationStatus: plaidAccount.verification_status === 'verified' ? 'verified' : 'pending',
        verificationMethod: 'plaid',
        verifiedAt: plaidAccount.verification_status === 'verified' ? new Date() : undefined,
        plaidAccountId: plaidAccount.account_id,
        plaidItemId: itemId,
        mask: plaidAccount.mask
      }
    );
  }

  private mapPlaidStatusToTransferStatus(plaidStatus: string): 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'returned' {
    switch (plaidStatus) {
      case 'pending':
        return 'pending';
      case 'posted':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'cancelled':
        return 'cancelled';
      case 'returned':
        return 'returned';
      default:
        return 'pending';
    }
  }

  private calculateSettlementDate(network: string): Date {
    const now = new Date();
    switch (network) {
      case 'same-day-ach':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day
      case 'ach':
        return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days
      default:
        return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    }
  }
}