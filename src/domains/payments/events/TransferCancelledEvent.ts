import { BaseDomainEvent } from '../../../shared/domain/DomainEvent';
import { TransactionId } from '../value-objects/TransactionId';
import { AccountAddress } from '../../banking/value-objects/AccountAddress';

export class TransferCancelledEvent extends BaseDomainEvent {
  constructor(
    public readonly transferId: TransactionId,
    public readonly fromAccount: AccountAddress,
    public readonly cancelledBy: string,
    public readonly reason: string | undefined,
    public readonly cancelledAt: Date
  ) {
    super(
      'TransferCancelled',
      transferId.value,
      'P2PTransferAggregate',
      {
        transferId: transferId.value,
        fromAccount: fromAccount.value,
        cancelledBy,
        reason,
        cancelledAt: cancelledAt.toISOString()
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

  public getCancelledBy(): string {
    return this.cancelledBy;
  }

  public getReason(): string | undefined {
    return this.reason;
  }

  public getCancelledAt(): Date {
    return this.cancelledAt;
  }

  public hasReason(): boolean {
    return this.reason !== undefined && this.reason.trim().length > 0;
  }

  public getDisplayReason(): string {
    return this.hasReason() ? this.reason! : 'No reason provided';
  }

  public isSenderCancelled(): boolean {
    // Assume sender cancelled if the cancelledBy matches the account pattern
    return this.fromAccount.value.includes(this.cancelledBy) || 
           this.fromAccount.getUserId() === this.cancelledBy;
  }

  public isSystemCancelled(): boolean {
    return this.cancelledBy === 'system';
  }

  public toString(): string {
    const reasonText = this.hasReason() ? ` (${this.reason})` : '';
    return `Transfer ${this.transferId.value} cancelled by ${this.cancelledBy}${reasonText}`;
  }
}