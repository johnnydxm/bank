import { Entity } from '../../../shared/domain/Entity';

export interface CryptoAssetProps {
  id: string;
  symbol: string;
  name: string;
  network: string;
  contractAddress?: string | undefined;
  decimals: number;
  balance: bigint;
  lockedBalance: bigint;
  stakingBalance: bigint;
  currentPrice: number; // in USD
  priceChange24h: number; // percentage
  lastUpdated: Date;
  isStablecoin: boolean;
  isNative: boolean; // ETH on Ethereum, BTC on Bitcoin, etc.
  metadata?: {
    logoUrl?: string | undefined;
    description?: string | undefined;
    website?: string | undefined;
    coingeckoId?: string | undefined;
    marketCap?: number | undefined;
    volume24h?: number | undefined;
  } | undefined;
}

export class CryptoAsset extends Entity {
  private _symbol: string;
  private _name: string;
  private _network: string;
  private _contractAddress?: string;
  private _decimals: number;
  private _balance: bigint;
  private _lockedBalance: bigint;
  private _stakingBalance: bigint;
  private _currentPrice: number;
  private _priceChange24h: number;
  private _lastUpdated: Date;
  private _isStablecoin: boolean;
  private _isNative: boolean;
  private _metadata?: CryptoAssetProps['metadata'];

  constructor(props: CryptoAssetProps) {
    super(props.id);
    this._symbol = props.symbol;
    this._name = props.name;
    this._network = props.network;
    this._contractAddress = props.contractAddress;
    this._decimals = props.decimals;
    this._balance = props.balance;
    this._lockedBalance = props.lockedBalance;
    this._stakingBalance = props.stakingBalance;
    this._currentPrice = props.currentPrice;
    this._priceChange24h = props.priceChange24h;
    this._lastUpdated = props.lastUpdated;
    this._isStablecoin = props.isStablecoin;
    this._isNative = props.isNative;
    this._metadata = props.metadata ? { ...props.metadata } : undefined;
  }

  // Getters
  public get symbol(): string {
    return this._symbol;
  }

  public get name(): string {
    return this._name;
  }

  public get network(): string {
    return this._network;
  }

  public get contractAddress(): string | undefined {
    return this._contractAddress;
  }

  public get decimals(): number {
    return this._decimals;
  }

  public get balance(): bigint {
    return this._balance;
  }

  public get lockedBalance(): bigint {
    return this._lockedBalance;
  }

  public get stakingBalance(): bigint {
    return this._stakingBalance;
  }

  public get currentPrice(): number {
    return this._currentPrice;
  }

  public get priceChange24h(): number {
    return this._priceChange24h;
  }

  public get lastUpdated(): Date {
    return this._lastUpdated;
  }

  public get isStablecoin(): boolean {
    return this._isStablecoin;
  }

  public get isNative(): boolean {
    return this._isNative;
  }

  public get metadata(): CryptoAssetProps['metadata'] {
    return this._metadata ? { ...this._metadata } : undefined;
  }

  // Business methods
  public getTotalBalance(): bigint {
    return this._balance + this._lockedBalance + this._stakingBalance;
  }

  public getAvailableBalance(): bigint {
    return this._balance;
  }

  public getUsdValue(): number {
    const totalBalance = this.getTotalBalance();
    const divisor = 10n ** BigInt(this._decimals);
    const balanceAsFloat = Number(totalBalance) / Number(divisor);
    return balanceAsFloat * this._currentPrice;
  }

  public getAvailableUsdValue(): number {
    const divisor = 10n ** BigInt(this._decimals);
    const balanceAsFloat = Number(this._balance) / Number(divisor);
    return balanceAsFloat * this._currentPrice;
  }

  public updateBalance(newBalance: bigint): void {
    if (newBalance < 0n) {
      throw new Error('Balance cannot be negative');
    }
    this._balance = newBalance;
    this.updateTimestamp();
  }

  public updatePrice(price: number, priceChange24h: number): void {
    if (price < 0) {
      throw new Error('Price cannot be negative');
    }
    this._currentPrice = price;
    this._priceChange24h = priceChange24h;
    this._lastUpdated = new Date();
    this.updateTimestamp();
  }

