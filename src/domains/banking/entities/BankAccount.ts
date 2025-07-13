export interface BankAccountDetails {
  id: string;
  accountNumber: string;
  routingNumber: string;
  accountType: 'checking' | 'savings' | 'business';
  bankName: string;
  bankCode: string; // SWIFT/BIC code
  country: string;
  currency: string;
  isActive: boolean;
  isVerified: boolean;
  metadata: {
    holderName: string;
    holderType: 'individual' | 'business';
    verificationStatus: 'pending' | 'verified' | 'failed' | 'requires_documents';
    verificationMethod: 'micro_deposits' | 'instant' | 'manual' | 'plaid' | 'open_banking';
    verifiedAt?: Date | undefined;
    lastUsedAt?: Date | undefined;
    [key: string]: any;
  };
}

export interface BankConnection {
  id: string;
  userId: string;
  providerId: string;
  providerName: string;
  connectionType: 'plaid' | 'yodlee' | 'open_banking' | 'manual' | 'swift';
  status: 'active' | 'inactive' | 'error' | 'pending_reauth' | 'expired';
  credentials: {
    accessToken?: string | undefined;
    refreshToken?: string | undefined;
    itemId?: string | undefined;
    expiresAt?: Date | undefined;
    encryptedData?: string | undefined;
  };
  accounts: BankAccountDetails[];
  capabilities: BankConnectionCapability[];
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt?: Date | undefined;
  errorDetails?: {
    code: string;
    message: string;
    requiresUserAction: boolean;
    actionUrl?: string | undefined;
  } | undefined;
}

export type BankConnectionCapability = 
  | 'read_accounts'
  | 'read_balances' 
  | 'read_transactions'
  | 'initiate_payments'
  | 'wire_transfers'
  | 'ach_transfers'
  | 'instant_transfers';

export interface BankTransfer {
  id: string;
  userId: string;
  bankConnectionId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  transferType: 'deposit' | 'withdrawal' | 'transfer';
  paymentMethod: 'ach' | 'wire' | 'instant' | 'check';
  amount: bigint;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'returned';
  direction: 'inbound' | 'outbound';
  metadata: {
    description?: string | undefined;
    reference?: string | undefined;
    memo?: string | undefined;
    expectedSettlementDate?: Date | undefined;
    actualSettlementDate?: Date | undefined;
    fees?: Array<{
      type: string;
      amount: bigint;
      currency: string;
    }> | undefined;
    regulatoryInfo?: {
      purpose: string;
      category: string;
      complianceChecks: string[];
    } | undefined;
  };
  createdAt: Date;
  updatedAt: Date;
  scheduledAt?: Date | undefined;
  processedAt?: Date | undefined;
  completedAt?: Date | undefined;
  errorDetails?: {
    code: string;
    message: string;
    retryable: boolean;
    retryAfter?: Date | undefined;
  } | undefined;
}

export class BankAccountEntity implements BankAccountDetails {
  constructor(
    public readonly id: string,
    public readonly accountNumber: string,
    public readonly routingNumber: string,
    public readonly accountType: 'checking' | 'savings' | 'business',
    public readonly bankName: string,
    public readonly bankCode: string,
    public readonly country: string,
    public readonly currency: string,
    public isActive: boolean = true,
    public isVerified: boolean = false,
    public readonly metadata: {
      holderName: string;
      holderType: 'individual' | 'business';
      verificationStatus: 'pending' | 'verified' | 'failed' | 'requires_documents';
      verificationMethod: 'micro_deposits' | 'instant' | 'manual' | 'plaid' | 'open_banking';
      verifiedAt?: Date | undefined;
      lastUsedAt?: Date | undefined;
      [key: string]: any;
    }
  ) {}

  public maskAccountNumber(): string {
    const accountStr = this.accountNumber;
    if (accountStr.length <= 4) return '****';
    
    const visibleDigits = accountStr.slice(-4);
    const maskLength = Math.max(4, accountStr.length - 4);
    return '*'.repeat(maskLength) + visibleDigits;
  }

  public getDisplayName(): string {
    return `${this.bankName} ${this.accountType.toUpperCase()} ****${this.accountNumber.slice(-4)}`;
  }

  public isEligibleForTransfer(): boolean {
    return this.isActive && this.isVerified && this.metadata.verificationStatus === 'verified';
  }

