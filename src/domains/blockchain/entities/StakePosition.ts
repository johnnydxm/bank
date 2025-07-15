import { Entity } from '../../../shared/domain/Entity';

export interface StakePositionProps {
  id: string;
  assetId: string;
  protocol: string;
  network: string;
  stakedAmount: bigint;
  rewardsEarned: bigint;
  apy: number;
  startDate: Date;
  lockPeriod?: number | undefined; // days
  unstakeDate?: Date | undefined;
  status: 'active' | 'unstaking' | 'completed' | 'slashed';
  validatorId?: string | undefined;
  poolId?: string | undefined;
  riskLevel: 'low' | 'medium' | 'high';
  metadata?: {
    autoCompound?: boolean | undefined;
    delegatorAddress?: string | undefined;
    contractAddress?: string | undefined;
    minimumStake?: bigint | undefined;
    slashingRisk?: number | undefined;
  } | undefined;
}

export class StakePosition extends Entity {
  private _assetId: string;
  private _protocol: string;
  private _network: string;
  private _stakedAmount: bigint;
  private _rewardsEarned: bigint;
  private _apy: number;
  private _startDate: Date;
  private _lockPeriod?: number | undefined;
  private _unstakeDate?: Date | undefined;
  private _status: StakePositionProps['status'];
  private _validatorId?: string | undefined;
  private _poolId?: string | undefined;
  private _riskLevel: StakePositionProps['riskLevel'];
  private _metadata?: StakePositionProps['metadata'];

  constructor(props: StakePositionProps) {
    super(props.id);
    this._assetId = props.assetId;
    this._protocol = props.protocol;
    this._network = props.network;
    this._stakedAmount = props.stakedAmount;
    this._rewardsEarned = props.rewardsEarned;
    this._apy = props.apy;
    this._startDate = props.startDate;
    this._lockPeriod = props.lockPeriod;
    this._unstakeDate = props.unstakeDate;
    this._status = props.status;
    this._validatorId = props.validatorId;
    this._poolId = props.poolId;
    this._riskLevel = props.riskLevel;
    this._metadata = props.metadata ? { ...props.metadata } : undefined;
  }

  // Getters
  public get assetId(): string {
    return this._assetId;
  }

  public get protocol(): string {
    return this._protocol;
  }

  public get network(): string {
    return this._network;
  }

  public get stakedAmount(): bigint {
    return this._stakedAmount;
  }

  public get rewardsEarned(): bigint {
    return this._rewardsEarned;
  }

  public get apy(): number {
    return this._apy;
  }

  public get startDate(): Date {
    return this._startDate;
  }

  public get lockPeriod(): number | undefined {
    return this._lockPeriod;
  }

  public get unstakeDate(): Date | undefined {
    return this._unstakeDate;
  }

  public get status(): StakePositionProps['status'] {
    return this._status;
  }

  public get validatorId(): string | undefined {
    return this._validatorId;
  }

  public get poolId(): string | undefined {
    return this._poolId;
  }

  public get riskLevel(): StakePositionProps['riskLevel'] {
    return this._riskLevel;
  }

  public get metadata(): StakePositionProps['metadata'] {
    return this._metadata ? { ...this._metadata } : undefined;
  }

  // Business methods
  public getTotalValue(): bigint {
    return this._stakedAmount + this._rewardsEarned;
  }

