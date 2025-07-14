import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { TransactionId } from '../value-objects/TransactionId';
import { AccountAddress } from '../../banking/value-objects/AccountAddress';
import { MultiCurrencyAmount } from '../../currency/value-objects/MultiCurrencyAmount';
import { TransferStatus } from '../value-objects/TransferStatus';
import { Currency } from '../../currency/value-objects/Currency';
import { CardToken } from '../value-objects/CardToken';
import { TransferInitiatedEvent } from '../events/TransferInitiatedEvent';
import { TransferAcceptedEvent } from '../events/TransferAcceptedEvent';
import { TransferDeclinedEvent } from '../events/TransferDeclinedEvent';
import { TransferCompletedEvent } from '../events/TransferCompletedEvent';
import { TransferExpiredEvent } from '../events/TransferExpiredEvent';

/**
 * P2P Transfer Aggregate
 * Implements the accept/decline workflow with multi-currency support
 * Core feature of the DWAY Financial Freedom Platform
 */
export class P2PTransferAggregate extends AggregateRoot {
  private status: TransferStatus;
  private acceptedAt?: Date;
  private declinedAt?: Date;
  private completedAt?: Date;
  private expiresAt: Date;
  private destinationCurrency?: Currency;
  private destinationCard?: CardToken;
  private escrowAccountAddress?: AccountAddress;
  private finalConvertedAmount?: MultiCurrencyAmount;

  constructor(
    private transferId: TransactionId,
    private from: AccountAddress,
    private to: AccountAddress,
    private amount: MultiCurrencyAmount,
    private message: string,
    private createdAt: Date,
    expirationHours: number = 72 // 3 days default expiration
  ) {
    super(`p2p:${transferId.value}`);
    this.status = TransferStatus.PENDING;
    this.expiresAt = new Date(createdAt.getTime() + (expirationHours * 60 * 60 * 1000));
  }

  /**
   * Initiate P2P transfer with optimal currency conversion for minimal fees
   */
  public initiate(
    exchangeRateService: ExchangeRateService,
    escrowService: EscrowService
  ): void {
    // Business Rule: Cannot initiate already processed transfer
    if (this.status !== TransferStatus.PENDING) {
      throw new Error('Transfer has already been processed');
    }

    // Business Rule: Cannot transfer to same account
    if (this.from.equals(this.to)) {
      throw new Error('Cannot transfer to the same account');
    }

    // Find optimal currency path for minimal gas fees
    const optimizedAmount = exchangeRateService.getOptimalConversion(
      this.amount,
      ['USDC', 'USDT', 'ETH', 'BTC'] // Preferred crypto currencies for transfers
    );

    // Create escrow account for this transfer
    this.escrowAccountAddress = AccountAddress.forEscrow(this.transferId.value);

    // Reserve funds in escrow
    escrowService.reserveFunds(
      this.from,
      this.escrowAccountAddress,
      optimizedAmount
    );

    // Domain Event
    this.addDomainEvent(new TransferInitiatedEvent(
      this.transferId,
      this.from,
      this.to,
      optimizedAmount,
      this.message,
      this.expiresAt,
      new Date()
    ));
  }

  /**
   * Accept transfer and specify destination currency/card
   */
  public accept(
    destinationCurrency: Currency,
    destinationCard?: CardToken,
    acceptedBy: string
  ): void {
    // Business Rule: Only pending transfers can be accepted
    if (this.status !== TransferStatus.PENDING) {
      throw new Error('Transfer is not in pending state');
    }

    // Business Rule: Cannot accept expired transfers
    if (this.isExpired()) {
      throw new Error('Transfer has expired');
    }

    this.status = TransferStatus.ACCEPTED;
    this.acceptedAt = new Date();
    this.destinationCurrency = destinationCurrency;
    this.destinationCard = destinationCard;

    // Domain Event
    this.addDomainEvent(new TransferAcceptedEvent(
      this.transferId,
      this.to,
      destinationCurrency,
      destinationCard,
      acceptedBy,
      this.acceptedAt
    ));
  }

  /**
   * Decline transfer with reason
   */
  public decline(declinedBy: string, reason?: string): void {
    // Business Rule: Only pending transfers can be declined
    if (this.status !== TransferStatus.PENDING) {
      throw new Error('Transfer is not in pending state');
    }

    this.status = TransferStatus.DECLINED;
    this.declinedAt = new Date();

    // Domain Event
    this.addDomainEvent(new TransferDeclinedEvent(
      this.transferId,
      this.to,
      declinedBy,
      reason,
      this.declinedAt
    ));
  }

