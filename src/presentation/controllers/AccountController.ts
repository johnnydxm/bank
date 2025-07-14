/**
 * @fileoverview Account Management Controller
 * @description Handles account operations including creation, balance queries, and multi-currency support
 * @version 1.0.0
 * @author DWAY Financial Platform Team
 * @since 2024-01-01
 * 
 * @module AccountController
 * @category Controllers
 * @subcategory Account Management
 * 
 * This controller provides comprehensive account management functionality including:
 * - Multi-currency account creation and management
 * - Real-time balance queries with Formance integration
 * - Account type management (checking, savings, investment)
 * - Balance history and transaction summaries
 * - Cross-currency conversion and reporting
 */

import { Request, Response } from 'express';
import { injectable, inject } from 'inversify';
import { ILogger } from '../../shared/interfaces/ILogger';
import { TYPES } from '../../infrastructure/ioc/types';
import { AccountService } from '../../domains/banking/services/AccountService';
import { MultiCurrencyAccountService } from '../../domains/currency/services/MultiCurrencyAccountService';
import { FormanceBankingService } from '../../domains/banking/services/FormanceBankingService';
import { z } from 'zod';

/**
 * @interface CreateAccountRequest
 * @description Request payload for creating a new account
 */
const CreateAccountSchema = z.object({
  name: z.string().min(1, 'Account name is required').max(100, 'Account name too long'),
  type: z.enum(['checking', 'savings', 'investment', 'crypto'], {
    errorMap: () => ({ message: 'Invalid account type' })
  }),
  currency: z.enum(['USD', 'EUR', 'GBP', 'JPY', 'BTC', 'ETH', 'USDC', 'USDT'], {
    errorMap: () => ({ message: 'Unsupported currency' })
  }),
  initialBalance: z.number().min(0, 'Initial balance cannot be negative').optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

/**
 * @interface AccountResponse
 * @description Standardized account response object
 */
export interface AccountResponse {
  id: string;
  userId: string;
  name: string;
  type: 'checking' | 'savings' | 'investment' | 'crypto';
  currency: string;
  balance: number;
  availableBalance: number;
  pendingBalance: number;
  status: 'active' | 'suspended' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  lastTransactionAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * @interface BalanceHistoryResponse
 * @description Account balance history with time-series data
 */
export interface BalanceHistoryResponse {
  accountId: string;
  currency: string;
  history: Array<{
    date: Date;
    balance: number;
    change: number;
    changePercent: number;
    transactionCount: number;
  }>;
  period: 'day' | 'week' | 'month' | 'year';
  summary: {
    startBalance: number;
    endBalance: number;
    totalChange: number;
    totalChangePercent: number;
    highestBalance: number;
    lowestBalance: number;
  };
}

/**
 * @class AccountController
 * @description Handles all account-related HTTP requests with multi-currency support
 * 
 * This controller integrates with Formance ledger for real-time balance tracking,
 * supports multiple currencies including cryptocurrencies, and provides comprehensive
 * account management functionality for the financial platform.
 * 
 * @example
 * ```typescript
 * // Usage in Express router
 * router.post('/accounts', accountController.createAccount.bind(accountController));
 * router.get('/accounts', accountController.getAccounts.bind(accountController));
 * router.get('/accounts/:id', accountController.getAccount.bind(accountController));
 * ```
 */
@injectable()
export class AccountController {

  /**
   * @constructor
   * @param logger - Application logger for audit trails
   * @param accountService - Core account business logic service
   * @param multiCurrencyService - Multi-currency account operations
   * @param formanceBankingService - Formance ledger integration
   */
  constructor(
    @inject(TYPES.Logger) private logger: ILogger,
    @inject(TYPES.AccountService) private accountService: AccountService,
    @inject(TYPES.MultiCurrencyAccountService) private multiCurrencyService: MultiCurrencyAccountService,
    @inject(TYPES.FormanceBankingService) private formanceBankingService: FormanceBankingService
  ) {
    this.logger.info('AccountController initialized', {
      component: 'AccountController',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * @method createAccount
   * @description Creates a new account for the authenticated user
   * 
   * @param req - Express request object containing account creation data
   * @param res - Express response object for sending creation result
   * 
   * @returns Promise<void> - HTTP response with new account data or error
   * 
   * @throws {400} - Invalid input data or validation errors
   * @throws {401} - User not authenticated
   * @throws {409} - Account with same name already exists
   * @throws {500} - Internal server error
   * 
   * @example
   * ```typescript
   * // POST /api/accounts
   * {
   *   "name": "Primary Checking",
   *   "type": "checking",
   *   "currency": "USD",
   *   "initialBalance": 1000.00,
   *   "metadata": {
   *     "description": "Main spending account"
   *   }
   * }
   * ```
   */
  public async createAccount(req: Request, res: Response): Promise<void> {
    const requestId = this.generateRequestId();
    const userId = (req as any).user?.id;

    try {
      this.logger.info('Account creation attempt started', {
        requestId,
        userId,
        accountData: req.body,
        timestamp: new Date().toISOString()
      });

      // Input validation
      const validationResult = CreateAccountSchema.safeParse(req.body);
      if (!validationResult.success) {
        this.logger.warn('Account creation failed - invalid input', {
          requestId,
          userId,
          errors: validationResult.error.errors
        });

        res.status(400).json({
          success: false,
          message: 'Invalid input data',
          errors: validationResult.error.errors,
          requestId
        });
        return;
      }

      const { name, type, currency, initialBalance = 0, metadata } = validationResult.data;

      // Check for duplicate account name
      const existingAccounts = await this.getAccountsByUserId(userId);
      const duplicateAccount = existingAccounts.find(acc => 
        acc.name.toLowerCase() === name.toLowerCase() && acc.currency === currency
      );

      if (duplicateAccount) {
        this.logger.warn('Account creation failed - duplicate name', {
          requestId,
          userId,
          accountName: name,
          currency
        });

        res.status(409).json({
          success: false,
          message: 'Account with this name and currency already exists',
          requestId
        });
        return;
      }

      // Create account in Formance ledger
      const formanceAccount = await this.formanceBankingService.createAccount({
        userId,
        name,
        type,
        currency,
        initialBalance,
        metadata: {
          ...metadata,
          accountType: type,
          createdBy: 'api',
          createdAt: new Date().toISOString()
        }
      });

      // Create local account record
      const newAccount = await this.createAccountRecord({
        id: formanceAccount.id,
        userId,
        name,
        type,
        currency,
        balance: initialBalance,
        metadata
      });

      this.logger.info('Account created successfully', {
        requestId,
        userId,
        accountId: newAccount.id,
        accountName: name,
        currency,
        initialBalance,
        timestamp: new Date().toISOString()
      });

      res.status(201).json({
        success: true,
        data: this.sanitizeAccount(newAccount),
        message: 'Account created successfully',
        requestId
      });

    } catch (error) {
      this.logger.error('Account creation error', error as Error, {
        requestId,
        userId,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        requestId
      });
    }
  }

  /**
   * @method getAccounts
   * @description Retrieves all accounts for the authenticated user
   * 
   * @param req - Express request object
   * @param res - Express response object
   * 
   * @returns Promise<void> - HTTP response with user's accounts or error
   * 
   * @throws {401} - User not authenticated
   * @throws {500} - Internal server error
   * 
   * @example
   * ```typescript
   * // GET /api/accounts?currency=USD&type=checking
   * ```
   */
  public async getAccounts(req: Request, res: Response): Promise<void> {
    const requestId = this.generateRequestId();
    const userId = (req as any).user?.id;

    try {
      this.logger.info('Retrieving user accounts', {
        requestId,
        userId,
        query: req.query,
        timestamp: new Date().toISOString()
      });

      // Get accounts from database
      let accounts = await this.getAccountsByUserId(userId);

      // Apply filters if provided
      const { currency, type, status } = req.query;
      
      if (currency) {
        accounts = accounts.filter(acc => acc.currency === currency);
      }
      
      if (type) {
        accounts = accounts.filter(acc => acc.type === type);
      }
      
      if (status) {
        accounts = accounts.filter(acc => acc.status === status);
      }

      // Get real-time balances from Formance
      const accountsWithBalances = await Promise.all(
        accounts.map(async (account) => {
          try {
            const balance = await this.formanceBankingService.getAccountBalance(account.id);
            return {
              ...account,
              balance: balance.current,
              availableBalance: balance.available,
              pendingBalance: balance.pending
            };
          } catch (error) {
            this.logger.warn('Failed to get real-time balance', {
              requestId,
              accountId: account.id,
              error: (error as Error).message
            });
            return account; // Return with cached balance
          }
        })
      );

      // Calculate total portfolio value in base currency (USD)
      const portfolioSummary = await this.calculatePortfolioSummary(accountsWithBalances);

      this.logger.info('User accounts retrieved successfully', {
        requestId,
        userId,
        accountCount: accountsWithBalances.length,
        totalValue: portfolioSummary.totalValueUSD,
        timestamp: new Date().toISOString()
      });

      res.status(200).json({
        success: true,
        data: {
          accounts: accountsWithBalances.map(acc => this.sanitizeAccount(acc)),
          summary: portfolioSummary
        },
        requestId
      });

    } catch (error) {
      this.logger.error('Get accounts error', error as Error, {
        requestId,
        userId,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        requestId
      });
    }
  }

  /**
   * @method getAccount
   * @description Retrieves detailed information for a specific account
   * 
   * @param req - Express request object with account ID parameter
   * @param res - Express response object
   * 
   * @returns Promise<void> - HTTP response with account details or error
   * 
   * @throws {400} - Invalid account ID format
   * @throws {401} - User not authenticated
   * @throws {403} - User doesn't own the account
   * @throws {404} - Account not found
   * @throws {500} - Internal server error
   */
  public async getAccount(req: Request, res: Response): Promise<void> {
    const requestId = this.generateRequestId();
    const userId = (req as any).user?.id;
    const accountId = req.params.id;

    try {
      this.logger.info('Retrieving specific account', {
        requestId,
        userId,
        accountId,
        timestamp: new Date().toISOString()
      });

      // Validate account ID format
      if (!accountId || accountId.length < 1) {
        res.status(400).json({
          success: false,
          message: 'Invalid account ID',
          requestId
        });
        return;
      }

      // Get account from database
      const account = await this.getAccountById(accountId);

      if (!account) {
        this.logger.warn('Account not found', {
          requestId,
          userId,
          accountId
        });

        res.status(404).json({
          success: false,
          message: 'Account not found',
          requestId
        });
        return;
      }

      // Verify ownership
      if (account.userId !== userId) {
        this.logger.warn('Unauthorized account access attempt', {
          requestId,
          userId,
          accountId,
          accountOwnerId: account.userId
        });

        res.status(403).json({
          success: false,
          message: 'Access denied',
          requestId
        });
        return;
      }

      // Get real-time balance and transaction summary
      const [balance, transactionSummary] = await Promise.all([
        this.formanceBankingService.getAccountBalance(accountId),
        this.getAccountTransactionSummary(accountId)
      ]);

      const detailedAccount = {
        ...account,
        balance: balance.current,
        availableBalance: balance.available,
        pendingBalance: balance.pending,
        transactionSummary
      };

      this.logger.info('Account retrieved successfully', {
        requestId,
        userId,
        accountId,
        balance: balance.current,
        timestamp: new Date().toISOString()
      });

      res.status(200).json({
        success: true,
        data: this.sanitizeAccount(detailedAccount),
        requestId
      });

    } catch (error) {
      this.logger.error('Get account error', error as Error, {
        requestId,
        userId,
        accountId,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        requestId
      });
    }
  }

  /**
   * @method getAccountHistory
   * @description Retrieves balance history for an account
   * 
   * @param req - Express request object with account ID and query parameters
   * @param res - Express response object
   * 
   * @returns Promise<void> - HTTP response with balance history or error
   */
  public async getAccountHistory(req: Request, res: Response): Promise<void> {
    const requestId = this.generateRequestId();
    const userId = (req as any).user?.id;
    const accountId = req.params.id;
    const { period = 'month', days = 30 } = req.query;

    try {
      this.logger.info('Retrieving account history', {
        requestId,
        userId,
        accountId,
        period,
        days,
        timestamp: new Date().toISOString()
      });

      // Verify account ownership
      const account = await this.getAccountById(accountId);
      if (!account || account.userId !== userId) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
          requestId
        });
        return;
      }

      // Get balance history from Formance
      const history = await this.formanceBankingService.getAccountHistory(
        accountId, 
        String(period) as 'day' | 'week' | 'month' | 'year',
        Number(days)
      );

      const historyResponse: BalanceHistoryResponse = {
        accountId,
        currency: account.currency,
        history: history.entries,
        period: String(period) as 'day' | 'week' | 'month' | 'year',
        summary: history.summary
      };

      this.logger.info('Account history retrieved successfully', {
        requestId,
        userId,
        accountId,
        entryCount: history.entries.length,
        timestamp: new Date().toISOString()
      });

      res.status(200).json({
        success: true,
        data: historyResponse,
        requestId
      });

    } catch (error) {
      this.logger.error('Get account history error', error as Error, {
        requestId,
        userId,
        accountId,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        requestId
      });
    }
  }

  /**
   * @private
   * @method getAccountsByUserId
   * @description Retrieves all accounts for a specific user
   * 
   * @param userId - User identifier
   * @returns Promise<any[]> - Array of user accounts
   */
  private async getAccountsByUserId(userId: string): Promise<any[]> {
    // TODO: Replace with actual database query
    // Mock implementation for development
    return [
      {
        id: 'acc_123',
        userId,
        name: 'Primary Checking',
        type: 'checking',
        currency: 'USD',
        balance: 5000.00,
        availableBalance: 4800.00,
        pendingBalance: 200.00,
        status: 'active',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
        lastTransactionAt: new Date()
      }
    ];
  }

  /**
   * @private
   * @method getAccountById
   * @description Retrieves a specific account by ID
   * 
   * @param accountId - Account identifier
   * @returns Promise<any | null> - Account data or null if not found
   */
  private async getAccountById(accountId: string): Promise<any | null> {
    // TODO: Replace with actual database query
    return {
      id: accountId,
      userId: 'user_123',
      name: 'Primary Checking',
      type: 'checking',
      currency: 'USD',
      balance: 5000.00,
      status: 'active',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date()
    };
  }

  /**
   * @private
   * @method createAccountRecord
   * @description Creates a new account record in the database
   * 
   * @param accountData - Account creation data
   * @returns Promise<any> - Created account data
   */
  private async createAccountRecord(accountData: any): Promise<any> {
    // TODO: Replace with actual database insertion
    return {
      ...accountData,
      status: 'active',
      availableBalance: accountData.balance,
      pendingBalance: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * @private
   * @method getAccountTransactionSummary
   * @description Gets transaction summary for an account
   * 
   * @param accountId - Account identifier
   * @returns Promise<any> - Transaction summary data
   */
  private async getAccountTransactionSummary(accountId: string): Promise<any> {
    // TODO: Replace with actual Formance query
    return {
      totalTransactions: 42,
      thisMonth: {
        transactions: 15,
        deposits: 3200.00,
        withdrawals: 1800.00,
        netChange: 1400.00
      },
      lastTransaction: new Date()
    };
  }

  /**
   * @private
   * @method calculatePortfolioSummary
   * @description Calculates portfolio summary across all accounts
   * 
   * @param accounts - Array of user accounts
   * @returns Promise<any> - Portfolio summary data
   */
  private async calculatePortfolioSummary(accounts: any[]): Promise<any> {
    // TODO: Implement actual currency conversion
    const totalValueUSD = accounts.reduce((sum, acc) => {
      // Mock conversion rates for demonstration
      const conversionRates: Record<string, number> = {
        'USD': 1,
        'EUR': 1.1,
        'GBP': 1.25,
        'JPY': 0.007,
        'BTC': 45000,
        'ETH': 3000,
        'USDC': 1,
        'USDT': 1
      };
      
      return sum + (acc.balance * (conversionRates[acc.currency] || 1));
    }, 0);

    return {
      totalValueUSD,
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter(acc => acc.status === 'active').length,
      currencyBreakdown: this.groupAccountsByCurrency(accounts)
    };
  }

  /**
   * @private
   * @method groupAccountsByCurrency
   * @description Groups accounts by currency for summary
   * 
   * @param accounts - Array of accounts
   * @returns Record<string, any> - Grouped account data
   */
  private groupAccountsByCurrency(accounts: any[]): Record<string, any> {
    return accounts.reduce((groups, account) => {
      const currency = account.currency;
      if (!groups[currency]) {
        groups[currency] = {
          count: 0,
          totalBalance: 0,
          accounts: []
        };
      }
      
      groups[currency].count++;
      groups[currency].totalBalance += account.balance;
      groups[currency].accounts.push({
        id: account.id,
        name: account.name,
        balance: account.balance
      });
      
      return groups;
    }, {} as Record<string, any>);
  }

  /**
   * @private
   * @method sanitizeAccount
   * @description Removes sensitive data from account object
   * 
   * @param account - Raw account data
   * @returns AccountResponse - Sanitized account data
   */
  private sanitizeAccount(account: any): AccountResponse {
    return {
      id: account.id,
      userId: account.userId,
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: account.balance,
      availableBalance: account.availableBalance,
      pendingBalance: account.pendingBalance,
      status: account.status,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      lastTransactionAt: account.lastTransactionAt,
      metadata: account.metadata
    };
  }

  /**
   * @private
   * @method generateRequestId
   * @description Generates unique request identifier for tracking
   * 
   * @returns string - Unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}