import { AccountEntity } from '../entities/Account';

export interface IAccountRepository {
  findById(id: string): Promise<AccountEntity | null>;
  findByUserId(userId: string): Promise<AccountEntity[]>;
  save(account: AccountEntity): Promise<void>;
  update(account: AccountEntity): Promise<void>;
  delete(id: string): Promise<void>;
  findByTypeAndUserId(type: string, userId: string): Promise<AccountEntity[]>;
}
