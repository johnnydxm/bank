import { Entity } from '../../../shared/domain/Entity';

export interface TransactionBatchProps {
  readonly id: string;
  readonly transactions: string[];
  readonly network: string;
  readonly status: 'pending' | 'processing' | 'completed' | 'failed';
  readonly estimatedGas: bigint;
  readonly actualGas?: bigint | undefined;
  readonly gasPrice: bigint;
  readonly totalCost: bigint;
  readonly createdAt: Date;
  readonly processedAt?: Date | undefined;
  readonly metadata?: Record<string, any> | undefined;
}

export class TransactionBatch extends Entity {
  private _transactions: string[];
  private _network: string;
  private _status: 'pending' | 'processing' | 'completed' | 'failed';
  private _estimatedGas: bigint;
  private _actualGas?: bigint | undefined;
  private _gasPrice: bigint;
  private _totalCost: bigint;
  private _batchCreatedAt: Date;
  private _processedAt?: Date | undefined;
  private _metadata?: Record<string, any> | undefined;

  get transactions(): string[] {
    return this._transactions;
  }

  get network(): string {
    return this._network;
  }

  get status(): 'pending' | 'processing' | 'completed' | 'failed' {
    return this._status;
  }

  get estimatedGas(): bigint {
    return this._estimatedGas;
  }

  get actualGas(): bigint | undefined {
    return this._actualGas;
  }

  get gasPrice(): bigint {
    return this._gasPrice;
  }

  get totalCost(): bigint {
    return this._totalCost;
  }

  get batchCreatedAt(): Date {
    return this._batchCreatedAt;
  }

  get processedAt(): Date | undefined {
    return this._processedAt;
  }

  get metadata(): Record<string, any> | undefined {
    return this._metadata;
  }

  constructor(
    id: string,
    transactions: string[],
    gasSavings: bigint,
    estimatedTime: number
  ) {
    super(id);
    this._transactions = transactions;
    this._network = 'ethereum';
    this._status = 'pending';
    this._estimatedGas = BigInt(transactions.length * 50000);
    this._actualGas = undefined;
    this._gasPrice = BigInt(20000000000);
    this._totalCost = this._estimatedGas * this._gasPrice;
    this._batchCreatedAt = new Date();
    this._processedAt = undefined;
    this._metadata = { gasSavings, estimatedTime };
  }

  public static generateId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public static create(props: Omit<TransactionBatchProps, 'id' | 'createdAt'>): TransactionBatch {
    const id = TransactionBatch.generateId();
    return new TransactionBatch(id, props.transactions, BigInt(0), 300);
  }

  public markAsProcessing(): void {
    this._status = 'processing';
    this.updateTimestamp();
  }

  public markAsCompleted(actualGas: bigint): void {
    this._status = 'completed';
    this._actualGas = actualGas;
    this._processedAt = new Date();
    this.updateTimestamp();
  }

  public markAsFailed(): void {
    this._status = 'failed';
    this._processedAt = new Date();
    this.updateTimestamp();
  }

  public addTransaction(transactionId: string): void {
    if (!this._transactions.includes(transactionId)) {
      this._transactions = [...this._transactions, transactionId];
      this.updateTimestamp();
    }
  }

  public getSavings(): bigint {
    if (!this._actualGas) return BigInt(0);
    
    // Calculate savings vs individual transactions
    const individualCost = BigInt(this._transactions.length) * this._gasPrice * BigInt(21000);
    const batchCost = this._actualGas * this._gasPrice;
    
    return individualCost > batchCost ? individualCost - batchCost : BigInt(0);
  }

  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this._transactions.length === 0) {
      errors.push('Batch must contain at least one transaction');
    }

    if (this._estimatedGas <= BigInt(0)) {
      errors.push('Estimated gas must be positive');
    }

    if (this._gasPrice <= BigInt(0)) {
      errors.push('Gas price must be positive');
    }

    if (!this._network || this._network.trim().length === 0) {
      errors.push('Network must be specified');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}