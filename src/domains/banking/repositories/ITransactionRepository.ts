import { TransactionEntity } from '../entities/Transaction';

export interface ITransactionRepository {
  findById(id: string): Promise<TransactionEntity | null>;
  findByAccountId(accountId: string): Promise<TransactionEntity[]>;
  save(transaction: TransactionEntity): Promise<void>;
  update(transaction: TransactionEntity): Promise<void>;
  findPendingTransactions(): Promise<TransactionEntity[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<TransactionEntity[]>;
}