  /**
   * Complete transfer after acceptance
   */
  public complete(
    exchangeRateService: ExchangeRateService,
    paymentRailService: PaymentRailService
  ): void {
    // Business Rule: Only accepted transfers can be completed
    if (this.status !== TransferStatus.ACCEPTED) {
      throw new Error('Transfer must be accepted before completion');
    }

    if (!this.destinationCurrency) {
      throw new Error('Destination currency not specified');
    }

    // Convert from escrow currency to destination currency
    const escrowAmount = this.getEscrowAmount();
    this.finalConvertedAmount = exchangeRateService.convert(
      escrowAmount,
      this.destinationCurrency
    );

    // Execute final transfer
    if (this.destinationCard) {
      // Transfer to card
      paymentRailService.transferToCard(
        this.destinationCard,
        this.finalConvertedAmount
      );
    } else {
      // Transfer to user's default account
      const destinationAccount = this.getDestinationAccount();
      paymentRailService.transferToAccount(
        this.escrowAccountAddress!,
        destinationAccount,
        this.finalConvertedAmount
      );
    }

    this.status = TransferStatus.COMPLETED;
    this.completedAt = new Date();

    // Domain Event
    this.addDomainEvent(new TransferCompletedEvent(
      this.transferId,
      this.from,
      this.to,
      this.finalConvertedAmount,
      this.destinationCard,
      this.completedAt
    ));
  }

  /**
   * Expire transfer and return funds to sender
   */
  public expire(refundService: RefundService): void {
    // Business Rule: Only pending transfers can expire
    if (this.status !== TransferStatus.PENDING) {
      throw new Error('Only pending transfers can expire');
    }

    // Business Rule: Must be past expiration time
    if (!this.isExpired()) {
      throw new Error('Transfer has not yet expired');
    }

    // Refund from escrow to original sender
    refundService.refundFromEscrow(
      this.escrowAccountAddress!,
      this.from,
      this.amount
    );

    this.status = TransferStatus.EXPIRED;

    // Domain Event
    this.addDomainEvent(new TransferExpiredEvent(
      this.transferId,
      this.from,
      this.amount,
      new Date()
    ));
  }

  /**
   * Cancel transfer before acceptance (sender initiated)
   */
  public cancel(cancelledBy: string, reason?: string): void {
    // Business Rule: Only pending transfers can be cancelled
    if (this.status !== TransferStatus.PENDING) {
      throw new Error('Transfer is not in pending state');
    }

    // Business Rule: Only sender can cancel
    if (cancelledBy !== this.from.toString()) {
      throw new Error('Only sender can cancel transfer');
    }

    this.status = TransferStatus.CANCELLED;

    // Refund from escrow will be handled by event handler
    this.addDomainEvent(new TransferCancelledEvent(
      this.transferId,
      this.from,
      cancelledBy,
      reason,
      new Date()
    ));
  }

  // Query methods
  public getTransferId(): TransactionId {
    return this.transferId;
  }

  public getStatus(): TransferStatus {
    return this.status;
  }

  public getAmount(): MultiCurrencyAmount {
    return this.amount;
  }

  public getFinalAmount(): MultiCurrencyAmount | null {
    return this.finalConvertedAmount || null;
  }

  public getFromAccount(): AccountAddress {
    return this.from;
  }

  public getToAccount(): AccountAddress {
    return this.to;
  }

  public getMessage(): string {
    return this.message;
  }

  public getExpirationDate(): Date {
    return this.expiresAt;
  }

  public isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  public getTimeUntilExpiration(): number {
    const now = new Date().getTime();
    const expires = this.expiresAt.getTime();
    return Math.max(0, expires - now);
  }

  // Private helper methods
  private getEscrowAmount(): MultiCurrencyAmount {
    // In a real implementation, this would query the actual escrow balance
    // For now, we assume it's the original amount (minus any fees)
    return this.amount;
  }

  private getDestinationAccount(): AccountAddress {
    // Determine the appropriate destination account based on currency type
    if (this.destinationCurrency!.isCrypto()) {
      return AccountAddress.forUserCrypto(
        this.extractUserIdFromAddress(this.to),
        this.destinationCurrency!.code
      );
    }
    
    return AccountAddress.forUser(
      this.extractUserIdFromAddress(this.to),
      'wallet'
    );
  }

  private extractUserIdFromAddress(address: AccountAddress): string {
    // Extract user ID from address format: users:userId:accountType
    const parts = address.value.split(':');
    if (parts[0] === 'users' && parts.length >= 2) {
      return parts[1];
    }
    throw new Error(`Cannot extract user ID from address: ${address.value}`);
  }

  // Factory method
  public static initiate(
    from: AccountAddress,
    to: AccountAddress,
    amount: MultiCurrencyAmount,
    message: string,
    expirationHours?: number
  ): P2PTransferAggregate {
    const transferId = TransactionId.generate();
    const createdAt = new Date();

    return new P2PTransferAggregate(
      transferId,
      from,
      to,
      amount,
      message,
      createdAt,
      expirationHours
    );
  }
}

// Supporting interfaces for dependency injection
export interface ExchangeRateService {
  getOptimalConversion(amount: MultiCurrencyAmount, preferredCurrencies: string[]): MultiCurrencyAmount;
  convert(amount: MultiCurrencyAmount, toCurrency: Currency): MultiCurrencyAmount;
}

export interface EscrowService {
  reserveFunds(from: AccountAddress, escrow: AccountAddress, amount: MultiCurrencyAmount): void;
}

export interface PaymentRailService {
  transferToCard(card: CardToken, amount: MultiCurrencyAmount): void;
  transferToAccount(from: AccountAddress, to: AccountAddress, amount: MultiCurrencyAmount): void;
}

export interface RefundService {
  refundFromEscrow(escrow: AccountAddress, to: AccountAddress, amount: MultiCurrencyAmount): void;
}