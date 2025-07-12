export interface Account {
  id: string;
  userId: string;
  type: AccountType;
  currency: string;
  balance: number;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum AccountType {
  PERSONAL = 'personal',
  BUSINESS = 'business',
  SUB_ACCOUNT = 'sub_account'
}

export enum AccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CLOSED = 'closed'
}

export class AccountEntity implements Account {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly type: AccountType,
    public readonly currency: string,
    public balance: number,
    public status: AccountStatus,
    public readonly createdAt: Date,
    public updatedAt: Date
  ) {}

  public updateBalance(newBalance: number): void {
    this.balance = newBalance;
    this.updatedAt = new Date();
  }

  public suspend(): void {
    this.status = AccountStatus.SUSPENDED;
    this.updatedAt = new Date();
  }

  public activate(): void {
    this.status = AccountStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  public isActive(): boolean {
    return this.status === AccountStatus.ACTIVE;
  }
}