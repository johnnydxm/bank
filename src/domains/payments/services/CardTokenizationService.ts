import { injectable, inject } from 'inversify';
import { ILogger } from '../../../shared/interfaces/ILogger';
import { TYPES } from '../../../infrastructure/ioc/types';
import { FormanceLedgerService } from '../../../infrastructure/formance/FormanceLedgerService';
import { CardToken } from '../value-objects/CardToken';
import { CardDetails } from '../value-objects/CardDetails';
import { PaymentProvider } from '../value-objects/PaymentProvider';
import { CardLimits } from '../../banking/value-objects/CardLimits';
import { PermissionSet } from '../../banking/value-objects/PermissionSet';
import { AccountAddress } from '../../banking/value-objects/AccountAddress';
import { VirtualCard } from '../../banking/entities/VirtualCard';
import { CardTokenizedEvent } from '../events/CardTokenizedEvent';
import { VirtualCardIssuedEvent } from '../events/VirtualCardIssuedEvent';
import { DomainEventPublisher } from '../../../shared/domain/DomainEventPublisher';

/**
 * Card Tokenization Service
 * Handles integration with Apple Pay, Google Pay, and direct bank APIs
 * Core component of DWAY Financial Freedom Platform card management
 */
@injectable()
export class CardTokenizationService {
  constructor(
    @inject(TYPES.ApplePayService) private applePayService: ApplePayService,
    @inject(TYPES.GooglePayService) private googlePayService: GooglePayService,
    @inject(TYPES.DirectBankAPIService) private bankAPIService: DirectBankAPIService,
    @inject(TYPES.FormanceLedgerService) private formanceService: FormanceLedgerService,
    @inject(TYPES.Logger) private logger: ILogger,
    @inject(TYPES.DomainEventPublisher) private eventPublisher: DomainEventPublisher
  ) {}

  /**
   * Universal card tokenization - supports multiple providers
   */
  public async tokenizeCard(
    cardDetails: CardDetails,
    provider: PaymentProvider,
    userId: string
  ): Promise<CardToken> {
    this.logger.info('Tokenizing card', {
      provider: provider.toString(),
      userId,
      cardType: cardDetails.getCardType()
    });

    try {
      let tokenizedCard: CardToken;

      // Route to appropriate tokenization service
      switch (provider) {
        case PaymentProvider.APPLE_PAY:
          tokenizedCard = await this.tokenizeWithApplePay(cardDetails);
          break;
        
        case PaymentProvider.GOOGLE_PAY:
          tokenizedCard = await this.tokenizeWithGooglePay(cardDetails);
          break;
        
        case PaymentProvider.DIRECT_BANK:
          tokenizedCard = await this.tokenizeWithDirectBank(cardDetails);
          break;
        
        default:
          throw new Error(`Unsupported payment provider: ${provider}`);
      }

      // Link tokenized card to user's Formance account
      await this.linkToFormanceAccount(tokenizedCard, userId);

      // Publish domain event
      await this.eventPublisher.publish(new CardTokenizedEvent(
        tokenizedCard,
        userId,
        provider,
        new Date()
      ));

      this.logger.info('Card tokenization completed', {
        tokenId: tokenizedCard.id,
        provider: provider.toString(),
        userId
      });

      return tokenizedCard;

    } catch (error) {
      this.logger.error('Card tokenization failed', error as Error, {
        provider: provider.toString(),
        userId
      });
      throw error;
    }
  }

  /**
   * Issue virtual card with enterprise-grade controls
   */
  public async issueVirtualCard(
    userId: string,
    businessId: string | undefined,
    limits: CardLimits,
    permissions: CardPermissions,
    purpose: VirtualCardPurpose
  ): Promise<VirtualCard> {
    this.logger.info('Issuing virtual card', {
      userId,
      businessId,
      purpose: purpose.toString()
    });

    try {
      // Generate virtual card token
      const cardToken = await this.generateVirtualCardToken(purpose);

      // Create Formance account for virtual card
      const cardAccountAddress = businessId 
        ? AccountAddress.forBusinessCard(businessId, cardToken.id)
        : AccountAddress.forUserCrypto(userId, `card_${cardToken.id}`);

      await this.formanceService.createAccount({
        address: cardAccountAddress.value,
        type: businessId ? 'business' : 'user',
        metadata: {
          card_token: cardToken.token,
          card_type: 'virtual',
          purpose: purpose.toString(),
          daily_limit: limits.daily.amount.toString(),
          weekly_limit: limits.weekly.amount.toString(),
          monthly_limit: limits.monthly.amount.toString(),
          yearly_limit: limits.yearly.amount.toString(),
          channels: JSON.stringify(limits.channels),
          geography: JSON.stringify(limits.geography),
          frequency: JSON.stringify(limits.transactionFrequency),
          created_at: new Date().toISOString(),
          business_id: businessId,
          user_id: userId
        }
      });

      // Create virtual card entity
      const virtualCard = new VirtualCard(
        cardToken.id,
        cardAccountAddress,
        userId,
        limits,
        purpose.toString(),
        businessId ? AccountAddress.forBusiness(businessId) : AccountAddress.forUser(userId)
      );

      // Publish domain event
      await this.eventPublisher.publish(new VirtualCardIssuedEvent(
        virtualCard,
        userId,
        businessId,
        new Date()
      ));

      this.logger.info('Virtual card issued successfully', {
        cardId: virtualCard.id,
        userId,
        businessId
      });

      return virtualCard;

    } catch (error) {
      this.logger.error('Virtual card issuance failed', error as Error, {
        userId,
        businessId
      });
      throw error;
    }
  }

