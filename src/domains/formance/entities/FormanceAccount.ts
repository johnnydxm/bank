export interface FormanceAccountMetadata {
  user_id?: string | undefined;
  business_id?: string | undefined;
  account_type: string;
  created_at: string;
  kyc_status?: 'pending' | 'verified' | 'rejected' | undefined;
  compliance_level?: 'basic' | 'enhanced' | 'premium' | undefined;
  risk_score?: number | undefined;
  last_activity?: string | undefined;
  tags?: string[] | undefined;
}

export interface FormanceAccount {
  address: string;
  type: 'user' | 'business' | 'system' | 'external';
  metadata: FormanceAccountMetadata;
  effective_volumes?: Record<string, bigint> | undefined;
  balances?: Record<string, bigint> | undefined;
}

export interface CreateAccountRequest {
  address: string;
  type: 'user' | 'business' | 'system' | 'external';
  metadata: FormanceAccountMetadata;
}

export interface AccountFilter {
  address_pattern?: string | undefined;
  account_type?: string | undefined;
  metadata_filter?: Record<string, any> | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export class FormanceAccountEntity implements FormanceAccount {
  constructor(
    public readonly address: string,
    public readonly type: 'user' | 'business' | 'system' | 'external',
    public readonly metadata: FormanceAccountMetadata,
    public effective_volumes: Record<string, bigint> = {},
    public balances: Record<string, bigint> = {}
  ) {}

  public updateMetadata(updates: Partial<FormanceAccountMetadata>): void {
    Object.assign(this.metadata, {
      ...updates,
      last_activity: new Date().toISOString()
    });
  }

  public updateBalance(asset: string, balance: bigint): void {
    this.balances[asset] = balance;
  }

  public getBalance(asset: string): bigint {
    return this.balances[asset] || BigInt(0);
  }

  public hasAsset(asset: string): boolean {
    return asset in this.balances && (this.balances[asset] || BigInt(0)) > BigInt(0);
  }

  public isSystemAccount(): boolean {
    return this.type === 'system' || this.address.startsWith('@');
  }

  public getUserId(): string | undefined {
    return this.metadata.user_id;
  }

  public getBusinessId(): string | undefined {
    return this.metadata.business_id;
  }
}

// Evidence-Based Account Structure Templates
export const AccountStructure = {
  // User Accounts (Individual)
  userWallet: (userId: string) => `users:${userId}:wallet`,
  userSavings: (userId: string) => `users:${userId}:savings`,
  userCrypto: (userId: string, asset: string) => `users:${userId}:crypto:${asset.toLowerCase()}`,
  
  // Business Accounts
  businessMain: (businessId: string) => `business:${businessId}:main`,
  businessSub: (businessId: string, subId: string) => `business:${businessId}:sub:${subId}`,
  businessEscrow: (businessId: string) => `business:${businessId}:escrow`,
  
  // System Accounts
  treasury: (asset: string) => `treasury:${asset.toLowerCase()}:holdings`,
  fees: (service: string) => `fees:${service}:collected`,
  liquidity: (asset: string) => `liquidity:${asset.toLowerCase()}:pool`,
  compliance: (type: string) => `compliance:${type}:reserve`,
  
  // External Integration Accounts
  stripe: (paymentId: string) => `external:stripe:${paymentId}`,
  blockchain: (network: string, address: string) => `external:${network}:${address}`,
  cardProcessor: (processorId: string, cardId: string) => `external:cards:${processorId}:${cardId}`,
  
  // Special System Accounts
  world: () => '@world' as const, // External money source/sink
  vault: (asset: string, type: 'hot' | 'cold') => `vault:${asset.toLowerCase()}:${type}_storage`
} as const;

export type AccountAddress = ReturnType<typeof AccountStructure[keyof typeof AccountStructure]>;