import { injectable, inject } from 'inversify';
import { ILogger } from '../../../shared/interfaces/ILogger';
import { TYPES } from '../../../infrastructure/ioc/types';
import { FormanceLedgerService } from '../../../infrastructure/formance/FormanceLedgerService';
import { FormanceClientService } from '../../../infrastructure/formance/FormanceClientService';
import { 
  FormanceTransactionTemplates,
  TransactionRequest 
} from '../../../domains/formance/entities/FormanceTransaction';
import { 
  AccountStructure,
  CreateAccountRequest,
  FormanceAccountMetadata 
} from '../../../domains/formance/entities/FormanceAccount';
import { Account, AccountType, AccountStatus, AccountEntity } from '../entities/Account';
import { Transaction, TransactionType, TransactionStatus, TransactionEntity } from '../entities/Transaction';

export interface CreateUserAccountRequest {
  userId: string;
  accountType: 'wallet' | 'savings';
  initialMetadata?: Record<string, any>;
}

export interface CreateBusinessAccountRequest {
  businessId: string;
  accountType: 'main' | 'escrow';
  subAccountId?: string;
  initialMetadata?: Record<string, any>;
}

export interface P2PTransferRequest {
  fromUserId: string;
  toUserId: string;
  amount: bigint;
  asset: string;
  description: string;
  feeAmount?: bigint;
}

export interface DepositRequest {
  userId: string;
  amount: bigint;
  asset: string;
  externalReference: string;
  source: 'stripe' | 'bank' | 'crypto';
  description: string;
}

export interface WithdrawalRequest {
  userId: string;
  amount: bigint;
  asset: string;
  externalReference: string;
  destination: 'bank' | 'crypto';
  description: string;
  feeAmount?: bigint;
}

export interface CryptoPurchaseRequest {
  userId: string;
  fiatAmount: bigint;
  fiatAsset: string;
  cryptoAmount: bigint;
  cryptoAsset: string;
  exchangeRate: number;
  description: string;
}

/**
 * High-level banking service that provides business logic
 * and integrates Formance with our banking domain model
 */
@injectable()
export class FormanceBankingService {
  constructor(
    @inject(TYPES.FormanceLedgerService) private formanceLedger: FormanceLedgerService,
    @inject(TYPES.FormanceClientService) private formanceClient: FormanceClientService,
    @inject(TYPES.Logger) private logger: ILogger
  ) {}

  // ========== Account Management ==========

  public async createUserAccount(request: CreateUserAccountRequest): Promise<Account> {
    this.logger.info('Creating user account via Formance', {
      userId: request.userId,
      accountType: request.accountType
    });

    const accountAddress = request.accountType === 'wallet' 
      ? AccountStructure.userWallet(request.userId)
      : AccountStructure.userSavings(request.userId);

    const metadata: FormanceAccountMetadata = {
      user_id: request.userId,
      account_type: request.accountType,
      created_at: new Date().toISOString(),
      kyc_status: 'pending',
      compliance_level: 'basic',
      ...request.initialMetadata
    };

    const createRequest: CreateAccountRequest = {
      address: accountAddress,
      type: 'user',
      metadata
    };

    const formanceAccount = await this.formanceLedger.createAccount(createRequest);

    // Convert to our domain model
    return new AccountEntity(
      formanceAccount.address,
      request.userId,
      request.accountType === 'wallet' ? AccountType.PERSONAL : AccountType.SAVINGS,
      'USD', // Default currency, can be made configurable
      0, // Initial balance
      AccountStatus.ACTIVE,
      new Date(),
      new Date()
    );
  }

  public async createBusinessAccount(request: CreateBusinessAccountRequest): Promise<Account> {
    this.logger.info('Creating business account via Formance', {
      businessId: request.businessId,
      accountType: request.accountType
    });

    const accountAddress = request.accountType === 'main'
      ? AccountStructure.businessMain(request.businessId)
      : request.subAccountId
        ? AccountStructure.businessSub(request.businessId, request.subAccountId)
        : AccountStructure.businessEscrow(request.businessId);

    const metadata: FormanceAccountMetadata = {
      business_id: request.businessId,
      account_type: request.accountType,
      created_at: new Date().toISOString(),
      kyc_status: 'verified', // Businesses typically go through enhanced KYC
      compliance_level: 'enhanced',
      ...request.initialMetadata
    };

    const createRequest: CreateAccountRequest = {
      address: accountAddress,
      type: 'business',
      metadata
    };

    const formanceAccount = await this.formanceLedger.createAccount(createRequest);

    return new AccountEntity(
      formanceAccount.address,
      request.businessId,
      AccountType.BUSINESS,
      'USD',
      0,
      AccountStatus.ACTIVE,
      new Date(),
      new Date()
    );
  }

