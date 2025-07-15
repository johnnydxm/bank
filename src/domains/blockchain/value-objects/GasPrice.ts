import { ValueObject } from '../../../shared/domain/ValueObject';

export interface GasPriceProps {
  readonly price: bigint;
  readonly standard: bigint;
  readonly fast: bigint;
  readonly instant: bigint;
  readonly network: string;
  readonly lastUpdated: Date;
}

export class GasPrice extends ValueObject<GasPriceProps> {
  get price(): bigint {
    return this._value.price;
  }

  get standard(): bigint {
    return this._value.standard;
  }

  get fast(): bigint {
    return this._value.fast;
  }

  get instant(): bigint {
    return this._value.instant;
  }

  get network(): string {
    return this._value.network;
  }

  get lastUpdated(): Date {
    return this._value.lastUpdated;
  }

  protected validate(): void {
    if (this._value.price <= 0n) {
      throw new Error('Gas price must be positive');
    }
    if (this._value.standard <= 0n) {
      throw new Error('Standard gas price must be positive');
    }
    if (this._value.fast <= 0n) {
      throw new Error('Fast gas price must be positive');
    }
    if (this._value.instant <= 0n) {
      throw new Error('Instant gas price must be positive');
    }
  }

  constructor(priceOrProps: bigint | GasPriceProps) {
    if (typeof priceOrProps === 'bigint') {
      super({
        price: priceOrProps,
        standard: priceOrProps,
        fast: priceOrProps * 120n / 100n,
        instant: priceOrProps * 150n / 100n,
        network: 'ethereum',
        lastUpdated: new Date()
      });
    } else {
      super(priceOrProps);
    }
  }

  public static create(props: GasPriceProps): GasPrice {
    return new GasPrice(props);
  }

  public static ethereum(standard: bigint, fast: bigint, instant: bigint): GasPrice {
    return new GasPrice({
      price: standard,
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