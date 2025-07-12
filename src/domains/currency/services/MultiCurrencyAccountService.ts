import { injectable, inject } from 'inversify';
import { ILogger } from '../../../shared/interfaces/ILogger';
import { TYPES } from '../../../infrastructure/ioc/types';
import { FormanceLedgerService } from '../../../infrastructure/formance/FormanceLedgerService';
import { ExchangeRateService } from '../../../infrastructure/currency/ExchangeRateService';
import { CurrencyValidationService } from '../../../infrastructure/currency/CurrencyValidationService';
import { 
  AccountStructure, 
  CreateAccountRequest, 
  FormanceAccountMetadata 
} from '../../formance/entities/FormanceAccount';
import { 
  FormanceTransactionTemplates,
  TransactionRequest 
} from '../../formance/entities/FormanceTransaction';
import { SupportedCurrencies, SupportedCurrencyCode } from '../entities/Currency';

export interface MultiCurrencyBalance {
  currency: string;
  balance: bigint;
  formattedBalance: string;
  usdEquivalent?: bigint | undefined;
  lastUpdated: Date;
}

export interface CurrencyConversionRequest {
  userId: string;
  fromCurrency: string;
  toCurrency: string;
  amount: bigint;
  maxSlippage?: number | undefined; // percentage, e.g., 0.5 for 0.5%
  useSpread?: boolean | undefined;
}

export interface CurrencyConversionResult {
  transactionId: string;
  fromCurrency: string;
  toCurrency: string;
  originalAmount: bigint;
  convertedAmount: bigint;
  exchangeRate: number;
  fees: bigint;
  slippage: number;
  timestamp: Date;
}

export interface MultiCurrencyPortfolio {
  userId: string;
  balances: MultiCurrencyBalance[];
  totalUsdValue: bigint;
  lastUpdated: Date;
  supportedCurrencies: string[];
}

@injectable()
export class MultiCurrencyAccountService {
  constructor(
    @inject(TYPES.FormanceLedgerService) private formanceLedger: FormanceLedgerService,
    @inject(TYPES.ExchangeRateService) private exchangeRateService: ExchangeRateService,
    @inject(TYPES.CurrencyValidationService) private currencyValidation: CurrencyValidationService,
    @inject(TYPES.Logger) private logger: ILogger
  ) {}

  // ========== Multi-Currency Account Creation ==========

  public async createMultiCurrencyWallet(
    userId: string,
    currencies: string[],
    initialMetadata?: Record<string, any> | undefined
  ): Promise<{ accounts: string[]; currencies: string[] }> {
    this.logger.info('Creating multi-currency wallet', {
      userId,
      currencies: currencies.length,
      requestedCurrencies: currencies
    });

    const createdAccounts: string[] = [];
    const supportedCurrencies: string[] = [];

    for (const currency of currencies) {
      // Validate currency
      const currencyValidation = this.currencyValidation.validateCurrencyCode(currency);
      if (!currencyValidation.valid) {
        this.logger.warn(`Skipping unsupported currency: ${currency}`, {
          errors: currencyValidation.errors
        });
        continue;
      }

      try {
        const accountAddress = this.getCurrencyAccountAddress(userId, currency);
        
        // Check if account already exists
        const existingAccount = await this.formanceLedger.getAccount(accountAddress);
        if (existingAccount) {
          this.logger.info(`Account already exists for ${currency}`, { accountAddress });
          createdAccounts.push(accountAddress);
          supportedCurrencies.push(currency);
          continue;
        }

        // Create currency-specific account
        const metadata: FormanceAccountMetadata = {
          user_id: userId,
          account_type: 'multi_currency_wallet',
          created_at: new Date().toISOString(),
          kyc_status: 'pending',
          compliance_level: 'basic',
          ...initialMetadata
        } as FormanceAccountMetadata;

        const createRequest: CreateAccountRequest = {
          address: accountAddress,
          type: 'user',
          metadata
        };

        await this.formanceLedger.createAccount(createRequest);
        createdAccounts.push(accountAddress);
        supportedCurrencies.push(currency);

        this.logger.info(`Created ${currency} account`, { accountAddress });
        
      } catch (error) {
        this.logger.error(`Failed to create ${currency} account for user ${userId}`, {
          error: (error as Error).message
        });
      }
    }

    return {
      accounts: createdAccounts,
      currencies: supportedCurrencies
    };
  }

