import { ValueObject } from '../../../shared/domain/ValueObject';

export interface SwapRouteProps {
  fromToken: string;
  toToken: string;
  fromNetwork: string;
  toNetwork: string;
  route: Array<{
    protocol: string;
    poolAddress: string;
    fee: number;
    slippage: number;
  }>;
  estimatedGas: bigint;
  estimatedTime: number; // seconds
  priceImpact: number; // percentage
  minimumReceived: bigint;
}

export class SwapRoute extends ValueObject<SwapRouteProps> {
  constructor(props: SwapRouteProps) {
    super(props);
  }

  public get fromToken(): string {
    return this._value.fromToken;
  }

  public get toToken(): string {
    return this._value.toToken;
  }

  public get fromNetwork(): string {
    return this._value.fromNetwork;
  }

  public get toNetwork(): string {
    return this._value.toNetwork;
  }

  public get route(): SwapRouteProps['route'] {
    return [...this._value.route];
  }

  public get estimatedGas(): bigint {
    return this._value.estimatedGas;
  }

  public get estimatedTime(): number {
    return this._value.estimatedTime;
  }

  public get priceImpact(): number {
    return this._value.priceImpact;
  }

  public get minimumReceived(): bigint {
    return this._value.minimumReceived;
  }

  protected validate(): void {
    if (!this._value.fromToken || this._value.fromToken.trim().length === 0) {
      throw new Error('From token cannot be empty');
    }

    if (!this._value.toToken || this._value.toToken.trim().length === 0) {
      throw new Error('To token cannot be empty');
    }

    if (this._value.fromToken === this._value.toToken && this._value.fromNetwork === this._value.toNetwork) {
      throw new Error('Cannot swap same token on same network');
    }

    if (!this._value.fromNetwork || this._value.fromNetwork.trim().length === 0) {
      throw new Error('From network cannot be empty');
    }

    if (!this._value.toNetwork || this._value.toNetwork.trim().length === 0) {
      throw new Error('To network cannot be empty');
    }

    if (this._value.route.length === 0) {
      throw new Error('Route cannot be empty');
    }

    if (this._value.estimatedGas <= 0n) {
      throw new Error('Estimated gas must be positive');
    }

    if (this._value.estimatedTime <= 0) {
      throw new Error('Estimated time must be positive');
    }

    if (this._value.priceImpact < 0 || this._value.priceImpact > 100) {
      throw new Error('Price impact must be between 0 and 100 percent');
    }

    if (this._value.minimumReceived <= 0n) {
      throw new Error('Minimum received must be positive');
    }

    // Validate route steps
    for (const step of this._value.route) {
      if (!step.protocol || step.protocol.trim().length === 0) {
        throw new Error('Route step protocol cannot be empty');
      }
      if (!step.poolAddress || step.poolAddress.trim().length === 0) {
        throw new Error('Route step pool address cannot be empty');
      }
      if (step.fee < 0 || step.fee > 10) {
        throw new Error('Route step fee must be between 0 and 10 percent');
      }
      if (step.slippage < 0 || step.slippage > 50) {
        throw new Error('Route step slippage must be between 0 and 50 percent');
      }
    }
  }

  public isCrossChain(): boolean {
    return this._value.fromNetwork !== this._value.toNetwork;
  }

  public hasHighPriceImpact(): boolean {
    return this._value.priceImpact > 5; // More than 5%
  }

  public getRouteLength(): number {
    return this._value.route.length;
  }

  public getTotalFees(): number {
    return this._value.route.reduce((total, step) => total + step.fee, 0);
  }

  public getMaxSlippage(): number {
    return Math.max(...this._value.route.map(step => step.slippage));
  }

  public isOptimal(): boolean {
    return this._value.priceImpact < 1 && this.getTotalFees() < 0.5;
  }
}