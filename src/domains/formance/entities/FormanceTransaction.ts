export interface FormancePosting {
  amount: bigint;
  asset: string;
  source: string;
  destination: string;
}

export interface FormanceTransactionMetadata {
  type: 'p2p_transfer' | 'crypto_purchase' | 'card_payment' | 'deposit' | 'withdrawal' | 'fee_collection';
  user_id?: string;
  business_id?: string;
  reference_id?: string;
  description?: string;
  created_by?: string;
  risk_score?: number;
  compliance_checked?: boolean;
  external_reference?: string;
  trace_id?: string;
  [key: string]: any;
}

export interface FormanceTransaction {
  id: bigint;
  txid: bigint;
  timestamp: string;
  postings: FormancePosting[];
  reference?: string;
  metadata: FormanceTransactionMetadata;
  reverted?: boolean;
  pre_commit_volumes?: Record<string, Record<string, bigint>>;
  post_commit_volumes?: Record<string, Record<string, bigint>>;
}

export interface TransactionRequest {
  postings: FormancePosting[];
  reference?: string;
  metadata: FormanceTransactionMetadata;
  dry_run?: boolean;
}

export interface TransactionFilter {
  reference?: string;
  account?: string;
  source?: string;
  destination?: string;
  start_time?: string;
  end_time?: string;
  metadata_filter?: Record<string, any>;
  limit?: number;
  offset?: number;
}

export class FormanceTransactionEntity implements FormanceTransaction {
  constructor(
    public postings: FormancePosting[],
    public metadata: FormanceTransactionMetadata,
    public reference?: string,
    public id: bigint = BigInt(0),
    public txid: bigint = BigInt(0),
    public timestamp: string = new Date().toISOString(),
    public reverted: boolean = false,
    public pre_commit_volumes?: Record<string, Record<string, bigint>>,
    public post_commit_volumes?: Record<string, Record<string, bigint>>
  ) {}

  public getTotalAmount(): bigint {
    return this.postings.reduce((total, posting) => total + posting.amount, BigInt(0));
  }

  public getUniqueAccounts(): string[] {
    const accounts = new Set<string>();
    this.postings.forEach(posting => {
      accounts.add(posting.source);
      accounts.add(posting.destination);
    });
    return Array.from(accounts);
  }

  public getAssets(): string[] {
    const assets = new Set<string>();
    this.postings.forEach(posting => assets.add(posting.asset));
    return Array.from(assets);
  }

  public isMultiAsset(): boolean {
    return this.getAssets().length > 1;
  }

  public isMultiPosting(): boolean {
    return this.postings.length > 1;
  }

  public hasAccount(account: string): boolean {
    return this.getUniqueAccounts().includes(account);
  }

  public getPostingsForAccount(account: string): FormancePosting[] {
    return this.postings.filter(
      posting => posting.source === account || posting.destination === account
    );
  }

  public validatePostings(): boolean {
    // Validate that all postings balance for each asset
    const assetBalances = new Map<string, bigint>();
    
    for (const posting of this.postings) {
      const currentBalance = assetBalances.get(posting.asset) || BigInt(0);
      assetBalances.set(posting.asset, currentBalance);
      
      // Money leaves source, enters destination
      if (posting.source !== '@world') {
        assetBalances.set(posting.asset, assetBalances.get(posting.asset)! - posting.amount);
      }
      if (posting.destination !== '@world') {
        assetBalances.set(posting.asset, assetBalances.get(posting.asset)! + posting.amount);
      }
    }
    
    // All asset balances should be zero (money conserved)
    return Array.from(assetBalances.values()).every(balance => balance === BigInt(0));
  }
}

// Transaction Template Factory
export class FormanceTransactionTemplates {
  
  // P2P Transfer with Fees
  static p2pTransferWithFee(
    fromUserId: string,
    toUserId: string,
    amount: bigint,
    asset: string,
    feeAmount: bigint,
    reference?: string
  ): TransactionRequest {
    const transferId = `transfer_${Date.now()}`;
    return {
      reference: reference || transferId,
      metadata: {
        type: 'p2p_transfer',
        user_id: fromUserId,
        recipient_id: toUserId,
        fee_collected: feeAmount.toString(),
        transfer_id: transferId,
        trace_id: `trace_${transferId}`
      },
      postings: [
        // User pays amount + fee
        {
          amount: amount + feeAmount,
          asset,
          source: `users:${fromUserId}:wallet`,
          destination: `transfer:temp:${transferId}`
        },
        // Amount to recipient
        {
          amount,
          asset,
          source: `transfer:temp:${transferId}`,
          destination: `users:${toUserId}:wallet`
        },
        // Fee to treasury
        {
          amount: feeAmount,
          asset,
          source: `transfer:temp:${transferId}`,
          destination: `fees:p2p_transfer:collected`
        }
      ]
    };
  }
  
