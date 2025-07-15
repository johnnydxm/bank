import { BaseDomainEvent } from '../../../shared/domain/DomainEvent';
import { TransactionId } from '../value-objects/TransactionId';
import { AccountAddress } from '../../banking/value-objects/AccountAddress';
import { MultiCurrencyAmount } from '../../currency/value-objects/MultiCurrencyAmount';

export class TransferInitiatedEvent extends BaseDomainEvent {
  constructor(
    public readonly transferId: TransactionId,
    public readonly fromAccount: AccountAddress,
    public readonly toAccount: AccountAddress,
    public readonly amount: MultiCurrencyAmount,
    public readonly message: string,
    public readonly expiresAt: Date,
    public readonly initiatedAt: Date
  ) {
    super(
      'TransferInitiated',
      transferId.value,
      'P2PTransferAggregate',
      {
        transferId: transferId.value,
        fromAccount: fromAccount.value,
        toAccount: toAccount.value,
        amount: amount.toJSON(),
        message,
        expiresAt: expiresAt.toISOString(),
        initiatedAt: initiatedAt.toISOString()
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

  public getToAccount(): AccountAddress {
    return this.toAccount;
  }

  public getAmount(): MultiCurrencyAmount {
    return this.amount;
  }

  public getMessage(): string {
    return this.message;
  }

  public getExpiresAt(): Date {
    return this.expiresAt;
  }

  public getInitiatedAt(): Date {
    return this.initiatedAt;
  }

  public isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  public getTimeUntilExpiration(): number {
    const now = new Date().getTime();
    const expires = this.expiresAt.getTime();
    return Math.max(0, expires - now);
  }

  public toString(): string {
    return `Transfer ${this.transferId.value} initiated from ${this.fromAccount.value} to ${this.toAccount.value} for ${this.amount.toString()}`;
  }
}