import { injectable, inject } from 'inversify';
import { ILogger } from '../../../shared/interfaces/ILogger';
import { TYPES } from '../../../infrastructure/ioc/types';
import { BankingIntegrationService, TransferRequest } from './BankingIntegrationService';
import { FormanceLedgerService } from '../../../infrastructure/formance/FormanceLedgerService';
import { RealtimeEventService } from '../../realtime/services/RealtimeEventService';
import { TransactionQueueService } from '../../realtime/services/TransactionQueueService';
import { 
  BankTransferEntity, 
  BankConnectionEntity,
  BankAccountEntity 
} from '../entities/BankAccount';
import { FormanceTransaction } from '../../formance/entities/FormanceTransaction';

export interface DepositRequest {
  userId: string;
  bankConnectionId: string;
  bankAccountId: string;
  formanceAccountId: string;
  amount: bigint;
  currency: string;
  paymentMethod: 'ach' | 'wire' | 'instant';
  metadata?: {
    description?: string;
    reference?: string;
    memo?: string;
    scheduledAt?: Date;
  };
}

export interface WithdrawalRequest {
  userId: string;
  bankConnectionId: string;
  bankAccountId: string;
  formanceAccountId: string;
  amount: bigint;
  currency: string;
  paymentMethod: 'ach' | 'wire' | 'instant';
  metadata?: {
    description?: string;
    reference?: string;
    memo?: string;
    scheduledAt?: Date;
  };
}

export interface TransferTransaction {
  id: string;
  userId: string;
  type: 'deposit' | 'withdrawal';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  bankTransfer: BankTransferEntity;
  formanceTransaction?: FormanceTransaction;
  amount: bigint;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  errorDetails?: {
    stage: 'bank_transfer' | 'formance_transaction' | 'reconciliation';
    message: string;
    retryable: boolean;
  };
}

@injectable()
export class DepositWithdrawalService {
  private transactions: Map<string, TransferTransaction> = new Map();
  private processingInterval?: NodeJS.Timeout;

  constructor(
    @inject(TYPES.Logger) private logger: ILogger,
    @inject(TYPES.BankingIntegrationService) private bankingService: BankingIntegrationService,
    @inject(TYPES.FormanceLedgerService) private formanceService: FormanceLedgerService,
    @inject(TYPES.RealtimeEventService) private eventService: RealtimeEventService,
    @inject(TYPES.TransactionQueueService) private queueService: TransactionQueueService
  ) {
    this.startTransactionProcessing();
  }

  // ========== Deposit Operations ==========

