import { Entity } from '../../../shared/domain/Entity';

export interface VirtualCardProps {
  id: string;
  accountId: string;
  accountAddress: string;
  cardholderName: string;
  cardType: 'debit' | 'credit';
  currency: string;
  dailyLimit: bigint;
  monthlyLimit: bigint;
  yearlyLimit?: bigint | undefined;
  allowedChannels: string[]; // ['atm', 'pos', 'online', 'contactless']
  allowedMerchants?: string[] | undefined;
  blockedMerchants?: string[] | undefined;
  expiryDate: Date;
  isActive: boolean;
  assignedUserId?: string | undefined;
  cardNumber?: string | undefined; // Encrypted/tokenized
  cvv?: string | undefined; // Encrypted
  pin?: string | undefined; // Hashed
  purpose: string;
  usage: {
    dailySpent: bigint;
    monthlySpent: bigint;
    yearlySpent: bigint;
    lastUsed?: Date | undefined;
    transactionCount: number;
  };
  restrictions: {
    geographicRestrictions?: string[] | undefined;
    timeRestrictions?: {
      allowedHours?: { start: string; end: string } | undefined;
      allowedDays?: string[] | undefined;
    } | undefined;
    amountRestrictions?: {
      minAmount?: bigint | undefined;
      maxAmount?: bigint | undefined;
    } | undefined;
  };
  metadata?: Record<string, any> | undefined;
}

export class VirtualCard extends Entity {
  private _accountId: string;
  private _accountAddress: string;
  private _cardholderName: string;
  private _cardType: VirtualCardProps['cardType'];
  private _currency: string;
  private _dailyLimit: bigint;
  private _monthlyLimit: bigint;
  private _yearlyLimit?: bigint | undefined;
  private _allowedChannels: string[];
  private _allowedMerchants?: string[] | undefined;
  private _blockedMerchants?: string[] | undefined;
  private _expiryDate: Date;
  private _isActive: boolean;
  private _assignedUserId?: string | undefined;
  private _cardNumber?: string | undefined;
  private _cvv?: string | undefined;
  private _pin?: string | undefined;
  private _purpose: string;
  private _usage: VirtualCardProps['usage'];
  private _restrictions: VirtualCardProps['restrictions'];
  private _metadata?: Record<string, any> | undefined;

  constructor(props: VirtualCardProps) {
    super(props.id);
    this._accountId = props.accountId;
    this._accountAddress = props.accountAddress;
    this._cardholderName = props.cardholderName;
    this._cardType = props.cardType;
    this._currency = props.currency;
    this._dailyLimit = props.dailyLimit;
    this._monthlyLimit = props.monthlyLimit;
    this._yearlyLimit = props.yearlyLimit;
    this._allowedChannels = [...props.allowedChannels];
    this._allowedMerchants = props.allowedMerchants ? [...props.allowedMerchants] : undefined;
    this._blockedMerchants = props.blockedMerchants ? [...props.blockedMerchants] : undefined;
    this._expiryDate = props.expiryDate;
    this._isActive = props.isActive;
    this._assignedUserId = props.assignedUserId;
    this._cardNumber = props.cardNumber;
    this._cvv = props.cvv;
    this._pin = props.pin;
    this._purpose = props.purpose;
    this._usage = { ...props.usage };
    this._restrictions = { ...props.restrictions };
    this._metadata = props.metadata ? { ...props.metadata } : undefined;
  }

  // Getters
  public get accountId(): string {
    return this._accountId;
  }

  public get accountAddress(): { value: string } {
    return { value: this._accountAddress };
  }

  public get cardholderName(): string {
    return this._cardholderName;
  }

  public get cardType(): VirtualCardProps['cardType'] {
    return this._cardType;
  }

  public get currency(): string {
    return this._currency;
  }

  public get dailyLimit(): bigint {
    return this._dailyLimit;
  }

  public get monthlyLimit(): bigint {
    return this._monthlyLimit;
  }

  public get yearlyLimit(): bigint | undefined {
    return this._yearlyLimit;
  }

  public get allowedChannels(): string[] {
    return [...this._allowedChannels];
  }

  public get allowedMerchants(): string[] | undefined {
    return this._allowedMerchants ? [...this._allowedMerchants] : undefined;
  }

  public get blockedMerchants(): string[] | undefined {
    return this._blockedMerchants ? [...this._blockedMerchants] : undefined;
  }

  public get expiryDate(): Date {
    return this._expiryDate;
  }

  public get isActive(): boolean {
    return this._isActive;
  }

  public get assignedUserId(): string | undefined {
    return this._assignedUserId;
  }

  public get purpose(): string {
    return this._purpose;
  }

  public get usage(): VirtualCardProps['usage'] {
    return { ...this._usage };
  }

  public get restrictions(): VirtualCardProps['restrictions'] {
    return { ...this._restrictions };
  }

  public get metadata(): Record<string, any> | undefined {
    return this._metadata ? { ...this._metadata } : undefined;
  }

