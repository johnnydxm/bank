export interface Transaction {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  type: TransactionType;
  status: TransactionStatus;
  description: string;
  metadata: Record<string, any>;
  createdAt: Date;
  completedAt: Date;
}

export enum TransactionType {
  P2P_TRANSFER = 'p2p_transfer',
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  CURRENCY_CONVERSION = 'currency_conversion',
  CARD_PAYMENT = 'card_payment'
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export class TransactionEntity implements Transaction {
  constructor(
    public readonly id: string,
    public readonly fromAccountId: string,
    public readonly toAccountId: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly type: TransactionType,
    public status: TransactionStatus,
    public readonly description: string = '',
    public readonly metadata: Record<string, any> = {},
    public readonly createdAt: Date = new Date(),
    public completedAt: Date = new Date()
  ) {}

  public complete(): void {
    this.status = TransactionStatus.COMPLETED;
    this.completedAt = new Date();
  }

  public fail(): void {
    this.status = TransactionStatus.FAILED;
  }

  public cancel(): void {
    this.status = TransactionStatus.CANCELLED;
  }

  public isCompleted(): boolean {
    return this.status === TransactionStatus.COMPLETED;
  }

  public isPending(): boolean {
    return this.status === TransactionStatus.PENDING;
  }
}