  public async initiateDeposit(request: DepositRequest): Promise<TransferTransaction> {
    try {
      this.logger.info('Initiating deposit', {
        userId: request.userId,
        amount: request.amount.toString(),
        currency: request.currency,
        paymentMethod: request.paymentMethod
      });

      // Validate bank connection and account
      const connection = await this.bankingService.getConnection(request.bankConnectionId);
      if (!connection) {
        throw new Error('Bank connection not found');
      }

      if (connection.userId !== request.userId) {
        throw new Error('Bank connection does not belong to user');
      }

      const bankAccount = connection.accounts.find(acc => acc.id === request.bankAccountId);
      if (!bankAccount) {
        throw new Error('Bank account not found');
      }

      if (!bankAccount.isVerified || !bankAccount.isActive) {
        throw new Error('Bank account is not verified or active');
      }

      // Create bank transfer request
      const transferRequest: TransferRequest = {
        userId: request.userId,
        sourceAccountId: request.bankAccountId,
        destinationAccountId: request.formanceAccountId, // This will be mapped internally
        amount: request.amount,
        currency: request.currency,
        transferType: 'deposit',
        paymentMethod: request.paymentMethod,
        metadata: {
          description: request.metadata?.description || 'Deposit to DWAY account',
          ...(request.metadata?.reference && { reference: request.metadata.reference }),
          ...(request.metadata?.memo && { memo: request.metadata.memo }),
          ...(request.metadata?.scheduledAt && { scheduledAt: request.metadata.scheduledAt }),
          regulatoryInfo: {
            purpose: 'deposit',
            category: 'consumer_deposit'
          }
        }
      };

      // Initiate bank transfer
      const bankTransfer = await this.bankingService.initiateTransfer(
        request.bankConnectionId,
        transferRequest
      );

      // Create transfer transaction record
      const transaction: TransferTransaction = {
        id: `dep_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        userId: request.userId,
        type: 'deposit',
        status: 'pending',
        bankTransfer,
        amount: request.amount,
        currency: request.currency,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.transactions.set(transaction.id, transaction);

      // Emit real-time event
      await this.eventService.emitTransactionEvent(
        'transaction_created',
        request.userId,
        {
          transactionId: transaction.id,
          type: 'deposit',
          amount: request.amount.toString(),
          currency: request.currency,
          status: 'pending'
        },
        'high'
      );

      this.logger.info('Deposit initiated successfully', {
        transactionId: transaction.id,
        bankTransferId: bankTransfer.id,
        userId: request.userId
      });

      return transaction;
    } catch (error) {
      this.logger.error('Failed to initiate deposit', error as Error, {
        userId: request.userId,
        amount: request.amount.toString(),
        currency: request.currency
      });

      await this.eventService.emitTransactionEvent(
        'transaction_failed',
        request.userId,
        {
          type: 'deposit',
          amount: request.amount.toString(),
          currency: request.currency,
          error: (error as Error).message
        },
        'high'
      );

      throw error;
    }
  }

  // ========== Withdrawal Operations ==========

  public async initiateWithdrawal(request: WithdrawalRequest): Promise<TransferTransaction> {
    try {
      this.logger.info('Initiating withdrawal', {
        userId: request.userId,
        amount: request.amount.toString(),
        currency: request.currency,
        paymentMethod: request.paymentMethod
      });

      // Validate bank connection and account
      const connection = await this.bankingService.getConnection(request.bankConnectionId);
      if (!connection) {
        throw new Error('Bank connection not found');
      }

      if (connection.userId !== request.userId) {
        throw new Error('Bank connection does not belong to user');
      }

      const bankAccount = connection.accounts.find(acc => acc.id === request.bankAccountId);
      if (!bankAccount) {
        throw new Error('Bank account not found');
      }

      if (!bankAccount.isVerified || !bankAccount.isActive) {
        throw new Error('Bank account is not verified or active');
      }

      // Check Formance account balance
      const balances = await this.formanceService.getAccountBalance(request.formanceAccountId);
      const balance = balances.find(b => b.asset === request.currency);
      
      if (!balance || balance.amount < request.amount) {
        throw new Error('Insufficient balance for withdrawal');
      }

      // Create Formance debit transaction first (reserve funds)
      const formanceTransaction = await this.createFormanceWithdrawalTransaction(
        request.formanceAccountId,
        request.amount,
        request.currency,
        request.metadata?.reference || `withdrawal_${Date.now()}`
      );

      // Create bank transfer request
      const transferRequest: TransferRequest = {
        userId: request.userId,
        sourceAccountId: request.formanceAccountId, // This will be mapped internally
        destinationAccountId: request.bankAccountId,
        amount: request.amount,
        currency: request.currency,
        transferType: 'withdrawal',
        paymentMethod: request.paymentMethod,
        metadata: {
          description: request.metadata?.description || 'Withdrawal from DWAY account',
          ...(request.metadata?.reference && { reference: request.metadata.reference }),
          ...(request.metadata?.memo && { memo: request.metadata.memo }),
          ...(request.metadata?.scheduledAt && { scheduledAt: request.metadata.scheduledAt }),
          regulatoryInfo: {
            purpose: 'withdrawal',
            category: 'consumer_withdrawal'
          }
        }
      };

      // Initiate bank transfer
      const bankTransfer = await this.bankingService.initiateTransfer(
        request.bankConnectionId,
        transferRequest
      );

      // Create transfer transaction record
      const transaction: TransferTransaction = {
        id: `wdr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        userId: request.userId,
        type: 'withdrawal',
        status: 'pending',
        bankTransfer,
        formanceTransaction,
        amount: request.amount,
        currency: request.currency,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.transactions.set(transaction.id, transaction);

      // Emit real-time event
      await this.eventService.emitTransactionEvent(
        'transaction_created',
        request.userId,
        {
          transactionId: transaction.id,
          type: 'withdrawal',
          amount: request.amount.toString(),
          currency: request.currency,
          status: 'pending'
        },
        'high'
      );

      this.logger.info('Withdrawal initiated successfully', {
        transactionId: transaction.id,
        bankTransferId: bankTransfer.id,
        formanceTransactionId: formanceTransaction.id,
        userId: request.userId
      });

      return transaction;
    } catch (error) {
      this.logger.error('Failed to initiate withdrawal', error as Error, {
        userId: request.userId,
        amount: request.amount.toString(),
        currency: request.currency
      });

      await this.eventService.emitTransactionEvent(
        'transaction_failed',
        request.userId,
        {
          type: 'withdrawal',
          amount: request.amount.toString(),
          currency: request.currency,
          error: (error as Error).message
        },
        'high'
      );

      throw error;
    }
  }

  // ========== Transaction Management ==========

  public async getTransaction(transactionId: string): Promise<TransferTransaction | null> {
    return this.transactions.get(transactionId) || null;
  }

  public async getUserTransactions(userId: string): Promise<TransferTransaction[]> {
    return Array.from(this.transactions.values())
      .filter(transaction => transaction.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async cancelTransaction(transactionId: string): Promise<boolean> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (!['pending', 'processing'].includes(transaction.status)) {
      throw new Error('Transaction cannot be cancelled in current status');
    }

    try {
      // Cancel bank transfer
      const cancelled = await this.bankingService.cancelTransfer(transaction.bankTransfer.id);
      
      if (cancelled) {
        transaction.status = 'cancelled';
        transaction.updatedAt = new Date();

        // If withdrawal, reverse the Formance transaction
        if (transaction.type === 'withdrawal' && transaction.formanceTransaction) {
          await this.reverseFormanceTransaction(transaction.formanceTransaction);
        }

        await this.eventService.emitTransactionEvent(
          'transaction_failed',
          transaction.userId,
          {
            transactionId: transaction.id,
            type: transaction.type,
            status: 'cancelled',
            reason: 'User cancelled'
          },
          'medium'
        );

        this.logger.info('Transaction cancelled', {
          transactionId,
          userId: transaction.userId
        });
      }

      return cancelled;
    } catch (error) {
      this.logger.error('Failed to cancel transaction', error as Error, {
        transactionId
      });
      throw error;
    }
  }

  // ========== Background Processing ==========

  private startTransactionProcessing(): void {
    this.processingInterval = setInterval(async () => {
      await this.processIncompletTransactions();
    }, 30000); // Check every 30 seconds
  }

  private async processIncompletTransactions(): Promise<void> {
    const incompleteTransactions = Array.from(this.transactions.values())
      .filter(transaction => ['pending', 'processing'].includes(transaction.status));

    for (const transaction of incompleteTransactions) {
      try {
        await this.updateTransactionStatus(transaction);
      } catch (error) {
        this.logger.warn('Failed to update transaction status', {
          transactionId: transaction.id,
          error: (error as Error).message
        });
      }
    }
  }

  private async updateTransactionStatus(transaction: TransferTransaction): Promise<void> {
    try {
      // Get latest bank transfer status
      const updatedBankTransfer = await this.bankingService.getTransferStatus(
        transaction.bankTransfer.id
      );

      const oldStatus = transaction.status;
      
      // Update transaction status based on bank transfer status
      if (updatedBankTransfer.status === 'completed' && transaction.status !== 'completed') {
        await this.completeTransaction(transaction);
      } else if (updatedBankTransfer.status === 'failed' && transaction.status !== 'failed') {
        await this.failTransaction(transaction, updatedBankTransfer.errorDetails?.message || 'Bank transfer failed');
      } else if (updatedBankTransfer.status === 'processing' && transaction.status === 'pending') {
        transaction.status = 'processing';
        transaction.updatedAt = new Date();

        await this.eventService.emitTransactionEvent(
          'transaction_processing',
          transaction.userId,
          {
            transactionId: transaction.id,
            type: transaction.type,
            status: 'processing'
          },
          'medium'
        );
      }

      // Update bank transfer in transaction
      transaction.bankTransfer = updatedBankTransfer;

      if (transaction.status !== oldStatus) {
        this.logger.info('Transaction status updated', {
          transactionId: transaction.id,
          oldStatus,
          newStatus: transaction.status
        });
      }
    } catch (error) {
      this.logger.error('Failed to update transaction status', error as Error, {
        transactionId: transaction.id
      });
    }
  }

  private async completeTransaction(transaction: TransferTransaction): Promise<void> {
    try {
      if (transaction.type === 'deposit') {
        // Create Formance credit transaction for deposit
        const formanceTransaction = await this.createFormanceDepositTransaction(
          transaction.bankTransfer.destinationAccountId,
          transaction.amount,
          transaction.currency,
          transaction.bankTransfer.id
        );

        transaction.formanceTransaction = formanceTransaction;
      }

      transaction.status = 'completed';
      transaction.completedAt = new Date();
      transaction.updatedAt = new Date();

      await this.eventService.emitTransactionEvent(
        'transaction_completed',
        transaction.userId,
        {
          transactionId: transaction.id,
          type: transaction.type,
          amount: transaction.amount.toString(),
          currency: transaction.currency,
          status: 'completed'
        },
        'high'
      );

      // Emit balance update event
      if (transaction.formanceTransaction) {
        await this.eventService.emitBalanceUpdate(
          transaction.userId,
          {
            accountId: 'user_account',
            currency: transaction.currency,
            change: transaction.type === 'deposit' ? transaction.amount : -transaction.amount,
            newBalance: 'updated' // This should be fetched from Formance
          }
        );
      }

      this.logger.info('Transaction completed successfully', {
        transactionId: transaction.id,
        type: transaction.type,
        userId: transaction.userId
      });
    } catch (error) {
      await this.failTransaction(transaction, `Failed to complete Formance transaction: ${(error as Error).message}`);
    }
  }

  private async failTransaction(transaction: TransferTransaction, reason: string): Promise<void> {
    transaction.status = 'failed';
    transaction.updatedAt = new Date();
    transaction.errorDetails = {
      stage: 'bank_transfer',
      message: reason,
      retryable: false
    };

    // If withdrawal, reverse the Formance transaction
    if (transaction.type === 'withdrawal' && transaction.formanceTransaction) {
      try {
        await this.reverseFormanceTransaction(transaction.formanceTransaction);
      } catch (error) {
        this.logger.error('Failed to reverse Formance transaction', error as Error, {
          transactionId: transaction.id,
          formanceTransactionId: transaction.formanceTransaction.id
        });
      }
    }

    await this.eventService.emitTransactionEvent(
      'transaction_failed',
      transaction.userId,
      {
        transactionId: transaction.id,
        type: transaction.type,
        status: 'failed',
        error: reason
      },
      'high'
    );

    this.logger.warn('Transaction failed', {
      transactionId: transaction.id,
      type: transaction.type,
      userId: transaction.userId,
      reason
    });
  }

  // ========== Formance Integration ==========

  private async createFormanceDepositTransaction(
    accountId: string,
    amount: bigint,
    currency: string,
    reference: string
  ): Promise<FormanceTransaction> {
    const transaction = await this.formanceService.createTransaction({
      reference,
      metadata: {
        type: 'deposit',
        source: 'bank_transfer'
      },
      postings: [
        {
          amount,
          asset: currency,
          source: '@bank:deposits',
          destination: accountId
        }
      ]
    });

    return transaction;
  }

  private async createFormanceWithdrawalTransaction(
    accountId: string,
    amount: bigint,
    currency: string,
    reference: string
  ): Promise<FormanceTransaction> {
    const transaction = await this.formanceService.createTransaction({
      reference,
      metadata: {
        type: 'withdrawal_reserve',
        source: 'bank_transfer'
      },
      postings: [
        {
          amount,
          asset: currency,
          source: accountId,
          destination: '@bank:withdrawals'
        }
      ]
    });

    return transaction;
  }

  private async reverseFormanceTransaction(transaction: FormanceTransaction): Promise<void> {
    // Get the first posting to reverse
    const originalPosting = transaction.postings[0];
    if (!originalPosting) {
      throw new Error('Transaction has no postings to reverse');
    }
    
    await this.formanceService.createTransaction({
      reference: `reverse_${transaction.reference}`,
      metadata: {
        type: 'reversal',
        originalTransaction: transaction.id.toString()
      },
      postings: [
        {
          amount: originalPosting.amount,
          asset: originalPosting.asset,
          source: originalPosting.destination, // Reverse source and destination
          destination: originalPosting.source
        }
      ]
    });
  }

  // ========== Public Interface ==========

  public getSystemMetrics(): {
    totalTransactions: number;
    pendingTransactions: number;
    completedTransactions: number;
    failedTransactions: number;
    totalDeposits: number;
    totalWithdrawals: number;
  } {
    const transactions = Array.from(this.transactions.values());

    return {
      totalTransactions: transactions.length,
      pendingTransactions: transactions.filter(t => ['pending', 'processing'].includes(t.status)).length,
      completedTransactions: transactions.filter(t => t.status === 'completed').length,
      failedTransactions: transactions.filter(t => t.status === 'failed').length,
      totalDeposits: transactions.filter(t => t.type === 'deposit').length,
      totalWithdrawals: transactions.filter(t => t.type === 'withdrawal').length
    };
  }

  public async shutdown(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.logger.info('Deposit/Withdrawal service shutdown completed');
  }
}