  public async addCurrencyToWallet(
    userId: string,
    currency: string,
    initialMetadata?: Record<string, any> | undefined
  ): Promise<string> {
    this.logger.info('Adding currency to wallet', { userId, currency });

    // Validate currency
    const validation = this.currencyValidation.validateCurrencyCode(currency);
    if (!validation.valid) {
      throw new Error(`Invalid currency: ${validation.errors.join(', ')}`);
    }

    const accountAddress = this.getCurrencyAccountAddress(userId, currency);
    
    // Check if account already exists
    const existingAccount = await this.formanceLedger.getAccount(accountAddress);
    if (existingAccount) {
      throw new Error(`User already has a ${currency} account`);
    }

    const metadata: FormanceAccountMetadata = {
      user_id: userId,
      account_type: 'multi_currency_wallet',
      created_at: new Date().toISOString(),
      kyc_status: 'pending',
      compliance_level: 'basic',
      ...initialMetadata
    } as FormanceAccountMetadata;

    const createRequest: CreateAccountRequest = {
      address: accountAddress,
      type: 'user',
      metadata
    };

    await this.formanceLedger.createAccount(createRequest);
    return accountAddress;
  }

  // ========== Balance Management ==========

  public async getMultiCurrencyBalance(userId: string): Promise<MultiCurrencyPortfolio> {
    this.logger.info('Getting multi-currency balance', { userId });

    const balances: MultiCurrencyBalance[] = [];
    let totalUsdValue = BigInt(0);

    // Get all supported currencies
    const supportedCurrencies = Object.keys(SupportedCurrencies);

    for (const currency of supportedCurrencies) {
      try {
        const balance = await this.getCurrencyBalance(userId, currency);
        if (balance.balance > BigInt(0)) {
          balances.push(balance);
          totalUsdValue += balance.usdEquivalent || BigInt(0);
        }
      } catch (error) {
        this.logger.debug(`No balance found for ${currency}`, {
          userId,
          error: (error as Error).message
        });
      }
    }

    return {
      userId,
      balances,
      totalUsdValue,
      lastUpdated: new Date(),
      supportedCurrencies
    };
  }

  public async getCurrencyBalance(userId: string, currency: string): Promise<MultiCurrencyBalance> {
    const accountAddress = this.getCurrencyAccountAddress(userId, currency);
    const balances = await this.formanceLedger.getAccountBalance(accountAddress);
    
    const currencyBalance = balances.find(b => b.asset === currency);
    const balance = currencyBalance?.amount || BigInt(0);

    // Format balance using currency entity
    const currencyEntity = SupportedCurrencies[currency as SupportedCurrencyCode];
    const formattedBalance = currencyEntity 
      ? currencyEntity.formatAmount(balance)
      : `${balance.toString()} ${currency}`;

    // Calculate USD equivalent
    let usdEquivalent: bigint | undefined;
    try {
      if (currency !== 'USD') {
        const conversion = await this.exchangeRateService.convert(balance, currency, 'USD');
        usdEquivalent = conversion.convertedAmount;
      } else {
        usdEquivalent = balance;
      }
    } catch (error) {
      this.logger.warn(`Failed to calculate USD equivalent for ${currency}`, {
        error: (error as Error).message
      });
    }

    return {
      currency,
      balance,
      formattedBalance,
      usdEquivalent,
      lastUpdated: new Date()
    };
  }

  // ========== Currency Conversion ==========

