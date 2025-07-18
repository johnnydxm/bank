import { injectable, inject } from 'inversify';
import { 
  IFormanceAccountRepository, 
  IFormanceTransactionRepository,
  IFormanceLedgerRepository,
  Balance,
  AggregatedBalance,
  FormanceOperationResult
} from '../../domains/formance/repositories/IFormanceRepository';
import { 
  FormanceAccount,
  FormanceAccountEntity, 
  CreateAccountRequest, 
  AccountFilter,
  AccountStructure,
  FormanceAccountMetadata
} from '../../domains/formance/entities/FormanceAccount';
import { 
  FormanceTransaction,
  FormanceTransactionEntity, 
  TransactionRequest, 
  TransactionFilter,
  FormanceTransactionMetadata
} from '../../domains/formance/entities/FormanceTransaction';
import { FormanceClientService } from './FormanceClientService';
import { ILogger } from '../../shared/interfaces/ILogger';
import { TYPES } from '../ioc/types';

@injectable()
export class FormanceLedgerService implements 
  IFormanceAccountRepository, 
  IFormanceTransactionRepository, 
  IFormanceLedgerRepository {

  constructor(
    @inject(TYPES.FormanceClientService) private clientService: FormanceClientService,
    @inject(TYPES.Logger) private logger: ILogger
  ) {}

  // ========== Account Management ==========

  public async createAccount(request: CreateAccountRequest): Promise<FormanceAccount> {
    this.logger.info('Creating Formance account', { address: request.address, type: request.type });

    const result = await this.clientService.withRetry(async () => {
      const sdk = this.clientService.getSDK();
      const config = this.clientService.getConfig();

      // In Formance, accounts are created implicitly when first used in transactions
      // We'll add metadata to mark the account as explicitly created
      await sdk.ledger.v2.addMetadataToAccount({
        ledger: config.defaultLedger,
        address: request.address,
        requestBody: {
          ...this.convertMetadataToStringRecord(request.metadata),
          explicitly_created: 'true',
          created_at: new Date().toISOString()
        }
      });

      // Return the created account
      return new FormanceAccountEntity(request.address, request.type, request.metadata);
    }, `createAccount:${request.address}`);

    if (!result.success) {
      throw new Error(`Failed to create account: ${result.error?.message}`);
    }

    return result.data!;
  }

  public async getAccount(address: string): Promise<FormanceAccount | null> {
    const result = await this.clientService.withRetry(async () => {
      const sdk = this.clientService.getSDK();
      const config = this.clientService.getConfig();

      try {
        const response = await sdk.ledger.v2.getAccount({
          ledger: config.defaultLedger,
          address
        });

        if (!response.v2AccountResponse?.data) {
          return null;
        }

        const accountData = response.v2AccountResponse.data;
        
        // Determine account type from address structure
        const accountType = this.determineAccountType(address);
        
        return new FormanceAccountEntity(
          address,
          accountType,
          this.convertToFormanceAccountMetadata(accountData.metadata || {}),
          this.convertVolumeMapToBigint(accountData.effectiveVolumes || {}),
          this.convertVolumesToBalances(accountData.effectiveVolumes || {})
        );
      } catch (error) {
        if ((error as any)?.statusCode === 404) {
          return null;
        }
        throw error;
      }
    }, `getAccount:${address}`);

    if (!result.success) {
      throw new Error(`Failed to get account: ${result.error?.message}`);
    }

    return result.data!;
  }

  public async listAccounts(filter?: AccountFilter): Promise<FormanceAccount[]> {
    const result = await this.clientService.withRetry(async () => {
      const sdk = this.clientService.getSDK();
      const config = this.clientService.getConfig();

      const response = await sdk.ledger.v2.listAccounts({
        ledger: config.defaultLedger,
        pageSize: Number(filter?.limit || 100),
        cursor: filter?.offset ? String(filter.offset) : undefined,
        query: this.buildQueryFilter(filter)
      });

      const accounts: FormanceAccount[] = [];
      
      if (response.v2AccountsCursorResponse?.cursor?.data) {
        for (const accountData of response.v2AccountsCursorResponse.cursor.data) {
          const accountType = this.determineAccountType(accountData.address);
          
          accounts.push(new FormanceAccountEntity(
            accountData.address,
            accountType,
            this.convertToFormanceAccountMetadata(accountData.metadata || {}),
            this.convertVolumeMapToBigint(accountData.effectiveVolumes || {}),
            this.convertVolumesToBalances(accountData.effectiveVolumes || {})
          ));
        }
      }

      return accounts;
    }, 'listAccounts');

    if (!result.success) {
      throw new Error(`Failed to list accounts: ${result.error?.message}`);
    }

    return result.data!;
  }

  public async updateAccountMetadata(address: string, metadata: Record<string, any>): Promise<void> {
    const result = await this.clientService.withRetry(async () => {
      const sdk = this.clientService.getSDK();
      const config = this.clientService.getConfig();

      await sdk.ledger.v2.addMetadataToAccount({
        ledger: config.defaultLedger,
        address,
        requestBody: {
          ...this.convertMetadataToStringRecord(metadata),
          updated_at: new Date().toISOString()
        }
      });
    }, `updateAccountMetadata:${address}`);

    if (!result.success) {
      throw new Error(`Failed to update account metadata: ${result.error?.message}`);
    }
  }

  public async deleteAccount(address: string): Promise<void> {
    // Formance doesn't support account deletion
    // We'll mark the account as deleted in metadata
    await this.updateAccountMetadata(address, {
      deleted: true,
      deleted_at: new Date().toISOString()
    });
  }

  public async getAccountBalance(address: string): Promise<Balance[]> {
    const result = await this.clientService.withRetry(async () => {
      const sdk = this.clientService.getSDK();
      const config = this.clientService.getConfig();

      const response = await sdk.ledger.v2.getBalancesAggregated({
        ledger: config.defaultLedger
      });

      const balances: Balance[] = [];
      
      if (response.v2AggregateBalancesResponse?.data) {
        for (const [asset, amount] of Object.entries(response.v2AggregateBalancesResponse.data)) {
          balances.push({
            asset,
            amount: BigInt(String(amount))
          });
        }
      }

      return balances;
    }, `getAccountBalance:${address}`);

    if (!result.success) {
      throw new Error(`Failed to get account balance: ${result.error?.message}`);
    }

    return result.data!;
  }

  public async getAccountBalanceForAsset(address: string, asset: string): Promise<Balance | null> {
    const balances = await this.getAccountBalance(address);
    const balance = balances.find(b => b.asset === asset);
    return balance || null;
  }

  public async getAggregatedBalances(addressPattern: string): Promise<AggregatedBalance> {
    const result = await this.clientService.withRetry(async () => {
      const sdk = this.clientService.getSDK();
      const config = this.clientService.getConfig();

      const response = await sdk.ledger.v2.getBalancesAggregated({
        ledger: config.defaultLedger
      });

      const aggregatedBalances: Record<string, bigint> = {};
      let totalAccounts = 0;

      if (response.v2AggregateBalancesResponse?.data) {
        for (const [asset, amount] of Object.entries(response.v2AggregateBalancesResponse.data)) {
          aggregatedBalances[asset] = BigInt(amount);
        }
      }

      // Get account count by listing accounts with pattern
      const accountsResponse = await sdk.ledger.v2.listAccounts({
        ledger: config.defaultLedger,
        pageSize: 1000 // Large number to get count
      });

      totalAccounts = accountsResponse.v2AccountsCursorResponse?.cursor?.data?.length || 0;

      return {
        balances: aggregatedBalances,
        total_accounts: totalAccounts
      };
    }, `getAggregatedBalances:${addressPattern}`);

    if (!result.success) {
      throw new Error(`Failed to get aggregated balances: ${result.error?.message}`);
    }

    return result.data!;
  }

  public async accountExists(address: string): Promise<boolean> {
    const account = await this.getAccount(address);
    return account !== null;
  }

  public validateAccountStructure(address: string): boolean {
    // Validate against known account patterns
    const patterns = [
      /^users:\w+:(wallet|savings|crypto:\w+)$/,
      /^business:\w+:(main|sub:\w+|escrow)$/,
      /^treasury:\w+:holdings$/,
      /^fees:\w+:collected$/,
      /^liquidity:\w+:pool$/,
      /^compliance:\w+:reserve$/,
      /^external:\w+:.+$/,
      /^vault:\w+:(hot|cold)_storage$/,
      /^@world$/
    ];

    return patterns.some(pattern => pattern.test(address));
  }

  // ========== Transaction Management ==========

  public async createTransaction(request: TransactionRequest): Promise<FormanceTransaction> {
    this.logger.info('Creating Formance transaction', { 
      reference: request.reference,
      postings_count: request.postings.length,
      type: request.metadata.type
    });

    // Validate transaction before sending
    const validation = await this.validateTransaction(request);
    if (!validation.valid) {
      throw new Error(`Transaction validation failed: ${validation.errors.join(', ')}`);
    }

    const result = await this.clientService.withRetry(async () => {
      const sdk = this.clientService.getSDK();
      const config = this.clientService.getConfig();

      const response = await sdk.ledger.v2.createTransaction({
        ledger: config.defaultLedger,
        v2PostTransaction: {
          metadata: request.metadata,
          postings: request.postings.map(posting => ({
            amount: posting.amount,
            asset: posting.asset,
            source: posting.source,
            destination: posting.destination
          })),
          reference: request.reference
        },
        dryRun: request.dry_run
      });

      if (!response.v2CreateTransactionResponse?.data) {
        throw new Error('No transaction data returned from Formance');
      }

      const transactionData = response.v2CreateTransactionResponse.data;
      
      return new FormanceTransactionEntity(
        request.postings,
        request.metadata,
        request.reference || '',
        transactionData.id,
        transactionData.id, // Use id for txid since txid property doesn't exist
        transactionData.timestamp.toISOString(),
        false,
        this.convertVolumesMapToBigint(transactionData.preCommitVolumes),
        this.convertVolumesMapToBigint(transactionData.postCommitVolumes)
      );
    }, `createTransaction:${request.reference || 'no-ref'}`, true);

    if (!result.success) {
      throw new Error(`Failed to create transaction: ${result.error?.message}`);
    }

    return result.data!;
  }

  public async getTransaction(id: bigint): Promise<FormanceTransaction | null> {
    const result = await this.clientService.withRetry(async () => {
      const sdk = this.clientService.getSDK();
      const config = this.clientService.getConfig();

      try {
        const response = await sdk.ledger.v2.getTransaction({
          ledger: config.defaultLedger,
          id
        });

        if (!response.v2GetTransactionResponse?.data) {
          return null;
        }

        const tx = response.v2GetTransactionResponse.data;
        
        return new FormanceTransactionEntity(
          tx.postings || [],
          this.convertToFormanceTransactionMetadata(tx.metadata || {}),
          tx.reference || '',
          tx.id,
          tx.id, // Use id for txid since txid property doesn't exist
          tx.timestamp.toISOString(),
          tx.reverted || false,
          this.convertVolumesMapToBigint(tx.preCommitVolumes),
          this.convertVolumesMapToBigint(tx.postCommitVolumes)
        );
      } catch (error) {
        if ((error as any)?.statusCode === 404) {
          return null;
        }
        throw error;
      }
    }, `getTransaction:${id}`);

    if (!result.success) {
      throw new Error(`Failed to get transaction: ${result.error?.message}`);
    }

    return result.data!;
  }

  public async getTransactionByReference(reference: string): Promise<FormanceTransaction | null> {
    const transactions = await this.listTransactions({ reference });
    return transactions.length > 0 ? transactions[0]! : null;
  }

  public async listTransactions(filter?: TransactionFilter): Promise<FormanceTransaction[]> {
    const result = await this.clientService.withRetry(async () => {
      const sdk = this.clientService.getSDK();
      const config = this.clientService.getConfig();

      const response = await sdk.ledger.v2.listTransactions({
        ledger: config.defaultLedger,
        pageSize: Number(filter?.limit || 100),
        cursor: filter?.offset ? String(filter.offset) : undefined,
        query: this.buildTransactionQueryFilter(filter)
      });

      const transactions: FormanceTransaction[] = [];
      
      if (response.v2TransactionsCursorResponse?.cursor?.data) {
        for (const tx of response.v2TransactionsCursorResponse.cursor.data) {
          transactions.push(new FormanceTransactionEntity(
            tx.postings || [],
            this.convertToFormanceTransactionMetadata(tx.metadata || {}),
            tx.reference || '',
            tx.id,
            tx.id, // Use id for txid since txid property doesn't exist
            tx.timestamp.toISOString(),
            tx.reverted || false,
            this.convertVolumesMapToBigint(tx.preCommitVolumes),
            this.convertVolumesMapToBigint(tx.postCommitVolumes)
          ));
        }
      }

      return transactions;
    }, 'listTransactions');

    if (!result.success) {
      throw new Error(`Failed to list transactions: ${result.error?.message}`);
    }

    return result.data!;
  }

  public async revertTransaction(id: bigint): Promise<FormanceTransaction> {
    const result = await this.clientService.withRetry(async () => {
      const sdk = this.clientService.getSDK();
      const config = this.clientService.getConfig();

      const response = await sdk.ledger.v2.revertTransaction({
        ledger: config.defaultLedger,
        id
      });

      if (!response.v2CreateTransactionResponse?.data) {
        throw new Error('No transaction data returned from revert');
      }

      const tx = response.v2CreateTransactionResponse.data;
      
      return new FormanceTransactionEntity(
        tx.postings || [],
        this.convertToFormanceTransactionMetadata(tx.metadata || {}),
        tx.reference || '',
        tx.id,
        tx.id, // Use id for txid since txid property doesn't exist
        tx.timestamp.toISOString(),
        true, // reverted
        this.convertVolumesMapToBigint(tx.preCommitVolumes),
        this.convertVolumesMapToBigint(tx.postCommitVolumes)
      );
    }, `revertTransaction:${id}`);

    if (!result.success) {
      throw new Error(`Failed to revert transaction: ${result.error?.message}`);
    }

    return result.data!;
  }

  public async dryRunTransaction(request: TransactionRequest): Promise<{valid: boolean; errors?: string[]}> {
    try {
      await this.createTransaction({ ...request, dry_run: true });
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        errors: [(error as Error).message] 
      };
    }
  }

  public async getTransactionsForAccount(address: string, filter?: TransactionFilter): Promise<FormanceTransaction[]> {
    return this.listTransactions({ ...filter, account: address });
  }

  public async getTransactionsByMetadata(metadata: Record<string, any>): Promise<FormanceTransaction[]> {
    return this.listTransactions({ metadata_filter: metadata });
  }

  public async getTransactionVolumes(address: string, asset?: string): Promise<{input: bigint; output: bigint}> {
    const account = await this.getAccount(address);
    if (!account?.effective_volumes) {
      return { input: BigInt(0), output: BigInt(0) };
    }

    let input = BigInt(0);
    let output = BigInt(0);

    if (asset) {
      const volumes = account.effective_volumes[asset];
      if (volumes) {
        // Effective volumes contain input and output for each asset
        input = BigInt((volumes as any).input || 0);
        output = BigInt((volumes as any).output || 0);
      }
    } else {
      // Sum all assets
      for (const volumes of Object.values(account.effective_volumes)) {
        input += BigInt((volumes as any).input || 0);
        output += BigInt((volumes as any).output || 0);
      }
    }

    return { input, output };
  }

  public async validateTransaction(request: TransactionRequest): Promise<{valid: boolean; errors: string[]}> {
    const errors: string[] = [];

    // Basic validation
    if (!request.postings || request.postings.length === 0) {
      errors.push('Transaction must have at least one posting');
    }

    // Validate each posting
    for (const [index, posting] of request.postings.entries()) {
      if (!posting.amount || posting.amount <= 0) {
        errors.push(`Posting ${index}: Amount must be positive`);
      }
      
      if (!posting.asset || posting.asset.trim() === '') {
        errors.push(`Posting ${index}: Asset is required`);
      }
      
      if (!posting.source || posting.source.trim() === '') {
        errors.push(`Posting ${index}: Source account is required`);
      }
      
      if (!posting.destination || posting.destination.trim() === '') {
        errors.push(`Posting ${index}: Destination account is required`);
      }
      
      if (posting.source === posting.destination) {
        errors.push(`Posting ${index}: Source and destination cannot be the same`);
      }

      // Validate account structure (unless it's @world)
      if (posting.source !== '@world' && !this.validateAccountStructure(posting.source)) {
        errors.push(`Posting ${index}: Invalid source account structure: ${posting.source}`);
      }
      
      if (posting.destination !== '@world' && !this.validateAccountStructure(posting.destination)) {
        errors.push(`Posting ${index}: Invalid destination account structure: ${posting.destination}`);
      }
    }

    // Validate metadata
    if (!request.metadata.type) {
      errors.push('Transaction metadata must include type');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ========== Ledger Management ==========

  public async createLedger(name: string, metadata?: Record<string, any>): Promise<void> {
    const result = await this.clientService.withRetry(async () => {
      const sdk = this.clientService.getSDK();

      await sdk.ledger.v2.createLedger({
        ledger: name,
        v2CreateLedgerRequest: {
          metadata: metadata || {}
        }
      });
    }, `createLedger:${name}`);

    if (!result.success) {
      throw new Error(`Failed to create ledger: ${result.error?.message}`);
    }
  }

  public async getLedgerInfo(ledger: string): Promise<{name: string; metadata: Record<string, any>}> {
    const result = await this.clientService.withRetry(async () => {
      const sdk = this.clientService.getSDK();

      const response = await sdk.ledger.v2.getLedgerInfo({
        ledger
      });

      return {
        name: ledger,
        metadata: {} // V2LedgerInfo doesn't have metadata, return empty object
      };
    }, `getLedgerInfo:${ledger}`);

    if (!result.success) {
      throw new Error(`Failed to get ledger info: ${result.error?.message}`);
    }

    return result.data!;
  }

  public async listLedgers(): Promise<string[]> {
    const result = await this.clientService.withRetry(async () => {
      const sdk = this.clientService.getSDK();

      const response = await sdk.ledger.v2.listLedgers({});
      
      return response.v2LedgerListResponse?.cursor?.data?.map((ledger: any) => ledger.name) || [];
    }, 'listLedgers');

    if (!result.success) {
      throw new Error(`Failed to list ledgers: ${result.error?.message}`);
    }

    return result.data!;
  }

  public async deleteLedger(name: string): Promise<void> {
    // Formance doesn't support ledger deletion in API
    // This would need to be done at the infrastructure level
    throw new Error('Ledger deletion not supported through API');
  }

  public async getLedgerStats(ledger: string): Promise<{
    accounts: number;
    transactions: number;
    assets: string[];
    volume: Record<string, bigint>;
  }> {
    const result = await this.clientService.withRetry(async () => {
      const sdk = this.clientService.getSDK();

      const [accountsResponse, transactionsResponse, statsResponse] = await Promise.all([
        sdk.ledger.v2.listAccounts({ ledger, pageSize: 1 }),
        sdk.ledger.v2.listTransactions({ ledger, pageSize: 1 }),
        sdk.ledger.v2.readStats({ ledger })
      ]);

      const stats = statsResponse.v2StatsResponse?.data;
      
      return {
        accounts: Number(stats?.accounts || 0),
        transactions: Number(stats?.transactions || 0),
        assets: [], // V2Stats doesn't have volume/assets breakdown
        volume: {} // V2Stats doesn't have volume/assets breakdown
      };
    }, `getLedgerStats:${ledger}`);

    if (!result.success) {
      throw new Error(`Failed to get ledger stats: ${result.error?.message}`);
    }

    return result.data!;
  }

  public async bulkCreateAccounts(ledger: string, accounts: CreateAccountRequest[]): Promise<FormanceAccount[]> {
    // Formance doesn't have bulk account creation
    // We'll create them sequentially
    const createdAccounts: FormanceAccount[] = [];
    
    for (const accountRequest of accounts) {
      const account = await this.createAccount(accountRequest);
      createdAccounts.push(account);
    }
    
    return createdAccounts;
  }

  public async bulkCreateTransactions(ledger: string, transactions: TransactionRequest[]): Promise<FormanceTransaction[]> {
    // Create transactions sequentially to maintain order
    const createdTransactions: FormanceTransaction[] = [];
    
    for (const transactionRequest of transactions) {
      const transaction = await this.createTransaction(transactionRequest);
      createdTransactions.push(transaction);
    }
    
    return createdTransactions;
  }

  // ========== Private Helper Methods ==========

  private determineAccountType(address: string): 'user' | 'business' | 'system' | 'external' {
    if (address.startsWith('users:')) return 'user';
    if (address.startsWith('business:')) return 'business';
    if (address.startsWith('external:')) return 'external';
    return 'system'; // treasury, fees, liquidity, etc.
  }

  private convertVolumesToBalances(volumes: Record<string, any>): Record<string, bigint> {
    const balances: Record<string, bigint> = {};
    
    for (const [asset, volume] of Object.entries(volumes)) {
      if (typeof volume === 'object' && volume && 'balance' in volume) {
        balances[asset] = BigInt(String(volume.balance));
      } else if (typeof volume === 'string' || typeof volume === 'number') {
        balances[asset] = BigInt(String(volume));
      }
    }
    
    return balances;
  }

  private convertVolumeMapToBigint(volumes: Record<string, any>): Record<string, bigint> {
    const result: Record<string, bigint> = {};
    
    for (const [asset, volume] of Object.entries(volumes)) {
      if (typeof volume === 'object' && volume && 'balance' in volume) {
        result[asset] = BigInt(String(volume.balance));
      } else if (typeof volume === 'string' || typeof volume === 'number') {
        result[asset] = BigInt(String(volume));
      }
    }
    
    return result;
  }

  private convertVolumesMapToBigint(volumes: Record<string, Record<string, any>> | undefined): Record<string, Record<string, bigint>> | undefined {
    if (!volumes) return undefined;
    
    const result: Record<string, Record<string, bigint>> = {};
    
    for (const [account, assetVolumes] of Object.entries(volumes)) {
      result[account] = {};
      for (const [asset, volume] of Object.entries(assetVolumes)) {
        if (typeof volume === 'object' && volume && 'balance' in volume) {
          result[account][asset] = BigInt(String(volume.balance));
        } else if (typeof volume === 'string' || typeof volume === 'number') {
          result[account][asset] = BigInt(String(volume));
        }
      }
    }
    
    return result;
  }

  private convertToFormanceAccountMetadata(metadata: Record<string, string>): FormanceAccountMetadata {
    return {
      account_type: metadata.account_type || 'user',
      created_at: metadata.created_at || new Date().toISOString(),
      ...metadata
    };
  }

  private convertToFormanceTransactionMetadata(metadata: Record<string, string>): FormanceTransactionMetadata {
    return {
      type: (metadata.type as any) || 'deposit',
      ...metadata
    };
  }

  private buildQueryFilter(filter?: AccountFilter): Record<string, any> | undefined {
    if (!filter) return undefined;
    
    const query: Record<string, any> = {};
    
    if (filter.address_pattern) {
      query.address = filter.address_pattern;
    }
    
    if (filter.metadata_filter) {
      Object.assign(query, filter.metadata_filter);
    }
    
    return Object.keys(query).length > 0 ? query : undefined;
  }

  private buildTransactionQueryFilter(filter?: TransactionFilter): Record<string, any> | undefined {
    if (!filter) return undefined;
    
    const query: Record<string, any> = {};
    
    if (filter.account) {
      query.account = filter.account;
    }
    
    if (filter.source) {
      query.source = filter.source;
    }
    
    if (filter.destination) {
      query.destination = filter.destination;
    }
    
    if (filter.reference) {
      query.reference = filter.reference;
    }
    
    if (filter.start_time) {
      query.start_time = filter.start_time;
    }
    
    if (filter.end_time) {
      query.end_time = filter.end_time;
    }
    
    if (filter.metadata_filter) {
      Object.assign(query, filter.metadata_filter);
    }
    
    return Object.keys(query).length > 0 ? query : undefined;
  }

  private convertMetadataToStringRecord(metadata: any): Record<string, string> {
    const result: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'string') {
          result[key] = value;
        } else if (Array.isArray(value)) {
          result[key] = JSON.stringify(value);
        } else if (typeof value === 'object') {
          result[key] = JSON.stringify(value);
        } else {
          result[key] = String(value);
        }
      }
    }
    
    return result;
  }
}