  // Business methods
  public activate(): void {
    this._isActive = true;
    this.updateTimestamp();
  }

  public deactivate(): void {
    this._isActive = false;
    this.updateTimestamp();
  }

  public updateLimits(daily: bigint, monthly: bigint, yearly?: bigint): void {
    this._dailyLimit = daily;
    this._monthlyLimit = monthly;
    this._yearlyLimit = yearly;
    this.updateTimestamp();
  }

  public addAllowedMerchant(merchantId: string): void {
    if (!this._allowedMerchants) {
      this._allowedMerchants = [];
    }
    if (!this._allowedMerchants.includes(merchantId)) {
      this._allowedMerchants.push(merchantId);
      this.updateTimestamp();
    }
  }

  public blockMerchant(merchantId: string): void {
    if (!this._blockedMerchants) {
      this._blockedMerchants = [];
    }
    if (!this._blockedMerchants.includes(merchantId)) {
      this._blockedMerchants.push(merchantId);
      this.updateTimestamp();
    }
  }

  public recordTransaction(amount: bigint): void {
    this._usage.dailySpent += amount;
    this._usage.monthlySpent += amount;
    this._usage.yearlySpent += amount;
    this._usage.transactionCount += 1;
    this._usage.lastUsed = new Date();
    this.updateTimestamp();
  }

  public resetDailyUsage(): void {
    this._usage.dailySpent = 0n;
    this.updateTimestamp();
  }

  public resetMonthlyUsage(): void {
    this._usage.monthlySpent = 0n;
    this.updateTimestamp();
  }

  public resetYearlyUsage(): void {
    this._usage.yearlySpent = 0n;
    this.updateTimestamp();
  }

  public canProcessTransaction(amount: bigint, channel: string, merchantId?: string): boolean {
    // Check if card is active and not expired
    if (!this._isActive || this._expiryDate < new Date()) {
      return false;
    }

    // Check channel restrictions
    if (!this._allowedChannels.includes(channel)) {
      return false;
    }

    // Check merchant restrictions
    if (merchantId) {
      if (this._blockedMerchants?.includes(merchantId)) {
        return false;
      }
      if (this._allowedMerchants && !this._allowedMerchants.includes(merchantId)) {
        return false;
      }
    }

    // Check spending limits
    if (this._usage.dailySpent + amount > this._dailyLimit) {
      return false;
    }
    if (this._usage.monthlySpent + amount > this._monthlyLimit) {
      return false;
    }
    if (this._yearlyLimit && this._usage.yearlySpent + amount > this._yearlyLimit) {
      return false;
    }

    // Check amount restrictions
    if (this._restrictions.amountRestrictions) {
      const { minAmount, maxAmount } = this._restrictions.amountRestrictions;
      if (minAmount && amount < minAmount) return false;
      if (maxAmount && amount > maxAmount) return false;
    }

    return true;
  }

  public isExpired(): boolean {
    return this._expiryDate < new Date();
  }

  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this._accountId.trim()) {
      errors.push('Account ID is required');
    }

    if (!this._cardholderName.trim()) {
      errors.push('Cardholder name is required');
    }

    if (!this._currency.trim()) {
      errors.push('Currency is required');
    }

    if (this._dailyLimit <= 0n) {
      errors.push('Daily limit must be positive');
    }

    if (this._monthlyLimit <= 0n) {
      errors.push('Monthly limit must be positive');
    }

    if (this._monthlyLimit < this._dailyLimit) {
      errors.push('Monthly limit cannot be less than daily limit');
    }

    if (this._yearlyLimit && this._yearlyLimit < this._monthlyLimit) {
      errors.push('Yearly limit cannot be less than monthly limit');
    }

    if (this._allowedChannels.length === 0) {
      errors.push('At least one allowed channel is required');
    }

    if (this._expiryDate <= new Date()) {
      errors.push('Expiry date must be in the future');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public toJSON(): Omit<VirtualCardProps, 'cardNumber' | 'cvv' | 'pin'> {
    return {
      id: this.id,
      accountId: this._accountId,
      accountAddress: this._accountAddress,
      cardholderName: this._cardholderName,
      cardType: this._cardType,
      currency: this._currency,
      dailyLimit: this._dailyLimit,
      monthlyLimit: this._monthlyLimit,
      yearlyLimit: this._yearlyLimit,
      allowedChannels: [...this._allowedChannels],
      allowedMerchants: this._allowedMerchants ? [...this._allowedMerchants] : undefined,
      blockedMerchants: this._blockedMerchants ? [...this._blockedMerchants] : undefined,
      expiryDate: this._expiryDate,
      isActive: this._isActive,
      assignedUserId: this._assignedUserId,
      purpose: this._purpose,
      usage: { ...this._usage },
      restrictions: { ...this._restrictions },
      metadata: this._metadata ? { ...this._metadata } : undefined
    };
  }
}