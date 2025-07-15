import { BaseDomainEvent } from '../../../shared/domain/DomainEvent';
import { VirtualCard } from '../../banking/entities/VirtualCard';

export class VirtualCardIssuedEvent extends BaseDomainEvent {
  constructor(
    public readonly virtualCard: VirtualCard,
    public readonly userId: string,
    public readonly businessId: string | undefined,
    public readonly issuedAt: Date
  ) {
    super(
      'VirtualCardIssued',
      virtualCard.id,
      'CardTokenizationService',
      {
        cardId: virtualCard.id,
        userId,
        businessId,
        accountAddress: virtualCard.accountAddress.value,
        purpose: virtualCard.purpose,
        issuedAt: issuedAt.toISOString()
      },
      {
        version: '1.0.0',
        source: 'payments-domain',
        eventCategory: 'card',
        correlationId: virtualCard.id
      }
    );
  }

  public getVirtualCard(): VirtualCard {
    return this.virtualCard;
  }

  public getUserId(): string {
    return this.userId;
  }

  public getBusinessId(): string | undefined {
    return this.businessId;
  }

  public getIssuedAt(): Date {
    return this.issuedAt;
  }

  public getCardId(): string {
    return this.virtualCard.id;
  }

  public getAccountAddress(): string {
    return this.virtualCard.accountAddress.value;
  }

  public getPurpose(): string {
    return this.virtualCard.purpose;
  }

  public isBusinessCard(): boolean {
    return this.businessId !== undefined;
  }

  public isPersonalCard(): boolean {
    return this.businessId === undefined;
  }

  public getCardType(): 'business' | 'personal' {
    return this.isBusinessCard() ? 'business' : 'personal';
  }

  public getOwnerDescription(): string {
    if (this.isBusinessCard()) {
      return `Business ${this.businessId} (User: ${this.userId})`;
    }
    return `User ${this.userId}`;
  }

  public toString(): string {
    const cardType = this.isBusinessCard() ? 'business' : 'personal';
    return `Virtual ${cardType} card ${this.virtualCard.id} issued for ${this.getOwnerDescription()} - Purpose: ${this.virtualCard.purpose}`;
  }
}