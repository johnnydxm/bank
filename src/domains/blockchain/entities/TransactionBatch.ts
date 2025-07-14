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

  constructor(props: Omit<TransactionBatchProps, 'id' | 'createdAt'>) {
    super(`batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    this._transactions = props.transactions;
    this._network = props.network;
    this._status = props.status;
    this._estimatedGas = props.estimatedGas;
    this._actualGas = props.actualGas;
    this._gasPrice = props.gasPrice;
    this._totalCost = props.totalCost;
    this._batchCreatedAt = new Date();
    this._processedAt = props.processedAt;
    this._metadata = props.metadata;
  }

  public static create(props: Omit<TransactionBatchProps, 'id' | 'createdAt'>): TransactionBatch {
    return new TransactionBatch(props);
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