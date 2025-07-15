import { BaseDomainEvent } from '../../../shared/domain/DomainEvent';
import { TransactionId } from '../value-objects/TransactionId';
import { AccountAddress } from '../../banking/value-objects/AccountAddress';
import { MultiCurrencyAmount } from '../../currency/value-objects/MultiCurrencyAmount';

export class TransferExpiredEvent extends BaseDomainEvent {
  constructor(
    public readonly transferId: TransactionId,
    public readonly fromAccount: AccountAddress,
    public readonly originalAmount: MultiCurrencyAmount,
    public readonly expiredAt: Date
  ) {
    super(
      'TransferExpired',
      transferId.value,
      'P2PTransferAggregate',
      {
        transferId: transferId.value,
        fromAccount: fromAccount.value,
        originalAmount: originalAmount.toJSON(),
        expiredAt: expiredAt.toISOString()
      },
      {
        version: '1.0.0',
        source: 'payments-domain',
        eventCategory: 'transfer',
        correlationId: transferId.value
      }
    );
  }

  public getTransferId(): TransactionId {
    return this.transferId;
  }

  public getFromAccount(): AccountAddress {
    return this.fromAccount;
  }

  public getOriginalAmount(): MultiCurrencyAmount {
    return this.originalAmount;
  }

  public getExpiredAt(): Date {
    return this.expiredAt;
  }

  public getTimeSinceExpiration(): number {
    const now = new Date().getTime();
    const expired = this.expiredAt.getTime();
    return Math.max(0, now - expired);
  }

  public getDaysSinceExpiration(): number {
    return Math.floor(this.getTimeSinceExpiration() / (1000 * 60 * 60 * 24));
  }

  public getHoursSinceExpiration(): number {
    return Math.floor(this.getTimeSinceExpiration() / (1000 * 60 * 60));
  }

  public toString(): string {
    return `Transfer ${this.transferId.value} expired: ${this.originalAmount.toString()} from ${this.fromAccount.value}`;
  }
}