  public lockBalance(amount: bigint): void {
    if (amount <= 0n) {
      throw new Error('Lock amount must be positive');
    }
    if (this._balance < amount) {
      throw new Error('Insufficient available balance to lock');
    }
    this._balance -= amount;
    this._lockedBalance += amount;
    this.updateTimestamp();
  }

  public unlockBalance(amount: bigint): void {
    if (amount <= 0n) {
      throw new Error('Unlock amount must be positive');
    }
    if (this._lockedBalance < amount) {
      throw new Error('Insufficient locked balance to unlock');
    }
    this._lockedBalance -= amount;
    this._balance += amount;
    this.updateTimestamp();
  }

  public stakeBalance(amount: bigint): void {
    if (amount <= 0n) {
      throw new Error('Stake amount must be positive');
    }
    if (this._balance < amount) {
      throw new Error('Insufficient available balance to stake');
    }
    this._balance -= amount;
    this._stakingBalance += amount;
    this.updateTimestamp();
  }

  public unstakeBalance(amount: bigint): void {
    if (amount <= 0n) {
      throw new Error('Unstake amount must be positive');
    }
    if (this._stakingBalance < amount) {
      throw new Error('Insufficient staking balance to unstake');
    }
    this._stakingBalance -= amount;
    this._balance += amount;
    this.updateTimestamp();
  }

  public canTransfer(amount: bigint): boolean {
    return this._balance >= amount && amount > 0n;
  }

  public transfer(amount: bigint): void {
    if (!this.canTransfer(amount)) {
      throw new Error('Insufficient balance for transfer');
    }
    this._balance -= amount;
    this.updateTimestamp();
  }

  public receive(amount: bigint): void {
    if (amount <= 0n) {
      throw new Error('Receive amount must be positive');
    }
    this._balance += amount;
    this.updateTimestamp();
  }

  public isPriceStale(maxAgeMinutes: number = 15): boolean {
    const now = new Date();
    const diffMinutes = (now.getTime() - this._lastUpdated.getTime()) / (1000 * 60);
    return diffMinutes > maxAgeMinutes;
  }

  public isPricePositive(): boolean {
    return this._priceChange24h > 0;
  }

  public getPriceChangeDirection(): 'up' | 'down' | 'neutral' {
    if (this._priceChange24h > 0.1) return 'up';
    if (this._priceChange24h < -0.1) return 'down';
    return 'neutral';
  }

  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this._symbol || this._symbol.trim().length === 0) {
      errors.push('Symbol is required');
    }

    if (!this._name || this._name.trim().length === 0) {
      errors.push('Name is required');
    }

    if (!this._network || this._network.trim().length === 0) {
      errors.push('Network is required');
    }

    if (this._decimals < 0 || this._decimals > 18) {
      errors.push('Decimals must be between 0 and 18');
    }

    if (this._balance < 0n) {
      errors.push('Balance cannot be negative');
    }

    if (this._lockedBalance < 0n) {
      errors.push('Locked balance cannot be negative');
    }

    if (this._stakingBalance < 0n) {
      errors.push('Staking balance cannot be negative');
    }

    if (this._currentPrice < 0) {
      errors.push('Current price cannot be negative');
    }

    if (this._contractAddress && this._contractAddress.trim().length === 0) {
      errors.push('Contract address cannot be empty string');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public toJSON(): CryptoAssetProps {
    return {
      id: this.id,
      symbol: this._symbol,
      name: this._name,
      network: this._network,
      contractAddress: this._contractAddress,
      decimals: this._decimals,
      balance: this._balance,
      lockedBalance: this._lockedBalance,
      stakingBalance: this._stakingBalance,
      currentPrice: this._currentPrice,
      priceChange24h: this._priceChange24h,
      lastUpdated: this._lastUpdated,
      isStablecoin: this._isStablecoin,
      isNative: this._isNative,
      metadata: this._metadata ? { ...this._metadata } : undefined
    };
  }
}