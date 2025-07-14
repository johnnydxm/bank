import { BaseDomainEvent } from '../../../shared/domain/DomainEvent';

export interface CryptoTransferInitiatedEventData {
  transferId: string;
  fromWalletId: string;
  toAddress: string;
  assetSymbol: string;
  amount: bigint;
  network: string;
  gasPrice: bigint;
  gasLimit: bigint;
  estimatedFee: bigint;
  transferType: 'standard' | 'instant' | 'batch';
  priority: 'low' | 'medium' | 'high';
  initiatedBy: string;
  metadata?: {
    memo?: string;
    tags?: string[];
    layer2Network?: string;
    bridgeUsed?: boolean;
  };
}

export class CryptoTransferInitiatedEvent extends BaseDomainEvent {
  constructor(
    aggregateId: string,
    eventData: CryptoTransferInitiatedEventData,
    metadata?: Record<string, any>
  ) {
    super(
      'CryptoTransferInitiated',
      aggregateId,
      'CryptoWalletAggregate',
      eventData,
      metadata,
      '1.0.0'
    );
  }

  public get transferId(): string {
    return this.eventData.transferId;
  }

  public get fromWalletId(): string {
    return this.eventData.fromWalletId;
  }

  public get toAddress(): string {
    return this.eventData.toAddress;
  }

  public get assetSymbol(): string {
    return this.eventData.assetSymbol;
  }

  public get amount(): bigint {
    return this.eventData.amount;
  }

  public get network(): string {
    return this.eventData.network;
  }

  public get gasPrice(): bigint {
    return this.eventData.gasPrice;
  }

  public get gasLimit(): bigint {
    return this.eventData.gasLimit;
  }

  public get estimatedFee(): bigint {
    return this.eventData.estimatedFee;
  }

  public get transferType(): CryptoTransferInitiatedEventData['transferType'] {
    return this.eventData.transferType;
  }

  public get priority(): CryptoTransferInitiatedEventData['priority'] {
    return this.eventData.priority;
  }

  public get initiatedBy(): string {
    return this.eventData.initiatedBy;
  }

  public get memo(): string | undefined {
    return this.eventData.metadata?.memo;
  }

  public get tags(): string[] | undefined {
    return this.eventData.metadata?.tags;
  }

  public get layer2Network(): string | undefined {
    return this.eventData.metadata?.layer2Network;
  }

  public get bridgeUsed(): boolean | undefined {
    return this.eventData.metadata?.bridgeUsed;
  }
}