  public async getUserAccountBalance(userId: string, accountType: 'wallet' | 'savings' = 'wallet'): Promise<bigint> {
    const accountAddress = accountType === 'wallet' 
      ? AccountStructure.userWallet(userId)
      : AccountStructure.userSavings(userId);

    const balances = await this.formanceLedger.getAccountBalance(accountAddress);
    const usdBalance = balances.find(b => b.asset === 'USD');
    return usdBalance?.amount || BigInt(0);
  }

  public async getBusinessAccountBalance(businessId: string, accountType: 'main' | 'escrow' = 'main'): Promise<bigint> {
    const accountAddress = accountType === 'main'
      ? AccountStructure.businessMain(businessId)
      : AccountStructure.businessEscrow(businessId);

    const balances = await this.formanceLedger.getAccountBalance(accountAddress);
    const usdBalance = balances.find(b => b.asset === 'USD');
    return usdBalance?.amount || BigInt(0);
  }

  // ========== Transaction Processing ==========

  public async processP2PTransfer(request: P2PTransferRequest): Promise<Transaction> {
    this.logger.info('Processing P2P transfer via Formance', {
      fromUserId: request.fromUserId,
      toUserId: request.toUserId,
      amount: request.amount.toString(),
      asset: request.asset
    });

    // Validate sufficient balance
    const fromBalance = await this.getUserAccountBalance(request.fromUserId);
    const totalRequired = request.amount + (request.feeAmount || BigInt(0));
    
    if (fromBalance < totalRequired) {
      throw new Error(`Insufficient balance. Required: ${totalRequired}, Available: ${fromBalance}`);
    }

    // Create Formance transaction
    const transactionRequest = FormanceTransactionTemplates.p2pTransferWithFee(
      request.fromUserId,
      request.toUserId,
      request.amount,
      request.asset,
      request.feeAmount || BigInt(0),
      `p2p_${Date.now()}`
    );

    // Add additional metadata
    transactionRequest.metadata.description = request.description;
    transactionRequest.metadata.created_by = 'formance_banking_service';

    const formanceTransaction = await this.formanceLedger.createTransaction(transactionRequest);

    // Convert to our domain model
    return new TransactionEntity(
      formanceTransaction.id?.toString() || formanceTransaction.txid?.toString() || 'unknown',
      AccountStructure.userWallet(request.fromUserId),
      AccountStructure.userWallet(request.toUserId),
      Number(request.amount),
      request.asset,
      TransactionType.P2P_TRANSFER,
      TransactionStatus.COMPLETED,
      request.description,
      formanceTransaction.metadata,
      new Date(formanceTransaction.timestamp || Date.now()),
      new Date()
    );
  }

  public async processDeposit(request: DepositRequest): Promise<Transaction> {
    this.logger.info('Processing deposit via Formance', {
      userId: request.userId,
      amount: request.amount.toString(),
      asset: request.asset,
      source: request.source
    });

    const transactionRequest = FormanceTransactionTemplates.externalDeposit(
      request.userId,
      request.amount,
      request.asset,
      request.externalReference,
      request.source
    );

    transactionRequest.metadata.description = request.description;
    transactionRequest.metadata.created_by = 'formance_banking_service';

    const formanceTransaction = await this.formanceLedger.createTransaction(transactionRequest);

    return new TransactionEntity(
      formanceTransaction.id?.toString() || formanceTransaction.txid?.toString() || 'unknown',
      '@world', // External source
      AccountStructure.userWallet(request.userId),
      Number(request.amount),
      request.asset,
      TransactionType.DEPOSIT,
      TransactionStatus.COMPLETED,
      request.description,
      formanceTransaction.metadata,
      new Date(formanceTransaction.timestamp || Date.now()),
      new Date()
    );
  }

  public async processWithdrawal(request: WithdrawalRequest): Promise<Transaction> {
    this.logger.info('Processing withdrawal via Formance', {
      userId: request.userId,
      amount: request.amount.toString(),
      asset: request.asset,
      destination: request.destination
    });

    // Validate sufficient balance
    const balance = await this.getUserAccountBalance(request.userId);
    const totalRequired = request.amount + (request.feeAmount || BigInt(0));
    
    if (balance < totalRequired) {
      throw new Error(`Insufficient balance. Required: ${totalRequired}, Available: ${balance}`);
    }

    const transactionRequest = FormanceTransactionTemplates.externalWithdrawal(
      request.userId,
      request.amount,
      request.asset,
      request.feeAmount || BigInt(0),
      request.externalReference,
      request.destination
    );

    transactionRequest.metadata.description = request.description;
    transactionRequest.metadata.created_by = 'formance_banking_service';

    const formanceTransaction = await this.formanceLedger.createTransaction(transactionRequest);

    return new TransactionEntity(
      formanceTransaction.id?.toString() || formanceTransaction.txid?.toString() || 'unknown',
      AccountStructure.userWallet(request.userId),
      '@world', // External destination
      Number(request.amount),
      request.asset,
      TransactionType.WITHDRAWAL,
      TransactionStatus.COMPLETED,
      request.description,
      formanceTransaction.metadata,
      new Date(formanceTransaction.timestamp || Date.now()),
      new Date()
    );
  }

