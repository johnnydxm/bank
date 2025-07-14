import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { BusinessId } from '../value-objects/BusinessId';
import { AccountAddress } from '../value-objects/AccountAddress';
import { SubAccount } from '../entities/SubAccount';
import { VirtualCard } from '../entities/VirtualCard';
import { CardLimits } from '../value-objects/CardLimits';
import { PermissionSet } from '../value-objects/PermissionSet';
import { BusinessAccountCreatedEvent } from '../events/BusinessAccountCreatedEvent';
import { SubAccountCreatedEvent } from '../events/SubAccountCreatedEvent';
import { VirtualCardIssuedEvent } from '../events/VirtualCardIssuedEvent';

/**
 * Business Account Aggregate - Enterprise Account Management
 * Implements DDD patterns for complex business account operations
 */
export class BusinessAccountAggregate extends AggregateRoot {
  private subAccounts: Map<string, SubAccount> = new Map();
  private virtualCards: Map<string, VirtualCard> = new Map();
  private permissions: PermissionSet;

  constructor(
    private businessId: BusinessId,
    private mainAccountAddress: AccountAddress,
    private businessName: string,
    permissions: PermissionSet,
    private parentAccount?: AccountAddress
  ) {
    super(`business:${businessId.value}`);
    this.permissions = permissions;
  }

  /**
   * Create sub-account for departmental or operational segregation
   */
  public createSubAccount(
    subAccountType: 'department' | 'project' | 'escrow' | 'operational',
    name: string,
    permissions: PermissionSet
  ): SubAccount {
    // Business Rule: Only businesses with management permissions can create sub-accounts
    if (!this.permissions.canManageSubAccounts()) {
      throw new Error('Insufficient permissions to create sub-accounts');
    }

    // Business Rule: Maximum 50 sub-accounts per business
    if (this.subAccounts.size >= 50) {
      throw new Error('Maximum sub-account limit reached (50)');
    }

    const subAccountId = this.generateSubAccountId(subAccountType, name);
    const subAccountAddress = new AccountAddress(
      `business:${this.businessId.value}:sub:${subAccountId}`
    );

    const subAccount = new SubAccount({
      id: subAccountId,
      parentAccountId: this.mainAccountAddress.value,
      name: name,
      purpose: subAccountType,
      address: subAccountAddress.value,
      assignedUserId: undefined,
      balance: 0n,
      currency: 'USD', // Default currency, should come from business config
      permissions: permissions.getPermissionStrings(),
      limits: undefined,
      status: 'active',
      metadata: undefined
    });

    this.subAccounts.set(subAccountId, subAccount);

    // Domain Event
    this.addDomainEvent(new SubAccountCreatedEvent(
      this.id,
      {
        subAccountId: subAccountId,
        parentAccountId: this.mainAccountAddress.value,
        name: name,
        purpose: subAccountType,
        assignedUserId: undefined,
        initialBalance: 0n,
        currency: 'USD',
        permissions: permissions.getPermissionStrings(),
        limits: undefined
      }
    ));

    return subAccount;
  }

  /**
   * Issue virtual card with enterprise-grade controls
   */
  public issueVirtualCard(
    assigneeUserId: string,
    limits: CardLimits,
    purpose: 'employee' | 'contractor' | 'expense' | 'project'
  ): VirtualCard {
    // Business Rule: Only businesses with card issuance permissions
    if (!this.permissions.canIssueVirtualCards()) {
      throw new Error('Virtual card issuance not permitted');
    }

    // Business Rule: Maximum 500 virtual cards per business
    if (this.virtualCards.size >= 500) {
      throw new Error('Maximum virtual card limit reached (500)');
    }

    const cardId = this.generateVirtualCardId();
    const cardAccountAddress = new AccountAddress(
      `business:${this.businessId.value}:card:${cardId}`
    );

    const virtualCard = new VirtualCard({
      id: cardId,
      accountId: cardAccountAddress.value,
      cardholderName: `${this.businessName} - ${purpose}`,
      cardType: 'debit',
      currency: 'USD',
      dailyLimit: limits.getDailyLimit(),
      monthlyLimit: limits.getMonthlyLimit(),
      yearlyLimit: limits.getYearlyLimit(),
      allowedChannels: ['pos', 'online'],
      allowedMerchants: undefined,
      blockedMerchants: undefined,
      expiryDate: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000), // 3 years
      isActive: true,
      assignedUserId: assigneeUserId,
      cardNumber: undefined,
      cvv: undefined,
      pin: undefined,
      usage: {
        dailySpent: 0n,
        monthlySpent: 0n,
        yearlySpent: 0n,
        lastUsed: undefined,
        transactionCount: 0
      },
      restrictions: {
        geographicRestrictions: undefined,
        timeRestrictions: undefined,
        amountRestrictions: undefined
      },
      metadata: { purpose }
    });