  public requiresReVerification(): boolean {
    if (!this.metadata.verifiedAt) return true;
    
    const daysSinceVerification = (Date.now() - this.metadata.verifiedAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceVerification > 365; // Re-verify after 1 year
  }

  public updateLastUsed(): void {
    this.metadata.lastUsedAt = new Date();
  }

  public markVerified(method: 'micro_deposits' | 'instant' | 'manual' | 'plaid' | 'open_banking'): void {
    this.isVerified = true;
    this.metadata.verificationStatus = 'verified';
    this.metadata.verificationMethod = method;
    this.metadata.verifiedAt = new Date();
  }

  public markVerificationFailed(reason?: string): void {
    this.isVerified = false;
    this.metadata.verificationStatus = 'failed';
    if (reason) {
      this.metadata.failureReason = reason;
    }
  }

  public toJSON(): BankAccountDetails {
    return {
      id: this.id,
      accountNumber: this.accountNumber,
      routingNumber: this.routingNumber,
      accountType: this.accountType,
      bankName: this.bankName,
      bankCode: this.bankCode,
      country: this.country,
      currency: this.currency,
      isActive: this.isActive,
      isVerified: this.isVerified,
      metadata: { ...this.metadata }
    };
  }

  public toSafeJSON(): Omit<BankAccountDetails, 'accountNumber' | 'routingNumber'> & {
    maskedAccountNumber: string;
  } {
    return {
      id: this.id,
      maskedAccountNumber: this.maskAccountNumber(),
      accountType: this.accountType,
      bankName: this.bankName,
      bankCode: this.bankCode,
      country: this.country,
      currency: this.currency,
      isActive: this.isActive,
      isVerified: this.isVerified,
      metadata: { ...this.metadata }
    };
  }
}

export class BankConnectionEntity implements BankConnection {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly providerId: string,
    public readonly providerName: string,
    public readonly connectionType: 'plaid' | 'yodlee' | 'open_banking' | 'manual' | 'swift',
    public status: 'active' | 'inactive' | 'error' | 'pending_reauth' | 'expired',
    public credentials: {
      accessToken?: string | undefined;
      refreshToken?: string | undefined;
      itemId?: string | undefined;
      expiresAt?: Date | undefined;
      encryptedData?: string | undefined;
    },
    public accounts: BankAccountDetails[],
    public capabilities: BankConnectionCapability[],
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public lastSyncAt?: Date | undefined,
    public errorDetails?: {
      code: string;
      message: string;
      requiresUserAction: boolean;
      actionUrl?: string | undefined;
    } | undefined
  ) {}

  public isExpired(): boolean {
    if (!this.credentials.expiresAt) return false;
    return new Date() > this.credentials.expiresAt;
  }

  public requiresReauth(): boolean {
    return this.status === 'pending_reauth' || this.isExpired();
  }

  public hasCapability(capability: BankConnectionCapability): boolean {
    return this.capabilities.includes(capability);
  }

  public canInitiateTransfers(): boolean {
    return this.hasCapability('initiate_payments') || 
           this.hasCapability('ach_transfers') || 
           this.hasCapability('wire_transfers');
  }

  public getVerifiedAccounts(): BankAccountDetails[] {
    return this.accounts.filter(account => account.isVerified && account.isActive);
  }

  public addAccount(account: BankAccountDetails): void {
    const existingIndex = this.accounts.findIndex(acc => acc.id === account.id);
    if (existingIndex >= 0) {
      this.accounts[existingIndex] = account;
    } else {
      this.accounts.push(account);
    }
    this.updatedAt = new Date();
  }

  public removeAccount(accountId: string): void {
    this.accounts = this.accounts.filter(acc => acc.id !== accountId);
    this.updatedAt = new Date();
  }

  public updateStatus(
    status: 'active' | 'inactive' | 'error' | 'pending_reauth' | 'expired',
    errorDetails?: { code: string; message: string; requiresUserAction: boolean; actionUrl?: string }
  ): void {
    this.status = status;
    this.errorDetails = errorDetails;
    this.updatedAt = new Date();
  }

  public updateCredentials(credentials: Partial<typeof this.credentials>): void {
    this.credentials = { ...this.credentials, ...credentials };
    this.updatedAt = new Date();
  }

  public markSynced(): void {
    this.lastSyncAt = new Date();
    this.updatedAt = new Date();
  }

