import { BaseDomainEvent } from '../../../shared/domain/DomainEvent';
import { TransactionId } from '../value-objects/TransactionId';
import { AccountAddress } from '../../banking/value-objects/AccountAddress';
import { Currency } from '../../currency/entities/Currency';
import { CardToken } from '../value-objects/CardToken';

export class TransferAcceptedEvent extends BaseDomainEvent {
  constructor(
    public readonly transferId: TransactionId,
    public readonly acceptedByAccount: AccountAddress,
    public readonly destinationCurrency: Currency,
    public readonly destinationCard: CardToken | undefined,
    public readonly acceptedBy: string,
    public readonly acceptedAt: Date
  ) {
    super(
      'TransferAccepted',
      transferId.value,
      'P2PTransferAggregate',
      {
        transferId: transferId.value,
        acceptedByAccount: acceptedByAccount.value,
        destinationCurrency: {
          code: destinationCurrency.code,
          name: destinationCurrency.metadata.name,
          symbol: destinationCurrency.metadata.symbol,
          type: destinationCurrency.metadata.type
        },
        destinationCard: destinationCard?.toJSON(),
        acceptedBy,
        acceptedAt: acceptedAt.toISOString()
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

  public getAcceptedByAccount(): AccountAddress {
    return this.acceptedByAccount;
  }

  public getDestinationCurrency(): Currency {
    return this.destinationCurrency;
  }

  public getDestinationCard(): CardToken | undefined {
    return this.destinationCard;
  }

  public getAcceptedBy(): string {
    return this.acceptedBy;
  }

  public getAcceptedAt(): Date {
    return this.acceptedAt;
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

  public toString(): string {
    const destination = this.hasDestinationCard() 
      ? `card ${this.destinationCard!.maskedNumber}`
      : `account ${this.acceptedByAccount.value}`;
    
    return `Transfer ${this.transferId.value} accepted by ${this.acceptedBy} for ${destination} in ${this.destinationCurrency.code}`;
  }
}