  public getDaysStaked(): number {
    const now = new Date();
    const diffTime = now.getTime() - this._startDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  public getEstimatedAnnualRewards(): bigint {
    const stakingValue = this._stakedAmount;
    const apyMultiplier = BigInt(Math.floor(this._apy * 100));
    return (stakingValue * apyMultiplier) / 10000n;
  }

  public getEstimatedDailyRewards(): bigint {
    return this.getEstimatedAnnualRewards() / 365n;
  }

  public addRewards(amount: bigint): void {
    if (amount <= 0n) {
      throw new Error('Reward amount must be positive');
    }
    this._rewardsEarned += amount;
    this.updateTimestamp();
  }

  public compound(amount: bigint): void {
    if (amount <= 0n) {
      throw new Error('Compound amount must be positive');
    }
    if (amount > this._rewardsEarned) {
      throw new Error('Cannot compound more than earned rewards');
    }
    this._rewardsEarned -= amount;
    this._stakedAmount += amount;
    this.updateTimestamp();
  }

  public initiateUnstake(): void {
    if (this._status !== 'active') {
      throw new Error('Can only unstake from active position');
    }
    
    this._status = 'unstaking';
    this._unstakeDate = new Date();
    
    // If there's a lock period, add it to the unstake date
    if (this._lockPeriod) {
      this._unstakeDate.setDate(this._unstakeDate.getDate() + this._lockPeriod);
    }
    
    this.updateTimestamp();
  }

  public completeUnstake(): void {
    if (this._status !== 'unstaking') {
      throw new Error('Position is not in unstaking status');
    }
    
    if (this._unstakeDate && this._unstakeDate > new Date()) {
      throw new Error('Unstaking period has not ended yet');
    }
    
    this._status = 'completed';
    this.updateTimestamp();
  }

  public slash(amount: bigint, reason: string): void {
    if (amount <= 0n) {
      throw new Error('Slash amount must be positive');
    }
    if (amount > this._stakedAmount) {
      throw new Error('Cannot slash more than staked amount');
    }
    
    this._stakedAmount -= amount;
    this._status = 'slashed';
    
    if (!this._metadata) {
      this._metadata = {};
    }
    this._metadata.slashingRisk = Number(amount * 100n / (this._stakedAmount + amount));
    
    this.updateTimestamp();
  }

  public updateApy(newApy: number): void {
    if (newApy < 0 || newApy > 1000) {
      throw new Error('APY must be between 0 and 1000 percent');
    }
    this._apy = newApy;
    this.updateTimestamp();
  }

  public canUnstake(): boolean {
    if (this._status !== 'active') return false;
    
    // Check if lock period has passed
    if (this._lockPeriod) {
      const lockEndDate = new Date(this._startDate);
      lockEndDate.setDate(lockEndDate.getDate() + this._lockPeriod);
      return new Date() >= lockEndDate;
    }
    
    return true;
  }

  public isLocked(): boolean {
    if (!this._lockPeriod) return false;
    
    const lockEndDate = new Date(this._startDate);
    lockEndDate.setDate(lockEndDate.getDate() + this._lockPeriod);
    return new Date() < lockEndDate;
  }

  public getRemainingLockDays(): number {
    if (!this.isLocked()) return 0;
    
    const lockEndDate = new Date(this._startDate);
    lockEndDate.setDate(lockEndDate.getDate() + this._lockPeriod!);
    const diffTime = lockEndDate.getTime() - new Date().getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  public isHighRisk(): boolean {
    return this._riskLevel === 'high';
  }

  public isActive(): boolean {
    return this._status === 'active';
  }

  public isUnstaking(): boolean {
    return this._status === 'unstaking';
  }

  public isCompleted(): boolean {
    return this._status === 'completed';
  }

  public isSlashed(): boolean {
    return this._status === 'slashed';
  }

  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this._assetId || this._assetId.trim().length === 0) {
      errors.push('Asset ID is required');
    }

    if (!this._protocol || this._protocol.trim().length === 0) {
      errors.push('Protocol is required');
    }

    if (!this._network || this._network.trim().length === 0) {
      errors.push('Network is required');
    }

    if (this._stakedAmount <= 0n) {
      errors.push('Staked amount must be positive');
    }

    if (this._rewardsEarned < 0n) {
      errors.push('Rewards earned cannot be negative');
    }

    if (this._apy < 0 || this._apy > 1000) {
      errors.push('APY must be between 0 and 1000 percent');
    }

    if (this._startDate > new Date()) {
      errors.push('Start date cannot be in the future');
    }

    if (this._lockPeriod !== undefined && this._lockPeriod < 0) {
      errors.push('Lock period cannot be negative');
    }

    if (this._unstakeDate && this._unstakeDate < this._startDate) {
      errors.push('Unstake date cannot be before start date');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public async getCurrentValue(priceService: any): Promise<bigint> {
    // Calculate current value based on staked amount + rewards
    return this._stakedAmount + this._rewardsEarned;
  }

  public static generateId(): string {
    return `stake_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public toJSON(): StakePositionProps {
    return {
      id: this.id,
      assetId: this._assetId,
      protocol: this._protocol,
      network: this._network,
      stakedAmount: this._stakedAmount,
      rewardsEarned: this._rewardsEarned,
      apy: this._apy,
      startDate: this._startDate,
      lockPeriod: this._lockPeriod,
      unstakeDate: this._unstakeDate,
      status: this._status,
      validatorId: this._validatorId,
      poolId: this._poolId,
      riskLevel: this._riskLevel,
      metadata: this._metadata ? { ...this._metadata } : undefined
    };
  }
}