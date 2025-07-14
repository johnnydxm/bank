import { ValueObject } from '../../../shared/domain/ValueObject';

export interface GasOptimizationStrategyProps {
  strategy: 'standard' | 'fast' | 'slow' | 'custom';
  maxGasPrice?: bigint;
  gasLimit?: bigint;
  priorityFee?: bigint;
  batchingEnabled: boolean;
  mevProtection: boolean;
  layer2Preferred: boolean;
  estimatedSavings?: number; // percentage
}

export class GasOptimizationStrategy extends ValueObject<GasOptimizationStrategyProps> {
  constructor(props: GasOptimizationStrategyProps) {
    super(props);
  }

  public get strategy(): GasOptimizationStrategyProps['strategy'] {
    return this._value.strategy;
  }

  public get maxGasPrice(): bigint | undefined {
    return this._value.maxGasPrice;
  }

  public get gasLimit(): bigint | undefined {
    return this._value.gasLimit;
  }

  public get priorityFee(): bigint | undefined {
    return this._value.priorityFee;
  }

  public get batchingEnabled(): boolean {
    return this._value.batchingEnabled;
  }

  public get mevProtection(): boolean {
    return this._value.mevProtection;
  }

  public get layer2Preferred(): boolean {
    return this._value.layer2Preferred;
  }

  public get estimatedSavings(): number | undefined {
    return this._value.estimatedSavings;
  }

  protected validate(): void {
    if (this._value.maxGasPrice !== undefined && this._value.maxGasPrice <= 0n) {
      throw new Error('Max gas price must be positive');
    }

    if (this._value.gasLimit !== undefined && this._value.gasLimit <= 0n) {
      throw new Error('Gas limit must be positive');
    }

    if (this._value.priorityFee !== undefined && this._value.priorityFee < 0n) {
      throw new Error('Priority fee cannot be negative');
    }

    if (this._value.estimatedSavings !== undefined && 
        (this._value.estimatedSavings < 0 || this._value.estimatedSavings > 100)) {
      throw new Error('Estimated savings must be between 0 and 100 percent');
    }
  }

  public isCustomStrategy(): boolean {
    return this._value.strategy === 'custom';
  }

  public isFastStrategy(): boolean {
    return this._value.strategy === 'fast';
  }

  public isSlowStrategy(): boolean {
    return this._value.strategy === 'slow';
  }

  public shouldUseBatching(): boolean {
    return this._value.batchingEnabled;
  }

  public shouldUseLayer2(): boolean {
    return this._value.layer2Preferred;
  }

  public shouldUseMevProtection(): boolean {
    return this._value.mevProtection;
  }

  public calculateEstimatedCost(baseGasPrice: bigint, gasUsage: bigint): bigint {
    const gasPrice = this._value.maxGasPrice && this._value.maxGasPrice < baseGasPrice 
      ? this._value.maxGasPrice 
      : baseGasPrice;

    const priorityFee = this._value.priorityFee || 0n;
    const totalGasPrice = gasPrice + priorityFee;

    return totalGasPrice * gasUsage;
  }

  public static createStandardStrategy(): GasOptimizationStrategy {
    return new GasOptimizationStrategy({
      strategy: 'standard',
      batchingEnabled: true,
      mevProtection: false,
      layer2Preferred: false,
      estimatedSavings: 0
    });
  }

  public static createFastStrategy(): GasOptimizationStrategy {
    return new GasOptimizationStrategy({
      strategy: 'fast',
      batchingEnabled: false,
      mevProtection: true,
      layer2Preferred: false,
      estimatedSavings: -20
    });
  }

  public static createSlowStrategy(): GasOptimizationStrategy {
    return new GasOptimizationStrategy({
      strategy: 'slow',
      batchingEnabled: true,
      mevProtection: false,
      layer2Preferred: true,
      estimatedSavings: 60
    });
  }
}