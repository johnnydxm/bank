import { AccountEntity, AccountType, AccountStatus } from '../entities/Account';
import { IAccountRepository } from '../repositories/IAccountRepository';
import { v4 as uuidv4 } from 'uuid';

export class AccountService {
  constructor(private accountRepository: IAccountRepository) {}

  async createAccount(
    userId: string,
    type: AccountType,
    currency: string
  ): Promise<AccountEntity> {
    const account = new AccountEntity(
      uuidv4(),
      userId,
      type,
      currency,
      0,
      AccountStatus.ACTIVE,
      new Date(),
      new Date()
    );

    await this.accountRepository.save(account);
    return account;
  }

  async getAccountById(id: string): Promise<AccountEntity | null> {
    return await this.accountRepository.findById(id);
  }

  async getUserAccounts(userId: string): Promise<AccountEntity[]> {
    return await this.accountRepository.findByUserId(userId);
  }

  async updateAccountBalance(
    accountId: string,
    newBalance: number
  ): Promise<void> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new Error(`Account with ID ${accountId} not found`);
    }

    account.updateBalance(newBalance);
    await this.accountRepository.update(account);
  }

  async suspendAccount(accountId: string): Promise<void> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new Error(`Account with ID ${accountId} not found`);
    }

    account.suspend();
    await this.accountRepository.update(account);
  }

  async activateAccount(accountId: string): Promise<void> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new Error(`Account with ID ${accountId} not found`);
    }

    account.activate();
    await this.accountRepository.update(account);
  }
}