    this.virtualCards.set(cardId, virtualCard);

    // Domain Event
    this.addDomainEvent(new VirtualCardIssuedEvent(
      this.id,
      {
        cardId: cardId,
        accountId: cardAccountAddress.value,
        cardholderName: `${this.businessName} - ${purpose}`,
        cardType: 'debit',
        currency: 'USD',
        dailyLimit: limits.getDailyLimit(),
        monthlyLimit: limits.getMonthlyLimit(),
        allowedChannels: ['pos', 'online'],
        allowedMerchants: undefined,
        expiryDate: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000),
        isActive: true,
        assignedUserId: assigneeUserId
      }
    ));

    return virtualCard;
  }

  /**
   * Grant management permissions to another user
   */
  public grantManagementAccess(
    userId: string,
    permissions: PermissionSet,
    grantedBy: string
  ): void {
    // Business Rule: Only account owners can grant management access
    if (!this.permissions.canGrantPermissions()) {
      throw new Error('Insufficient permissions to grant access');
    }

    // Implementation would integrate with identity management system
    // This is a placeholder for the actual permission granting logic
  }

  /**
   * Get all sub-accounts with their current balances
   */
  public getSubAccounts(): SubAccount[] {
    return Array.from(this.subAccounts.values());
  }

  /**
   * Get all virtual cards with their status
   */
  public getVirtualCards(): VirtualCard[] {
    return Array.from(this.virtualCards.values());
  }

  /**
   * Validate if a transaction is allowed for this business account
   */
  public validateTransaction(
    fromAccount: AccountAddress,
    amount: bigint,
    currency: string
  ): boolean {
    // Business Rule: Check account ownership
    if (!this.ownsAccount(fromAccount)) {
      return false;
    }

    // Business Rule: Check spending limits and permissions
    return this.permissions.canSpend(amount, currency);
  }

  // Private helper methods
  private generateSubAccountId(type: string, name: string): string {
    const timestamp = Date.now();
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${type}_${sanitizedName}_${timestamp}`;
  }

  private generateVirtualCardId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `card_${timestamp}_${random}`;
  }

  private ownsAccount(address: AccountAddress): boolean {
    // Check if address belongs to main account or any sub-account
    if (address.equals(this.mainAccountAddress)) {
      return true;
    }

    return Array.from(this.subAccounts.values())
      .some(subAccount => subAccount.address.equals(address));
  }

  // Factory method for creating business accounts
  public static create(
    businessId: BusinessId,
    businessName: string,
    ownerUserId: string,
    parentAccount?: AccountAddress
  ): BusinessAccountAggregate {
    const mainAccountAddress = new AccountAddress(
      `business:${businessId.value}:main`
    );

    // Default permissions for business account owner
    const ownerPermissions = PermissionSet.businessOwner();

    const aggregate = new BusinessAccountAggregate(
      businessId,
      mainAccountAddress,
      businessName,
      ownerPermissions,
      parentAccount
    );

    // Domain Event
    aggregate.addDomainEvent(new BusinessAccountCreatedEvent(
      businessId,
      mainAccountAddress,
      businessName,
      ownerUserId,
      new Date()
    ));

    return aggregate;
  }
}