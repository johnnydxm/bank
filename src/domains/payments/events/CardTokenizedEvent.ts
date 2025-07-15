import { BaseDomainEvent } from '../../../shared/domain/DomainEvent';
import { CardToken } from '../value-objects/CardToken';
import { PaymentProvider } from '../value-objects/PaymentProvider';

export class CardTokenizedEvent extends BaseDomainEvent {
  constructor(
    public readonly cardToken: CardToken,
    public readonly userId: string,
    public readonly provider: PaymentProvider,
    public readonly tokenizedAt: Date
  ) {
    super(
      'CardTokenized',
      cardToken.id,
      'CardTokenizationService',
      {
        cardTokenId: cardToken.id,
        userId,
        provider: provider.value,
        cardType: cardToken.cardType,
        maskedNumber: cardToken.maskedNumber,
        expiryDate: cardToken.expiryDate,
        tokenizedAt: tokenizedAt.toISOString()
      },
      {
        version: '1.0.0',
        source: 'payments-domain',
        eventCategory: 'card',
        correlationId: cardToken.id
      }
    );
  }

  public getCardToken(): CardToken {
    return this.cardToken;
  }

  public getUserId(): string {
    return this.userId;
  }

  public getProvider(): PaymentProvider {
    return this.provider;
  }

  public getTokenizedAt(): Date {
    return this.tokenizedAt;
  }

  public getCardTokenId(): string {
    return this.cardToken.id;
  }

  public getCardType(): string {
    return this.cardToken.cardType;
  }

  public getMaskedNumber(): string {
    return this.cardToken.maskedNumber;
  }

  public getExpiryDate(): string | undefined {
    return this.cardToken.expiryDate;
  }

  public isVirtual(): boolean {
    return this.cardToken.isVirtual();
  }

  public isMobileWallet(): boolean {
    return this.cardToken.isMobileWallet();
  }

  public isDirectBank(): boolean {
    return this.cardToken.isDirectBank();
  }

  public isCrypto(): boolean {
    return this.cardToken.isCrypto();
  }

  public getProviderDisplayName(): string {
    return this.provider.getDisplayName();
  }

  public getProviderIcon(): string {
    return this.provider.getIcon();
  }

  public getSecurityLevel(): 'LOW' | 'MEDIUM' | 'HIGH' {
    return this.cardToken.getSecurityLevel();
  }

  public toString(): string {
    return `Card tokenized: ${this.cardToken.maskedNumber} via ${this.provider.getDisplayName()} for user ${this.userId}`;
  }
}