  public needsSync(): boolean {
    if (!this.lastSyncAt) return true;
    
    const hoursSinceSync = (Date.now() - this.lastSyncAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceSync > 24; // Sync every 24 hours
  }

  public toJSON(): BankConnection {
    return {
      id: this.id,
      userId: this.userId,
      providerId: this.providerId,
      providerName: this.providerName,
      connectionType: this.connectionType,
      status: this.status,
      credentials: { ...this.credentials },
      accounts: this.accounts,
      capabilities: [...this.capabilities],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastSyncAt: this.lastSyncAt,
      errorDetails: this.errorDetails
    };
  }

  public toSafeJSON(): Omit<BankConnection, 'credentials'> & {
    hasCredentials: boolean;
    credentialsExpiry?: Date | undefined;
  } {
    return {
      id: this.id,
      userId: this.userId,
      providerId: this.providerId,
      providerName: this.providerName,
      connectionType: this.connectionType,
      status: this.status,
      hasCredentials: !!(this.credentials.accessToken || this.credentials.encryptedData),
      credentialsExpiry: this.credentials.expiresAt,
      accounts: this.accounts,
      capabilities: [...this.capabilities],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastSyncAt: this.lastSyncAt,
      errorDetails: this.errorDetails
    };
  }
}

export class BankTransferEntity implements BankTransfer {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly bankConnectionId: string,
    public readonly sourceAccountId: string,
    public readonly destinationAccountId: string,
    public readonly transferType: 'deposit' | 'withdrawal' | 'transfer',
    public readonly paymentMethod: 'ach' | 'wire' | 'instant' | 'check',
    public readonly amount: bigint,
    public readonly currency: string,
    public status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'returned',
    public readonly direction: 'inbound' | 'outbound',
    public readonly metadata: {
      description?: string | undefined;
      reference?: string | undefined;
      memo?: string | undefined;
      expectedSettlementDate?: Date | undefined;
      actualSettlementDate?: Date | undefined;
      fees?: Array<{
        type: string;
        amount: bigint;
        currency: string;
      }> | undefined;
      regulatoryInfo?: {
        purpose: string;
        category: string;
        complianceChecks: string[];
      } | undefined;
    },
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public scheduledAt?: Date | undefined,
    public processedAt?: Date | undefined,
    public completedAt?: Date | undefined,
    public errorDetails?: {
      code: string;
      message: string;
      retryable: boolean;
      retryAfter?: Date | undefined;
    } | undefined
  ) {}

  public isSettled(): boolean {
    return this.status === 'completed' && !!this.completedAt;
  }

  public canCancel(): boolean {
    return ['pending', 'processing'].includes(this.status) && !this.processedAt;
  }

  public canRetry(): boolean {
    return this.status === 'failed' && 
           this.errorDetails?.retryable === true &&
           (!this.errorDetails.retryAfter || new Date() > this.errorDetails.retryAfter);
  }

  public getEstimatedSettlementDate(): Date {
    if (this.metadata.expectedSettlementDate) {
      return this.metadata.expectedSettlementDate;
    }

    // Default settlement times by payment method
    const now = new Date();
    switch (this.paymentMethod) {
      case 'instant':
        return new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
      case 'ach':
        return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 business days
      case 'wire':
        return new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); // 1 business day
      case 'check':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 business days
      default:
        return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    }
  }

  public getTotalAmount(): bigint {
    let total = this.amount;
    
    if (this.metadata.fees) {
      for (const fee of this.metadata.fees) {
        if (fee.currency === this.currency) {
          total += fee.amount;
        }
      }
    }

    return total;
  }

  public updateStatus(
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'returned',
    errorDetails?: { code: string; message: string; retryable: boolean; retryAfter?: Date }
  ): void {
    const oldStatus = this.status;
    this.status = status;
    this.errorDetails = errorDetails;
    this.updatedAt = new Date();

    // Update timestamps based on status transitions
    if (status === 'processing' && oldStatus === 'pending') {
      this.processedAt = new Date();
    } else if (status === 'completed' && oldStatus !== 'completed') {
      this.completedAt = new Date();
      this.metadata.actualSettlementDate = new Date();
    }
  }

  public addFee(type: string, amount: bigint, currency: string = this.currency): void {
    if (!this.metadata.fees) {
      this.metadata.fees = [];
    }
    
    this.metadata.fees.push({ type, amount, currency });
    this.updatedAt = new Date();
  }

  public toJSON(): BankTransfer {
    return {
      id: this.id,
      userId: this.userId,
      bankConnectionId: this.bankConnectionId,
      sourceAccountId: this.sourceAccountId,
      destinationAccountId: this.destinationAccountId,
      transferType: this.transferType,
      paymentMethod: this.paymentMethod,
      amount: this.amount,
      currency: this.currency,
      status: this.status,
      direction: this.direction,
      metadata: { ...this.metadata },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      scheduledAt: this.scheduledAt,
      processedAt: this.processedAt,
      completedAt: this.completedAt,
      errorDetails: this.errorDetails
    };
  }
}