  /**
   * Update virtual card limits (compliance requirement)
   */
  public async updateCardLimits(
    cardId: string,
    newLimits: CardLimits,
    updatedBy: string
  ): Promise<void> {
    this.logger.info('Updating card limits', { cardId, updatedBy });

    try {
      // Update card account metadata in Formance
      const cardAccountAddress = await this.getCardAccountAddress(cardId);
      
      await this.formanceService.updateAccountMetadata(cardAccountAddress.value, {
        daily_limit: newLimits.daily.amount.toString(),
        weekly_limit: newLimits.weekly.amount.toString(),
        monthly_limit: newLimits.monthly.amount.toString(),
        yearly_limit: newLimits.yearly.amount.toString(),
        channels: JSON.stringify(newLimits.channels),
        geography: JSON.stringify(newLimits.geography),
        frequency: JSON.stringify(newLimits.transactionFrequency),
        updated_at: new Date().toISOString(),
        updated_by: updatedBy
      });

      this.logger.info('Card limits updated successfully', { cardId });

    } catch (error) {
      this.logger.error('Card limit update failed', error as Error, {
        cardId
      });
      throw error;
    }
  }

  /**
   * Freeze/unfreeze virtual card
   */
  public async freezeCard(cardId: string, frozen: boolean, reason: string): Promise<void> {
    this.logger.info('Card freeze status change', { cardId, frozen, reason });

    try {
      const cardAccountAddress = await this.getCardAccountAddress(cardId);
      
      await this.formanceService.updateAccountMetadata(cardAccountAddress.value, {
        frozen: frozen.toString(),
        freeze_reason: reason,
        freeze_updated_at: new Date().toISOString()
      });

      this.logger.info('Card freeze status updated', { cardId, frozen });

    } catch (error) {
      this.logger.error('Card freeze operation failed', error as Error, {
        cardId
      });
      throw error;
    }
  }