  public async convertCurrency(request: CurrencyConversionRequest): Promise<CurrencyConversionResult> {
    this.logger.info('Converting currency', {
      userId: request.userId,
      fromCurrency: request.fromCurrency,
      toCurrency: request.toCurrency,
      amount: request.amount.toString()
    });

    // Validate the conversion request
    const validation = await this.currencyValidation.validateCurrencyTransaction(
      request.fromCurrency,
      request.toCurrency,
      request.amount
    );

    if (!validation.valid) {
      throw new Error(`Conversion validation failed: ${validation.errors.join(', ')}`);
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      this.logger.warn('Currency conversion warnings', {
        warnings: validation.warnings
      });
    }

    // Check sufficient balance
    const fromBalance = await this.getCurrencyBalance(request.userId, request.fromCurrency);
    if (fromBalance.balance < request.amount) {
      throw new Error(
        `Insufficient ${request.fromCurrency} balance. ` +
        `Required: ${request.amount}, Available: ${fromBalance.balance}`
      );
    }

    // Get exchange rate and calculate conversion
    const conversion = await this.exchangeRateService.convert(
      request.amount,
      request.fromCurrency,
      request.toCurrency,
      {
        useSpread: request.useSpread,
        maxRateAge: 5 // 5 minutes for conversions
      }
    );

    // Check slippage if specified
    if (request.maxSlippage) {
      const expectedRate = await this.exchangeRateService.calculateCrossRate(
        request.fromCurrency,
        request.toCurrency
      );
      
      if (expectedRate) {
        const slippage = Math.abs((conversion.exchangeRate - expectedRate) / expectedRate) * 100;
        if (slippage > request.maxSlippage) {
          throw new Error(`Slippage ${slippage.toFixed(2)}% exceeds maximum allowed ${request.maxSlippage}%`);
        }
      }
    }

    // Create Formance transaction for the conversion
    const transactionRequest = this.createCurrencyConversionTransaction(
      request.userId,
      request.fromCurrency,
      request.toCurrency,
      request.amount,
      conversion.convertedAmount,
      conversion.exchangeRate,
      conversion.fees || BigInt(0)
    );

    const transaction = await this.formanceLedger.createTransaction(transactionRequest);

    const result: CurrencyConversionResult = {
      transactionId: transaction.id?.toString() || transaction.txid?.toString() || 'unknown',
      fromCurrency: request.fromCurrency,
      toCurrency: request.toCurrency,
      originalAmount: request.amount,
      convertedAmount: conversion.convertedAmount,
      exchangeRate: conversion.exchangeRate,
      fees: conversion.fees || BigInt(0),
      slippage: 0, // Calculate actual slippage
      timestamp: new Date()
    };

    this.logger.info('Currency conversion completed', result);
    return result;
  }

  public async batchConvertToTargetCurrency(
    userId: string,
    targetCurrency: string,
    excludeCurrencies: string[] = []
  ): Promise<CurrencyConversionResult[]> {
    this.logger.info('Batch converting to target currency', {
      userId,
      targetCurrency,
      excludeCurrencies
    });

    const portfolio = await this.getMultiCurrencyBalance(userId);
    const conversions: CurrencyConversionResult[] = [];

    for (const balance of portfolio.balances) {
      if (balance.currency === targetCurrency || excludeCurrencies.includes(balance.currency)) {
        continue;
      }

      if (balance.balance <= BigInt(0)) {
        continue;
      }

      try {
        const conversion = await this.convertCurrency({
          userId,
          fromCurrency: balance.currency,
          toCurrency: targetCurrency,
          amount: balance.balance,
          useSpread: true,
          maxSlippage: 2.0 // 2% max slippage for batch conversions
        });

        conversions.push(conversion);
      } catch (error) {
        this.logger.error(`Failed to convert ${balance.currency} to ${targetCurrency}`, {
          error: (error as Error).message
        });
      }
    }

    return conversions;
  }

  // ========== Multi-Currency Transactions ==========

  public async transferMultiCurrency(
    fromUserId: string,
    toUserId: string,
    currency: string,
    amount: bigint,
    description: string
  ): Promise<string> {
    this.logger.info('Multi-currency transfer', {
      fromUserId,
      toUserId,
      currency,
      amount: amount.toString()
    });

    // Validate transaction
    const validation = await this.currencyValidation.validateAmount(amount, currency);
    if (!validation.valid) {
      throw new Error(`Invalid amount: ${validation.errors.join(', ')}`);
    }

    // Check sufficient balance
    const fromBalance = await this.getCurrencyBalance(fromUserId, currency);
    if (fromBalance.balance < amount) {
      throw new Error(`Insufficient balance`);
    }

    // Ensure recipient has currency account
    try {
      await this.addCurrencyToWallet(toUserId, currency);
    } catch (error) {
      // Account might already exist, that's fine
      this.logger.debug('Recipient account creation skipped', {
        error: (error as Error).message
      });
    }

    // Create transfer transaction
    const fromAccount = this.getCurrencyAccountAddress(fromUserId, currency);
    const toAccount = this.getCurrencyAccountAddress(toUserId, currency);

    const transactionRequest: TransactionRequest = {
      postings: [{
        source: fromAccount,
        destination: toAccount,
        amount: amount,
        asset: currency
      }],
      metadata: {
        type: 'multi_currency_transfer',
        description,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        currency,
        created_by: 'multi_currency_account_service'
      },
      reference: `mc_transfer_${Date.now()}`
    };

    const transaction = await this.formanceLedger.createTransaction(transactionRequest);
    return transaction.id?.toString() || transaction.txid?.toString() || 'unknown';
  }

  // ========== Account Management Utilities ==========

