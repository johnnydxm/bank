import { ValueObject } from '../../../shared/domain/ValueObject';

export interface DeFiProtocolProps {
  name: string;
  protocol: string;
  network: string;
  contractAddress?: string;
  apy?: number;
  tvl?: bigint;
  riskLevel: 'low' | 'medium' | 'high';
  category: 'lending' | 'dex' | 'staking' | 'yield-farming' | 'bridge' | 'other';
}

export class DeFiProtocol extends ValueObject<DeFiProtocolProps> {
  constructor(props: DeFiProtocolProps) {
    super(props);
  }

  public get name(): string {
    return this._value.name;
  }

  public get protocol(): string {
    return this._value.protocol;
  }

  public get network(): string {
    return this._value.network;
  }

  public get contractAddress(): string | undefined {
    return this._value.contractAddress;
  }

  public get apy(): number | undefined {
    return this._value.apy;
  }

  public get tvl(): bigint | undefined {
    return this._value.tvl;
  }

  public get riskLevel(): DeFiProtocolProps['riskLevel'] {
    return this._value.riskLevel;
  }

  public get category(): DeFiProtocolProps['category'] {
    return this._value.category;
  }

  protected validate(): void {
    if (!this._value.name || this._value.name.trim().length === 0) {
      throw new Error('Protocol name cannot be empty');
    }

    if (!this._value.protocol || this._value.protocol.trim().length === 0) {
      throw new Error('Protocol identifier cannot be empty');
    }

    if (!this._value.network || this._value.network.trim().length === 0) {
      throw new Error('Network cannot be empty');
    }

    if (this._value.apy !== undefined && (this._value.apy < 0 || this._value.apy > 1000)) {
      throw new Error('APY must be between 0 and 1000 percent');
    }

    if (this._value.tvl !== undefined && this._value.tvl < 0n) {
      throw new Error('TVL cannot be negative');
    }

    if (this._value.contractAddress && this._value.contractAddress.trim().length === 0) {
      throw new Error('Contract address cannot be empty string');
    }
  }

  public isHighRisk(): boolean {
    return this._value.riskLevel === 'high';
  }

  public isLowRisk(): boolean {
    return this._value.riskLevel === 'low';
  }

  public isLendingProtocol(): boolean {
    return this._value.category === 'lending';
  }

  public isDexProtocol(): boolean {
    return this._value.category === 'dex';
  }

  public isStakingProtocol(): boolean {
    return this._value.category === 'staking';
  }

  public calculateExpectedReturn(amount: bigint, days: number): bigint {
    if (!this._value.apy) return 0n;
    
    const dailyRate = this._value.apy / 365 / 100;
    const multiplier = BigInt(Math.floor((1 + dailyRate) ** days * 10000));
    return (amount * multiplier) / 10000n - amount;
  }

  public supportsAsset(asset: any): boolean {
    // In a real implementation, this would check if the protocol supports the specific asset
    return true;
  }

  public supportsLayer2(): boolean {
    // Check if protocol supports Layer 2 networks
    return this._value.network !== 'ethereum' || this._value.category === 'bridge';
  }
}