  // Simple Deposit from External Source
  static externalDeposit(
    userId: string,
    amount: bigint,
    asset: string,
    externalReference: string,
    source: 'stripe' | 'bank' | 'crypto' = 'stripe'
  ): TransactionRequest {
    const depositId = `deposit_${Date.now()}`;
    return {
      reference: depositId,
      metadata: {
        type: 'deposit',
        user_id: userId,
        external_reference: externalReference,
        source_type: source,
        trace_id: `trace_${depositId}`
      },
      postings: [
        {
          amount,
          asset,
          source: '@world', // Money comes from external world
          destination: `users:${userId}:wallet`
        }
      ]
    };
  }
  
  // Withdrawal to External Destination
  static externalWithdrawal(
    userId: string,
    amount: bigint,
    asset: string,
    feeAmount: bigint,
    externalReference: string,
    destination: 'bank' | 'crypto' = 'bank'
  ): TransactionRequest {
    const withdrawalId = `withdrawal_${Date.now()}`;
    return {
      reference: withdrawalId,
      metadata: {
        type: 'withdrawal',
        user_id: userId,
        external_reference: externalReference,
        destination_type: destination,
        fee_collected: feeAmount.toString(),
        trace_id: `trace_${withdrawalId}`
      },
      postings: [
        // User pays amount + fee
        {
          amount: amount + feeAmount,
          asset,
          source: `users:${userId}:wallet`,
          destination: `withdrawal:temp:${withdrawalId}`
        },
        // Amount goes to external world
        {
          amount,
          asset,
          source: `withdrawal:temp:${withdrawalId}`,
          destination: '@world'
        },
        // Fee to treasury
        {
          amount: feeAmount,
          asset,
          source: `withdrawal:temp:${withdrawalId}`,
          destination: `fees:withdrawal:collected`
        }
      ]
    };
  }
  
  // Crypto Purchase
  static cryptoPurchase(
    userId: string,
    fiatAmount: bigint,
    fiatAsset: string,
    cryptoAmount: bigint,
    cryptoAsset: string,
    exchangeRate: number
  ): TransactionRequest {
    const tradeId = `trade_${Date.now()}`;
    return {
      reference: tradeId,
      metadata: {
        type: 'crypto_purchase',
        user_id: userId,
        exchange_rate: exchangeRate.toString(),
        trade_id: tradeId,
        fiat_amount: fiatAmount.toString(),
        crypto_amount: cryptoAmount.toString(),
        trace_id: `trace_${tradeId}`
      },
      postings: [
        // User pays fiat
        {
          amount: fiatAmount,
          asset: fiatAsset,
          source: `users:${userId}:wallet`,
          destination: `treasury:${fiatAsset.toLowerCase()}:holdings`
        },
        // User receives crypto from liquidity pool
        {
          amount: cryptoAmount,
          asset: cryptoAsset,
          source: `liquidity:${cryptoAsset.toLowerCase()}:pool`,
          destination: `users:${userId}:crypto:${cryptoAsset.toLowerCase()}`
        }
      ]
    };
  }
  
  // Card Payment Processing
  static cardPayment(
    userId: string,
    merchantId: string,
    amount: bigint,
    asset: string,
    cardId: string,
    processingFee: bigint
  ): TransactionRequest {
    const paymentId = `payment_${Date.now()}`;
    return {
      reference: paymentId,
      metadata: {
        type: 'card_payment',
        user_id: userId,
        merchant_id: merchantId,
        card_id: cardId,
        processing_fee: processingFee.toString(),
        payment_id: paymentId,
        trace_id: `trace_${paymentId}`
      },
      postings: [
        // Debit user account
        {
          amount: amount + processingFee,
          asset,
          source: `users:${userId}:wallet`,
          destination: `payment:temp:${paymentId}`
        },
        // Pay merchant
        {
          amount,
          asset,
          source: `payment:temp:${paymentId}`,
          destination: `external:merchant:${merchantId}`
        },
        // Processing fee to system
        {
          amount: processingFee,
          asset,
          source: `payment:temp:${paymentId}`,
          destination: `fees:card_processing:collected`
        }
      ]
    };
  }

  // Business Account Transfer
  static businessTransfer(
    businessId: string,
    fromSubAccount: string,
    toSubAccount: string,
    amount: bigint,
    asset: string,
    purpose: string
  ): TransactionRequest {
    const transferId = `biz_transfer_${Date.now()}`;
    return {
      reference: transferId,
      metadata: {
        type: 'p2p_transfer',
        business_id: businessId,
        from_sub_account: fromSubAccount,
        to_sub_account: toSubAccount,
        purpose,
        trace_id: `trace_${transferId}`
      },
      postings: [
        {
          amount,
          asset,
          source: `business:${businessId}:sub:${fromSubAccount}`,
          destination: `business:${businessId}:sub:${toSubAccount}`
        }
      ]
    };
  }
}