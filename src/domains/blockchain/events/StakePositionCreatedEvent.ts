import { BaseDomainEvent } from '../../../shared/domain/DomainEvent';

export interface StakePositionCreatedEventData {
  positionId: string;
  walletId: string;
  assetSymbol: string;
  stakedAmount: bigint;
  protocol: string;
  network: string;
  apy: number;
  lockPeriod?: number;
  validatorId?: string;
  poolId?: string;
  riskLevel: 'low' | 'medium' | 'high';
  autoCompound: boolean;
  estimatedAnnualRewards: bigint;
  transactionHash?: string;
  createdBy: string;
}

export class StakePositionCreatedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    eventData: StakePositionCreatedEventData,
    metadata?: Record<string, any>
  ) {
    super(
      'StakePositionCreated',
      aggregateId,
      'CryptoWalletAggregate',
      eventData,
      metadata,
      '1.0.0'
    );
  }

  public get positionId(): string {
    return this.eventData.positionId;
  }

  public get walletId(): string {
    return this.eventData.walletId;
  }

  public get assetSymbol(): string {
    return this.eventData.assetSymbol;
  }

  public get stakedAmount(): bigint {
    return this.eventData.stakedAmount;
  }

  public get protocol(): string {
    return this.eventData.protocol;
  }

  public get network(): string {
    return this.eventData.network;
  }

  public get apy(): number {
    return this.eventData.apy;
  }

  public get lockPeriod(): number | undefined {
    return this.eventData.lockPeriod;
  }

  public get validatorId(): string | undefined {
    return this.eventData.validatorId;
  }

  public get poolId(): string | undefined {
    return this.eventData.poolId;
  }

  public get riskLevel(): StakePositionCreatedEventData['riskLevel'] {
    return this.eventData.riskLevel;
  }

  public get autoCompound(): boolean {
    return this.eventData.autoCompound;
  }

  public get estimatedAnnualRewards(): bigint {
    return this.eventData.estimatedAnnualRewards;
  }

  public get transactionHash(): string | undefined {
    return this.eventData.transactionHash;
  }

  public get createdBy(): string {
    return this.eventData.createdBy;
  }
}