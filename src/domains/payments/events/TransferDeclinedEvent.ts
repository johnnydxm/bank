import { BaseDomainEvent } from '../../../shared/domain/DomainEvent';
import { TransactionId } from '../value-objects/TransactionId';
import { AccountAddress } from '../../banking/value-objects/AccountAddress';

export class TransferDeclinedEvent extends BaseDomainEvent {
  constructor(
    public readonly transferId: TransactionId,
    public readonly declinedByAccount: AccountAddress,
    public readonly declinedBy: string,
    public readonly reason: string | undefined,
    public readonly declinedAt: Date
  ) {
    super(
      'TransferDeclined',
      transferId.value,
      'P2PTransferAggregate',
      {
        transferId: transferId.value,
        declinedByAccount: declinedByAccount.value,
        declinedBy,
        reason,
        declinedAt: declinedAt.toISOString()
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

  public getDeclinedByAccount(): AccountAddress {
    return this.declinedByAccount;
  }

  public getDeclinedBy(): string {
    return this.declinedBy;
  }

  public getReason(): string | undefined {
    return this.reason;
  }

  public getDeclinedAt(): Date {
    return this.declinedAt;
  }

  public hasReason(): boolean {
    return this.reason !== undefined && this.reason.trim().length > 0;
  }

  public getDisplayReason(): string {
    return this.hasReason() ? this.reason! : 'No reason provided';
  }

  public toString(): string {
    const reasonText = this.hasReason() ? ` (${this.reason})` : '';
    return `Transfer ${this.transferId.value} declined by ${this.declinedBy}${reasonText}`;
  }
}