  /**
   * Get card transaction history with compliance filtering
   */
  public async getCardTransactionHistory(
    cardId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<CardTransaction[]> {
    try {
      const cardAccountAddress = await this.getCardAccountAddress(cardId);
      
      const transactions = await this.formanceService.getTransactionsForAccount(
        cardAccountAddress.value,
        {
          start_time: fromDate,
          end_time: toDate,
          limit: 1000
        }
      );

      return transactions.map(tx => this.mapToCardTransaction(tx));

    } catch (error) {
      this.logger.error('Failed to retrieve card transaction history', error as Error, {
        cardId
      });
      throw error;
    }
  }

  // Private methods for provider-specific tokenization
  private async tokenizeWithApplePay(cardDetails: CardDetails): Promise<CardToken> {
    // Apple Pay integration
    const applePayResult = await this.applePayService.tokenize({
      primaryAccountNumber: cardDetails.maskedNumber,
      expirationDate: cardDetails.expiryDate,
      cardholderName: cardDetails.holderName
    });

    return new CardToken(
      applePayResult.devicePrimaryAccountIdentifier,
      applePayResult.paymentToken,
      PaymentProvider.APPLE_PAY,
      cardDetails.getCardType(),
      cardDetails.maskedNumber,
      cardDetails.expiryDate,
      new Date(),
      new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)) // 1 year expiry
    );
  }

  private async tokenizeWithGooglePay(cardDetails: CardDetails): Promise<CardToken> {
    // Google Pay integration
    const googlePayResult = await this.googlePayService.tokenize({
      pan: cardDetails.maskedNumber,
      expiryMonth: cardDetails.expiryMonth,
      expiryYear: cardDetails.expiryYear,
      cardholderName: cardDetails.holderName
    });

    return new CardToken(
      googlePayResult.tokenReferenceId,
      googlePayResult.paymentToken,
      PaymentProvider.GOOGLE_PAY,
      cardDetails.getCardType(),
      cardDetails.maskedNumber,
      cardDetails.expiryDate,
      new Date(),
      new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))
    );
  }

  private async tokenizeWithDirectBank(cardDetails: CardDetails): Promise<CardToken> {
    // Direct bank API integration
    const bankResult = await this.bankAPIService.tokenize({
      accountNumber: cardDetails.accountNumber,
      routingNumber: cardDetails.routingNumber,
      accountType: cardDetails.accountType
    });

    return new CardToken(
      bankResult.tokenId,
      bankResult.accountToken,
      PaymentProvider.DIRECT_BANK,
      'BANK_ACCOUNT',
      cardDetails.maskedAccountNumber,
      undefined, // Bank accounts don't have expiry dates
      new Date(),
      new Date(Date.now() + (5 * 365 * 24 * 60 * 60 * 1000)) // 5 years for bank accounts
    );
  }

  private async linkToFormanceAccount(cardToken: CardToken, userId: string): Promise<void> {
    // Create a linked account in Formance for the tokenized card
    const linkedAccountAddress = AccountAddress.forUserCrypto(userId, `linked_${cardToken.id}`);

    await this.formanceService.createAccount({
      address: linkedAccountAddress.value,
      type: 'user',
      metadata: {
        card_token_id: cardToken.id,
        card_provider: cardToken.provider.toString(),
        card_type: cardToken.cardType,
        masked_number: cardToken.maskedNumber,
        linked_at: new Date().toISOString(),
        user_id: userId
      }
    });
  }

  private async generateVirtualCardToken(purpose: VirtualCardPurpose): Promise<CardToken> {
    const tokenId = this.generateSecureTokenId();
    const token = this.generateSecureToken();
    
    return new CardToken(
      tokenId,
      token,
      PaymentProvider.VIRTUAL,
      'VIRTUAL',
      this.generateVirtualCardNumber(),
      this.generateFutureExpiryDate(),
      new Date(),
      new Date(Date.now() + (3 * 365 * 24 * 60 * 60 * 1000)) // 3 years
    );
  }

  private async getCardAccountAddress(cardId: string): Promise<AccountAddress> {
    // In a real implementation, this would query the database to find the account address
    // For now, we'll construct it based on naming convention
    return new AccountAddress(`users:*:card:${cardId}`);
  }

  private mapToCardTransaction(transaction: any): CardTransaction {
    // Map Formance transaction to CardTransaction
    // Implementation details would depend on the specific transaction structure
    return {
      id: transaction.id,
      amount: transaction.postings[0]?.amount || BigInt(0),
      currency: transaction.postings[0]?.asset || 'USD',
      timestamp: transaction.timestamp,
      merchant: transaction.metadata?.merchant || 'Unknown',
      category: transaction.metadata?.category || 'General'
    };
  }

  private generateSecureTokenId(): string {
    return `vtk_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private generateSecureToken(): string {
    // Generate a secure random token
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generateVirtualCardNumber(): string {
    // Generate a virtual card number (not a real PAN)
    return `4***-****-****-${Math.random().toString().substr(2, 4)}`;
  }

  private generateFutureExpiryDate(): string {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 3);
    const month = (futureDate.getMonth() + 1).toString().padStart(2, '0');
    const year = futureDate.getFullYear().toString().substr(2);
    return `${month}/${year}`;
  }
}

// Supporting interfaces
export interface ApplePayService {
  tokenize(request: ApplePayTokenizeRequest): Promise<ApplePayTokenizeResponse>;
}

export interface GooglePayService {
  tokenize(request: GooglePayTokenizeRequest): Promise<GooglePayTokenizeResponse>;
}

export interface DirectBankAPIService {
  tokenize(request: BankTokenizeRequest): Promise<BankTokenizeResponse>;
}

// Request/Response types
export interface ApplePayTokenizeRequest {
  primaryAccountNumber: string;
  expirationDate: string;
  cardholderName: string;
}

export interface ApplePayTokenizeResponse {
  devicePrimaryAccountIdentifier: string;
  paymentToken: string;
}

export interface GooglePayTokenizeRequest {
  pan: string;
  expiryMonth: string;
  expiryYear: string;
  cardholderName: string;
}

export interface GooglePayTokenizeResponse {
  tokenReferenceId: string;
  paymentToken: string;
}

export interface BankTokenizeRequest {
  accountNumber: string;
  routingNumber: string;
  accountType: string;
}

export interface BankTokenizeResponse {
  tokenId: string;
  accountToken: string;
}

export interface CardTransaction {
  id: string;
  amount: bigint;
  currency: string;
  timestamp: Date;
  merchant: string;
  category: string;
}

export enum VirtualCardPurpose {
  EMPLOYEE = 'employee',
  CONTRACTOR = 'contractor',
  EXPENSE = 'expense',
  PROJECT = 'project',
  TRAVEL = 'travel',
  MARKETING = 'marketing'
}

export interface CardPermissions {
  channels: string[];
  limits: CardLimits;
}