  public async processCryptoPurchase(request: CryptoPurchaseRequest): Promise<Transaction> {
    this.logger.info('Processing crypto purchase via Formance', {
      userId: request.userId,
      fiatAmount: request.fiatAmount.toString(),
      cryptoAmount: request.cryptoAmount.toString(),
      exchangeRate: request.exchangeRate
    });

    // Validate sufficient fiat balance
    const fiatBalance = await this.getUserAccountBalance(request.userId);
    if (fiatBalance < request.fiatAmount) {
      throw new Error(`Insufficient fiat balance. Required: ${request.fiatAmount}, Available: ${fiatBalance}`);
    }

    const transactionRequest = FormanceTransactionTemplates.cryptoPurchase(
      request.userId,
      request.fiatAmount,
      request.fiatAsset,
      request.cryptoAmount,
      request.cryptoAsset,
      request.exchangeRate
    );

    transactionRequest.metadata.description = request.description;
    transactionRequest.metadata.created_by = 'formance_banking_service';

    const formanceTransaction = await this.formanceLedger.createTransaction(transactionRequest);

    return new TransactionEntity(
      formanceTransaction.id?.toString() || formanceTransaction.txid?.toString() || 'unknown',
      AccountStructure.userWallet(request.userId),
      AccountStructure.userCrypto(request.userId, request.cryptoAsset),
      Number(request.fiatAmount),
      request.fiatAsset,
      TransactionType.CURRENCY_CONVERSION,
      TransactionStatus.COMPLETED,
      request.description,
      formanceTransaction.metadata,
      new Date(formanceTransaction.timestamp || Date.now()),
      new Date()
    );
  }

  // ========== Query Methods ==========

  public async getUserTransactionHistory(userId: string, limit: number = 50): Promise<Transaction[]> {
    const userWalletAddress = AccountStructure.userWallet(userId);
    
    const formanceTransactions = await this.formanceLedger.getTransactionsForAccount(
      userWalletAddress,
      { limit }
    );

    return formanceTransactions.map(ft => new TransactionEntity(
      ft.id?.toString() || ft.txid?.toString() || 'unknown',
      ft.postings[0]?.source || 'unknown',
      ft.postings[0]?.destination || 'unknown',
      Number(ft.postings[0]?.amount || 0),
      ft.postings[0]?.asset || 'USD',
      this.mapTransactionType(ft.metadata.type),
      TransactionStatus.COMPLETED, // Formance transactions are atomic
      ft.metadata.description || '',
      ft.metadata,
      new Date(ft.timestamp || Date.now()),
      new Date(ft.timestamp || Date.now())
    ));
  }

  public async getSystemStats(): Promise<{
    totalUsers: number;
    totalBusinesses: number;
    totalTransactions: number;
    totalVolume: Record<string, bigint>;
  }> {
    const config = this.formanceClient.getConfig();
    const stats = await this.formanceLedger.getLedgerStats(config.defaultLedger);

    // Count users and businesses by analyzing account patterns
    const accounts = await this.formanceLedger.listAccounts({ limit: 1000 });
    const userAccounts = accounts.filter(acc => acc.address.startsWith('users:'));
    const businessAccounts = accounts.filter(acc => acc.address.startsWith('business:'));

    const uniqueUsers = new Set(
      userAccounts.map(acc => acc.address.split(':')[1])
    ).size;

    const uniqueBusinesses = new Set(
      businessAccounts.map(acc => acc.address.split(':')[1])
    ).size;

    return {
      totalUsers: uniqueUsers,
      totalBusinesses: uniqueBusinesses,
      totalTransactions: stats.transactions,
      totalVolume: stats.volume
    };
  }

  // ========== Health Check ==========

  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    formanceConnection: boolean;
    details: Record<string, any>;
  }> {
    try {
      const healthStatus = await this.formanceClient.getHealthStatus();
      const isConnected = await this.formanceClient.isConnected();

      return {
        status: healthStatus.status,
        formanceConnection: isConnected,
        details: {
          ...healthStatus.details,
          service: 'FormanceBankingService',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      this.logger.error('Health check failed', error as Error);
      
      return {
        status: 'unhealthy',
        formanceConnection: false,
        details: {
          error: (error as Error).message,
          service: 'FormanceBankingService',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // ========== Private Helper Methods ==========

  private mapTransactionType(formanceType: string): TransactionType {
    switch (formanceType) {
      case 'p2p_transfer':
        return TransactionType.P2P_TRANSFER;
      case 'deposit':
        return TransactionType.DEPOSIT;
      case 'withdrawal':
        return TransactionType.WITHDRAWAL;
      case 'crypto_purchase':
        return TransactionType.CURRENCY_CONVERSION;
      case 'card_payment':
        return TransactionType.CARD_PAYMENT;
      default:
        return TransactionType.P2P_TRANSFER;
    }
  }
}