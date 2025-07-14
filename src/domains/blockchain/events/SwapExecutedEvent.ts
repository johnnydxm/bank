import { BaseDomainEvent } from '../../../shared/domain/DomainEvent';

export interface SwapExecutedEventData {
  swapId: string;
  walletId: string;
  fromAsset: string;
  toAsset: string;
  fromAmount: bigint;
  toAmount: bigint;
  fromNetwork: string;
  toNetwork: string;
  exchangeRate: number;
  priceImpact: number;
  gasFee: bigint;
  protocolFee: bigint;
  slippage: number;
  route: Array<{
    protocol: string;
    poolAddress: string;
    fee: number;
  }>;
  transactionHash: string;
  blockNumber?: number;
  executedBy: string;
  executionTime: number; // milliseconds
  metadata?: {
    aggregator?: string;
    referralCode?: string;
    isArbitrage?: boolean;
    mevProtected?: boolean;
  };
}

export class SwapExecutedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    eventData: SwapExecutedEventData,
    metadata?: Record<string, any>
  ) {
    super(
      'SwapExecuted',
      aggregateId,
      'CryptoWalletAggregate',
      eventData,
      metadata,
      '1.0.0'
    );
  }

  public get swapId(): string {
    return this.eventData.swapId;
  }

  public get walletId(): string {
    return this.eventData.walletId;
  }

  public get fromAsset(): string {
    return this.eventData.fromAsset;
  }

  public get toAsset(): string {
    return this.eventData.toAsset;
  }

  public get fromAmount(): bigint {
    return this.eventData.fromAmount;
  }

  public get toAmount(): bigint {
    return this.eventData.toAmount;
  }

  public get fromNetwork(): string {
    return this.eventData.fromNetwork;
  }

  public get toNetwork(): string {
    return this.eventData.toNetwork;
  }

  public get exchangeRate(): number {
    return this.eventData.exchangeRate;
  }

  public get priceImpact(): number {
    return this.eventData.priceImpact;
  }

  public get gasFee(): bigint {
    return this.eventData.gasFee;
  }

  public get protocolFee(): bigint {
    return this.eventData.protocolFee;
  }

  public get slippage(): number {
    return this.eventData.slippage;
  }

  public get route(): SwapExecutedEventData['route'] {
    return this.eventData.route;
  }

  public get transactionHash(): string {
    return this.eventData.transactionHash;
  }

  public get blockNumber(): number | undefined {
    return this.eventData.blockNumber;
  }

  public get executedBy(): string {
    return this.eventData.executedBy;
  }

  public get executionTime(): number {
    return this.eventData.executionTime;
  }

  public get aggregator(): string | undefined {
    return this.eventData.metadata?.aggregator;
  }

  public get referralCode(): string | undefined {
    return this.eventData.metadata?.referralCode;
  }

  public get isArbitrage(): boolean | undefined {
    return this.eventData.metadata?.isArbitrage;
  }

  public get mevProtected(): boolean | undefined {
    return this.eventData.metadata?.mevProtected;
  }

  public getTotalFees(): bigint {
    return this.eventData.gasFee + this.eventData.protocolFee;
  }

  public isCrossChain(): boolean {
    return this.eventData.fromNetwork !== this.eventData.toNetwork;
  }

  public hasHighPriceImpact(): boolean {
    return this.eventData.priceImpact > 5; // More than 5%
  }

  public hasHighSlippage(): boolean {
    return this.eventData.slippage > 1; // More than 1%
  }
}