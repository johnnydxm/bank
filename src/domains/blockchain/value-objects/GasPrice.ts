import { ValueObject } from '../../../shared/domain/ValueObject';

export interface GasPriceProps {
  readonly standard: bigint;
  readonly fast: bigint;
  readonly instant: bigint;
  readonly network: string;
  readonly lastUpdated: Date;
}

export class GasPrice extends ValueObject<GasPriceProps> {
  get standard(): bigint {
    return this.props.standard;
  }

  get fast(): bigint {
    return this.props.fast;
  }

  get instant(): bigint {
    return this.props.instant;
  }

  get network(): string {
    return this.props.network;
  }

  get lastUpdated(): Date {
    return this.props.lastUpdated;
  }

  public static create(props: GasPriceProps): GasPrice {
    return new GasPrice(props);
  }

  public static ethereum(standard: bigint, fast: bigint, instant: bigint): GasPrice {
    return new GasPrice({
      standard,
      fast,
      instant,
      network: 'ethereum',
      lastUpdated: new Date()
    });
  }

  public isStale(maxAgeMinutes: number = 5): boolean {
    const now = new Date();
    const ageMinutes = (now.getTime() - this.lastUpdated.getTime()) / (1000 * 60);
    return ageMinutes > maxAgeMinutes;
  }

  public getRecommendedPrice(priority: 'standard' | 'fast' | 'instant' = 'fast'): bigint {
    switch (priority) {
      case 'standard': return this.standard;
      case 'fast': return this.fast;
      case 'instant': return this.instant;
      default: return this.fast;
    }
  }
}