  public async listUserCurrencies(userId: string): Promise<string[]> {
    const portfolio = await this.getMultiCurrencyBalance(userId);
    return portfolio.balances.map(b => b.currency);
  }

  public async getCurrencyAccountAddress(userId: string, currency: string): string {
    // Use specific currency account structure
    return `users:${userId}:wallet:${currency.toLowerCase()}`;
  }

  public async deactivateCurrency(userId: string, currency: string): Promise<void> {
    this.logger.info('Deactivating currency for user', { userId, currency });

    const accountAddress = this.getCurrencyAccountAddress(userId, currency);
    
    // Check if there's a remaining balance
    const balance = await this.getCurrencyBalance(userId, currency);
    if (balance.balance > BigInt(0)) {
      throw new Error(`Cannot deactivate ${currency} account with remaining balance: ${balance.formattedBalance}`);
    }

    // Mark account as deactivated
    await this.formanceLedger.updateAccountMetadata(accountAddress, {
      deactivated: true,
      deactivated_at: new Date().toISOString()
    });
  }

  public async getPortfolioSummary(userId: string): Promise<{
    totalValue: string;
    currencyCount: number;
    largestHolding: { currency: string; percentage: number };
    riskScore: number;
  }> {
    const portfolio = await this.getMultiCurrencyBalance(userId);
    
    if (portfolio.balances.length === 0) {
      return {
        totalValue: '0.00 USD',
        currencyCount: 0,
        largestHolding: { currency: 'N/A', percentage: 0 },
        riskScore: 0
      };
    }

    // Find largest holding
    let largestValue = BigInt(0);
    let largestCurrency = '';
    
    for (const balance of portfolio.balances) {
      if ((balance.usdEquivalent || BigInt(0)) > largestValue) {
        largestValue = balance.usdEquivalent || BigInt(0);
        largestCurrency = balance.currency;
      }
    }

    const largestPercentage = portfolio.totalUsdValue > BigInt(0) 
      ? Number(largestValue * BigInt(100) / portfolio.totalUsdValue)
      : 0;

    // Calculate risk score based on diversification and crypto exposure
    const cryptoBalances = portfolio.balances.filter(b => {
      const currency = SupportedCurrencies[b.currency as SupportedCurrencyCode];
      return currency?.isCrypto() && !currency?.isStableCoin();
    });
    
    const cryptoPercentage = cryptoBalances.reduce(
      (sum, b) => sum + Number((b.usdEquivalent || BigInt(0)) * BigInt(100) / portfolio.totalUsdValue),
      0
    );

    const diversificationScore = Math.min(portfolio.balances.length * 10, 50); // Max 50 for diversification
    const cryptoRisk = Math.min(cryptoPercentage, 50); // Max 50 for crypto exposure
    const riskScore = Math.max(0, Math.min(100, diversificationScore + cryptoRisk));

    // Format total value
    const usdEntity = SupportedCurrencies.USD;
    const totalValue = usdEntity.formatAmount(portfolio.totalUsdValue);

    return {
      totalValue,
      currencyCount: portfolio.balances.length,
      largestHolding: {
        currency: largestCurrency,
        percentage: largestPercentage
      },
      riskScore
    };
  }

  // ========== Private Helper Methods ==========

  private createCurrencyConversionTransaction(
    userId: string,
    fromCurrency: string,
    toCurrency: string,
    fromAmount: bigint,
    toAmount: bigint,
    exchangeRate: number,
    fees: bigint
  ): TransactionRequest {
    const fromAccount = this.getCurrencyAccountAddress(userId, fromCurrency);
    const toAccount = this.getCurrencyAccountAddress(userId, toCurrency);
    const feeAccount = AccountStructure.fees('currency_conversion');

    const postings: any[] = [
      {
        source: fromAccount,
        destination: toAccount,
        amount: fromAmount,
        asset: fromCurrency
      },
      {
        source: toAccount,
        destination: fromAccount,
        amount: toAmount,
        asset: toCurrency
      }
    ];

    // Add fee posting if there are fees
    if (fees > BigInt(0)) {
      postings.push({
        source: fromAccount,
        destination: feeAccount,
        amount: fees,
        asset: fromCurrency
      });
    }

    return {
      postings,
      metadata: {
        type: 'currency_conversion',
        user_id: userId,
        from_currency: fromCurrency,
        to_currency: toCurrency,
        exchange_rate: exchangeRate.toString(),
        conversion_fees: fees.toString(),
        created_by: 'multi_currency_account_service'
      },
      reference: `conversion_${userId}_${Date.now()}`
    };
  }
}