import { ValueObject } from '../../../shared/domain/ValueObject';

export interface PermissionSetProps {
  permissions: string[];
  scope: 'business' | 'sub-account' | 'card' | 'global';
  expiresAt?: Date | undefined;
  grantedBy: string;
  grantedAt: Date;
}

export class PermissionSet extends ValueObject<PermissionSetProps> {
  // Standard permission constants
  public static readonly MANAGE_SUB_ACCOUNTS = 'manage:sub-accounts';
  public static readonly ISSUE_VIRTUAL_CARDS = 'issue:virtual-cards';
  public static readonly VIEW_TRANSACTIONS = 'view:transactions';
  public static readonly APPROVE_TRANSACTIONS = 'approve:transactions';
  public static readonly MANAGE_LIMITS = 'manage:limits';
  public static readonly MANAGE_USERS = 'manage:users';
  public static readonly VIEW_ANALYTICS = 'view:analytics';
  public static readonly ADMIN_ACCESS = 'admin:access';

  constructor(props: PermissionSetProps) {
    super(props);
  }

  public get permissions(): string[] {
    return [...this._value.permissions];
  }

  public get scope(): PermissionSetProps['scope'] {
    return this._value.scope;
  }

  public get expiresAt(): Date | undefined {
    return this._value.expiresAt;
  }

  public get grantedBy(): string {
    return this._value.grantedBy;
  }

  public get grantedAt(): Date {
    return this._value.grantedAt;
  }

  protected validate(): void {
    if (!this._value.permissions || this._value.permissions.length === 0) {
      throw new Error('At least one permission is required');
    }

    if (!this._value.grantedBy || this._value.grantedBy.trim().length === 0) {
      throw new Error('GrantedBy is required');
    }

    if (this._value.grantedAt > new Date()) {
      throw new Error('GrantedAt cannot be in the future');
    }

    if (this._value.expiresAt && this._value.expiresAt <= this._value.grantedAt) {
      throw new Error('ExpiresAt must be after grantedAt');
    }

    // Validate permission format
    for (const permission of this._value.permissions) {
      if (!permission || permission.trim().length === 0) {
        throw new Error('Permission cannot be empty');
      }
      if (!permission.includes(':')) {
        throw new Error('Permission must follow format "action:resource"');
      }
    }
  }

  public hasPermission(permission: string): boolean {
    return this._value.permissions.includes(permission);
  }

  public hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  public hasAllPermissions(permissions: string[]): boolean {
    return permissions.every(permission => this.hasPermission(permission));
  }

  public canManageSubAccounts(): boolean {
    return this.hasPermission(PermissionSet.MANAGE_SUB_ACCOUNTS) || this.hasAdminAccess();
  }

  public canIssueVirtualCards(): boolean {
    return this.hasPermission(PermissionSet.ISSUE_VIRTUAL_CARDS) || this.hasAdminAccess();
  }

  public canViewTransactions(): boolean {
    return this.hasPermission(PermissionSet.VIEW_TRANSACTIONS) || this.hasAdminAccess();
  }

  public canApproveTransactions(): boolean {
    return this.hasPermission(PermissionSet.APPROVE_TRANSACTIONS) || this.hasAdminAccess();
  }

  public canManageLimits(): boolean {
    return this.hasPermission(PermissionSet.MANAGE_LIMITS) || this.hasAdminAccess();
  }

  public canManageUsers(): boolean {
    return this.hasPermission(PermissionSet.MANAGE_USERS) || this.hasAdminAccess();
  }

  public canViewAnalytics(): boolean {
    return this.hasPermission(PermissionSet.VIEW_ANALYTICS) || this.hasAdminAccess();
  }

  public hasAdminAccess(): boolean {
    return this.hasPermission(PermissionSet.ADMIN_ACCESS);
  }

  public isExpired(): boolean {
    if (!this._value.expiresAt) return false;
    return this._value.expiresAt < new Date();
  }

  public isActive(): boolean {
    return !this.isExpired();
  }

  public addPermission(permission: string): PermissionSet {
    if (this.hasPermission(permission)) {
      return this; // Already has permission
    }

    return new PermissionSet({
      ...this._value,
      permissions: [...this._value.permissions, permission]
    });
  }

  public removePermission(permission: string): PermissionSet {
    return new PermissionSet({
      ...this._value,
      permissions: this._value.permissions.filter(p => p !== permission)
    });
  }

  public getPermissionStrings(): string[] {
    return [...this._value.permissions];
  }

  public extend(expiresAt: Date): PermissionSet {
    if (expiresAt <= new Date()) {
      throw new Error('Extension date must be in the future');
    }

    return new PermissionSet({
      ...this._value,
      expiresAt
    });
  }

  public getDaysUntilExpiry(): number | null {
    if (!this._value.expiresAt) return null;
    
    const now = new Date();
    const diffTime = this._value.expiresAt.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  public static createBusinessOwner(grantedBy: string): PermissionSet {
    return new PermissionSet({
      permissions: [
        PermissionSet.ADMIN_ACCESS,
        PermissionSet.MANAGE_SUB_ACCOUNTS,
        PermissionSet.ISSUE_VIRTUAL_CARDS,
        PermissionSet.VIEW_TRANSACTIONS,
        PermissionSet.APPROVE_TRANSACTIONS,
        PermissionSet.MANAGE_LIMITS,
        PermissionSet.MANAGE_USERS,
        PermissionSet.VIEW_ANALYTICS
      ],
      scope: 'business',
      expiresAt: undefined,
      grantedBy,
      grantedAt: new Date()
    });
  }

  public static createEmployee(grantedBy: string): PermissionSet {
    return new PermissionSet({
      permissions: [
        PermissionSet.VIEW_TRANSACTIONS,
        PermissionSet.VIEW_ANALYTICS
      ],
      scope: 'sub-account',
      expiresAt: undefined,
      grantedBy,
      grantedAt: new Date()
    });
  }

  public static createManager(grantedBy: string): PermissionSet {
    return new PermissionSet({
      permissions: [
        PermissionSet.MANAGE_SUB_ACCOUNTS,
        PermissionSet.ISSUE_VIRTUAL_CARDS,
        PermissionSet.VIEW_TRANSACTIONS,
        PermissionSet.APPROVE_TRANSACTIONS,
        PermissionSet.MANAGE_LIMITS,
        PermissionSet.VIEW_ANALYTICS
      ],
      scope: 'business',
      expiresAt: undefined,
      grantedBy,
      grantedAt: new Date()
    });
  }

  public canGrantPermissions(): boolean {
    return this.hasPermission(PermissionSet.MANAGE_USERS) || this.hasAdminAccess();
  }

  public canSpend(): boolean {
    return this.hasPermission(PermissionSet.APPROVE_TRANSACTIONS) || this.hasAdminAccess();
  }

  public static get businessOwner() {
    return PermissionSet.createBusinessOwner;
  }
}