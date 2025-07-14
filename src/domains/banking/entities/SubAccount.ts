import { Entity } from '../../../shared/domain/Entity';

export interface SubAccountProps {
  id: string;
  parentAccountId: string;
  name: string;
  purpose: string;
  address: string; // AccountAddress string representation
  assignedUserId?: string | undefined;
  balance: bigint;
  currency: string;
  permissions: string[];
  limits?: {
    dailyLimit?: bigint | undefined;
    monthlyLimit?: bigint | undefined;
    yearlyLimit?: bigint | undefined;
  } | undefined;
  status: 'active' | 'suspended' | 'closed';
  metadata?: Record<string, any> | undefined;
}

export class SubAccount extends Entity {
  private _parentAccountId: string;
  private _name: string;
  private _purpose: string;
  private _address: string;
  private _assignedUserId?: string | undefined;
  private _balance: bigint;
  private _currency: string;
  private _permissions: string[];
  private _limits?: SubAccountProps['limits'] | undefined;
  private _status: SubAccountProps['status'];
  private _metadata?: Record<string, any> | undefined;

  constructor(props: SubAccountProps) {
    super(props.id);
    this._parentAccountId = props.parentAccountId;
    this._name = props.name;
    this._purpose = props.purpose;
    this._address = props.address;
    this._assignedUserId = props.assignedUserId;
    this._balance = props.balance;
    this._currency = props.currency;
    this._permissions = [...props.permissions];
    this._limits = props.limits ? { ...props.limits } : undefined;
    this._status = props.status;
    this._metadata = props.metadata ? { ...props.metadata } : undefined;
  }

  // Getters
  public get parentAccountId(): string {
    return this._parentAccountId;
  }

  public get name(): string {
    return this._name;
  }

  public get purpose(): string {
    return this._purpose;
  }

  public get address(): { equals: (other: any) => boolean; value: string } {
    return {
      value: this._address,
      equals: (other: any) => other.value === this._address
    };
  }

  public get assignedUserId(): string | undefined {
    return this._assignedUserId;
  }

  public get balance(): bigint {
    return this._balance;
  }

  public get currency(): string {
    return this._currency;
  }

  public get permissions(): string[] {
    return [...this._permissions];
  }

  public get limits(): SubAccountProps['limits'] {
    return this._limits ? { ...this._limits } : undefined;
  }

  public get status(): SubAccountProps['status'] {
    return this._status;
  }

  public get metadata(): Record<string, any> | undefined {
    return this._metadata ? { ...this._metadata } : undefined;
  }

  // Business methods
  public updateBalance(amount: bigint): void {
    this._balance = amount;
    this.updateTimestamp();
  }

  public assignUser(userId: string): void {
    this._assignedUserId = userId;
    this.updateTimestamp();
  }

  public updatePermissions(permissions: string[]): void {
    this._permissions = [...permissions];
    this.updateTimestamp();
  }

  public updateLimits(limits: SubAccountProps['limits']): void {
    this._limits = limits ? { ...limits } : undefined;
    this.updateTimestamp();
  }

  public suspend(): void {
    this._status = 'suspended';
    this.updateTimestamp();
  }

  public activate(): void {
    this._status = 'active';
    this.updateTimestamp();
  }

  public close(): void {
    this._status = 'closed';
    this.updateTimestamp();
  }

  public hasPermission(permission: string): boolean {
    return this._permissions.includes(permission);
  }

  public canWithdraw(amount: bigint): boolean {
    if (this._status !== 'active') return false;
    if (this._balance < amount) return false;
    
    // Check limits if they exist
    if (this._limits?.dailyLimit && amount > this._limits.dailyLimit) {
      return false;
    }
    
    return true;
  }

  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this._parentAccountId.trim()) {
      errors.push('Parent account ID is required');
    }

    if (!this._name.trim()) {
      errors.push('Sub-account name is required');
    }

    if (!this._purpose.trim()) {
      errors.push('Sub-account purpose is required');
    }

    if (!this._currency.trim()) {
      errors.push('Currency is required');
    }

    if (this._balance < 0n) {
      errors.push('Balance cannot be negative');
    }

    if (this._permissions.length === 0) {
      errors.push('At least one permission is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public toJSON(): SubAccountProps {
    return {
      id: this.id,
      parentAccountId: this._parentAccountId,
      name: this._name,
      purpose: this._purpose,
      address: this._address,
      assignedUserId: this._assignedUserId,
      balance: this._balance,
      currency: this._currency,
      permissions: [...this._permissions],
      limits: this._limits ? { ...this._limits } : undefined,
      status: this._status,
      metadata: this._metadata ? { ...this._metadata } : undefined
    };
  }
}