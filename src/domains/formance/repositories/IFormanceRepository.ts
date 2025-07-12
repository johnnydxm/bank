import { FormanceAccount, CreateAccountRequest, AccountFilter } from '../entities/FormanceAccount';
import { FormanceTransaction, TransactionRequest, TransactionFilter } from '../entities/FormanceTransaction';

export interface Balance {
  asset: string;
  amount: bigint;
}

export interface AggregatedBalance {
  balances: Record<string, bigint>;
  total_accounts: number;
}

export interface IFormanceAccountRepository {
  // Account Management
  createAccount(request: CreateAccountRequest): Promise<FormanceAccount>;
  getAccount(address: string): Promise<FormanceAccount | null>;
  listAccounts(filter?: AccountFilter): Promise<FormanceAccount[]>;
  updateAccountMetadata(address: string, metadata: Record<string, any>): Promise<void>;
  deleteAccount(address: string): Promise<void>;
  
  // Balance Management
  getAccountBalance(address: string): Promise<Balance[]>;
  getAccountBalanceForAsset(address: string, asset: string): Promise<Balance | null>;
  getAggregatedBalances(addressPattern: string): Promise<AggregatedBalance>;
  
  // Account Validation
  accountExists(address: string): Promise<boolean>;
  validateAccountStructure(address: string): boolean;
}

export interface IFormanceTransactionRepository {
  // Transaction Management
  createTransaction(request: TransactionRequest): Promise<FormanceTransaction>;
  getTransaction(id: bigint): Promise<FormanceTransaction | null>;
  getTransactionByReference(reference: string): Promise<FormanceTransaction | null>;
  listTransactions(filter?: TransactionFilter): Promise<FormanceTransaction[]>;
  
  // Transaction Operations
  revertTransaction(id: bigint): Promise<FormanceTransaction>;
  dryRunTransaction(request: TransactionRequest): Promise<{valid: boolean; errors?: string[]}>;
  
  // Transaction Queries
  getTransactionsForAccount(address: string, filter?: TransactionFilter): Promise<FormanceTransaction[]>;
  getTransactionsByMetadata(metadata: Record<string, any>): Promise<FormanceTransaction[]>;
  getTransactionVolumes(address: string, asset?: string): Promise<{input: bigint; output: bigint}>;
  
  // Transaction Validation
  validateTransaction(request: TransactionRequest): Promise<{valid: boolean; errors: string[]}>;
}

export interface IFormanceLedgerRepository {
  // Ledger Management
  createLedger(name: string, metadata?: Record<string, any>): Promise<void>;
  getLedgerInfo(ledger: string): Promise<{name: string; metadata: Record<string, any>}>;
  listLedgers(): Promise<string[]>;
  deleteLedger(name: string): Promise<void>;
  
  // Ledger Statistics
  getLedgerStats(ledger: string): Promise<{
    accounts: number;
    transactions: number;
    assets: string[];
    volume: Record<string, bigint>;
  }>;
  
  // Bulk Operations
  bulkCreateAccounts(ledger: string, accounts: CreateAccountRequest[]): Promise<FormanceAccount[]>;
  bulkCreateTransactions(ledger: string, transactions: TransactionRequest[]): Promise<FormanceTransaction[]>;
}

export interface FormanceConfig {
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  defaultLedger: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export interface IFormanceClientRepository {
  // Client Management
  initialize(config: FormanceConfig): Promise<void>;
  isConnected(): Promise<boolean>;
  getHealthStatus(): Promise<{status: 'healthy' | 'unhealthy'; details: Record<string, any>}>;
  disconnect(): Promise<void>;
  
  // Configuration
  getConfig(): FormanceConfig;
  updateConfig(config: Partial<FormanceConfig>): Promise<void>;
  
  // Authentication
  refreshToken(): Promise<void>;
  validateToken(): Promise<boolean>;
}

export interface FormanceError {
  code: string;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
}

export interface FormanceOperationResult<T> {
  success: boolean;
  data?: T;
  error?: FormanceError;
  metadata?: {
    request_id: string;
    duration_ms: number;
    retry_count?: number;
  };
}