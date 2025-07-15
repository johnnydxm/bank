import { ValueObject } from '../../../shared/domain/ValueObject';

export interface LayerTwoNetworkProps {
  name: string;
  network: string;
  chainId: number;
  parentChain: string;
  type: 'optimistic' | 'zk-rollup' | 'state-channel' | 'sidechain';
  avgGasCost: bigint;
  avgConfirmationTime: number; // seconds
  averageTransferTime: number; // seconds
  withdrawalTime: number; // seconds
  securityScore: number; // 1-10
  tvl: bigint;
  isActive: boolean;
  bridgeContract?: string;
  explorerUrl?: string;
}

export class LayerTwoNetwork extends ValueObject<LayerTwoNetworkProps> {
  constructor(props: LayerTwoNetworkProps) {
    super(props);
  }

  public get name(): string {
    return this._value.name;
  }

  public get network(): string {
    return this._value.network;
  }

  public get chainId(): number {
    return this._value.chainId;
  }

  public get parentChain(): string {
    return this._value.parentChain;
  }

  public get type(): LayerTwoNetworkProps['type'] {
    return this._value.type;
  }

  public get avgGasCost(): bigint {
    return this._value.avgGasCost;
  }

  public get avgConfirmationTime(): number {
    return this._value.avgConfirmationTime;
  }

  public get averageTransferTime(): number {
    return this._value.averageTransferTime;
  }

  public get withdrawalTime(): number {
    return this._value.withdrawalTime;
  }

  public get securityScore(): number {
    return this._value.securityScore;
  }

  public get tvl(): bigint {
    return this._value.tvl;
  }

  public get isActive(): boolean {
    return this._value.isActive;
  }

  public get bridgeContract(): string | undefined {
    return this._value.bridgeContract;
  }

  public get explorerUrl(): string | undefined {
    return this._value.explorerUrl;
  }

  protected validate(): void {
    if (!this._value.name || this._value.name.trim().length === 0) {
      throw new Error('Network name cannot be empty');
    }

    if (!this._value.network || this._value.network.trim().length === 0) {
      throw new Error('Network identifier cannot be empty');
    }

    if (this._value.chainId <= 0) {
      throw new Error('Chain ID must be positive');
    }

    if (!this._value.parentChain || this._value.parentChain.trim().length === 0) {
      throw new Error('Parent chain cannot be empty');
    }

    if (this._value.avgGasCost <= 0n) {
      throw new Error('Average gas cost must be positive');
    }

    if (this._value.avgConfirmationTime <= 0) {
      throw new Error('Average confirmation time must be positive');
    }

    if (this._value.withdrawalTime <= 0) {
      throw new Error('Withdrawal time must be positive');
    }

    if (this._value.securityScore < 1 || this._value.securityScore > 10) {
      throw new Error('Security score must be between 1 and 10');
    }

    if (this._value.tvl < 0n) {
      throw new Error('TVL cannot be negative');
    }

    if (this._value.bridgeContract && this._value.bridgeContract.trim().length === 0) {
      throw new Error('Bridge contract cannot be empty string');
    }

    if (this._value.explorerUrl && this._value.explorerUrl.trim().length === 0) {
      throw new Error('Explorer URL cannot be empty string');
    }
  }

  public isOptimisticRollup(): boolean {
    return this._value.type === 'optimistic';
  }

  public isZkRollup(): boolean {
    return this._value.type === 'zk-rollup';
  }

  public isStateChannel(): boolean {
    return this._value.type === 'state-channel';
  }

  public isSidechain(): boolean {
    return this._value.type === 'sidechain';
  }

  public isHighSecurity(): boolean {
    return this._value.securityScore >= 8;
  }

  public isFastConfirmation(): boolean {
    return this._value.avgConfirmationTime <= 5; // 5 seconds or less
  }

  public isLowCost(): boolean {
    return this._value.avgGasCost <= 1000000n; // Low gas cost threshold
  }

  public isRecommended(): boolean {
    return this._value.isActive && 
           this.isHighSecurity() && 
           this.isFastConfirmation() && 
           this.isLowCost() &&
           this._value.tvl >= 1000000000n; // $1B+ TVL
  }

  public calculateGasSavings(mainnetGasCost: bigint): number {
    if (mainnetGasCost <= this._value.avgGasCost) return 0;
    return Number((mainnetGasCost - this._value.avgGasCost) * 100n / mainnetGasCost);
  }

  public getEfficiencyScore(): number {
    // Composite score based on cost, speed, and security
    const costScore = Math.min(10, 10 - Number(this._value.avgGasCost / 100000n));
    const speedScore = Math.min(10, 10 - this._value.avgConfirmationTime / 10);
    const securityScore = this._value.securityScore;
    
    return (costScore + speedScore + securityScore) / 3;
  }

  // Static network instances
  public static readonly POLYGON = new LayerTwoNetwork({
    name: 'Polygon',
    network: 'polygon',
    chainId: 137,
    parentChain: 'ethereum',
    type: 'sidechain',
    avgGasCost: BigInt(30000000000000),
    avgConfirmationTime: 2,
    averageTransferTime: 5,
    withdrawalTime: 3600,
    securityScore: 8,
    tvl: BigInt(1000000000000),
    isActive: true,
    bridgeContract: '0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf',
    explorerUrl: 'https://polygonscan.com'
  });

  public static readonly ARBITRUM = new LayerTwoNetwork({
    name: 'Arbitrum One',
    network: 'arbitrum',
    chainId: 42161,
    parentChain: 'ethereum',
    type: 'optimistic',
    avgGasCost: BigInt(100000000000000),
    avgConfirmationTime: 1,
    averageTransferTime: 10,
    withdrawalTime: 604800,
    securityScore: 9,
    tvl: BigInt(2000000000000),
    isActive: true,
    bridgeContract: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
    explorerUrl: 'https://arbiscan.io'
  });

  public static readonly OPTIMISM = new LayerTwoNetwork({
    name: 'Optimism',
    network: 'optimism',
    chainId: 10,
    parentChain: 'ethereum',
    type: 'optimistic',
    avgGasCost: BigInt(200000000000000),
    avgConfirmationTime: 2,
    averageTransferTime: 15,
    withdrawalTime: 604800,
    securityScore: 9,
    tvl: BigInt(1500000000000),
    isActive: true,
    bridgeContract: '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1',
    explorerUrl: 'https://optimistic.etherscan.io'
  });

  public static readonly BASE = new LayerTwoNetwork({
    name: 'Base',
    network: 'base',
    chainId: 8453,
    parentChain: 'ethereum',
    type: 'optimistic',
    avgGasCost: BigInt(150000000000000),
    avgConfirmationTime: 2,
    averageTransferTime: 12,
    withdrawalTime: 604800,
    securityScore: 8,
    tvl: BigInt(800000000000),
    isActive: true,
    bridgeContract: '0x3154Cf16ccdb4C6d922629664174b904d80F2C35',
    explorerUrl: 'https://basescan.org'
  });
}