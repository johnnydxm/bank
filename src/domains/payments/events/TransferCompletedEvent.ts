import { BaseDomainEvent } from '../../../shared/domain/DomainEvent';
import { TransactionId } from '../value-objects/TransactionId';
import { AccountAddress } from '../../banking/value-objects/AccountAddress';
import { MultiCurrencyAmount } from '../../currency/value-objects/MultiCurrencyAmount';
import { CardToken } from '../value-objects/CardToken';

export class TransferCompletedEvent extends BaseDomainEvent {
  constructor(
    public readonly transferId: TransactionId,
    public readonly fromAccount: AccountAddress,
    public readonly toAccount: AccountAddress,
    public readonly finalAmount: MultiCurrencyAmount,
    public readonly destinationCard: CardToken | undefined,
    public readonly completedAt: Date
  ) {
    super(
      'TransferCompleted',
      transferId.value,
      'P2PTransferAggregate',
      {
        transferId: transferId.value,
        fromAccount: fromAccount.value,
        toAccount: toAccount.value,
        finalAmount: finalAmount.toJSON(),
        destinationCard: destinationCard?.toJSON(),
        completedAt: completedAt.toISOString()
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

  public getFinalAmount(): MultiCurrencyAmount {
    return this.finalAmount;
  }

  public getDestinationCard(): CardToken | undefined {
    return this.destinationCard;
  }

  public getCompletedAt(): Date {
    return this.completedAt;
  }

  public hasDestinationCard(): boolean {
    return this.destinationCard !== undefined;
  }

  public isCardTransfer(): boolean {
    return this.hasDestinationCard();
  }

  public isAccountTransfer(): boolean {
    return !this.hasDestinationCard();
  }

  public getTransferType(): 'card' | 'account' {
    return this.isCardTransfer() ? 'card' : 'account';
  }

  public getDestinationDescription(): string {
    if (this.hasDestinationCard()) {
      return `${this.destinationCard!.getProviderDisplayName()} - ${this.destinationCard!.maskedNumber}`;
    }
    return this.toAccount.value;
  }

  public toString(): string {
    const destination = this.isCardTransfer() 
      ? `card ${this.destinationCard!.maskedNumber}`
      : `account ${this.toAccount.value}`;
    
    return `Transfer ${this.transferId.value} completed: ${this.finalAmount.toString()} to ${destination}`;
  }
}