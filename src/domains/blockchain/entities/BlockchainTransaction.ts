export interface BlockchainTransaction {
  id: string;
  txHash: string;
  from: string;
  to: string;
  amount: string;
  currency: string;
  network: BlockchainNetwork;
  status: BlockchainTransactionStatus;
  gasUsed: string;
  gasPrice: string;
  blockNumber?: number;
  confirmations: number;
  createdAt: Date;
  confirmedAt?: Date;
}

export enum BlockchainNetwork {
  ETHEREUM = 'ethereum',
  POLYGON = 'polygon',
  BSC = 'bsc',
  ARBITRUM = 'arbitrum'
}

export enum BlockchainTransactionStatus {
  PENDING = 'pending',
  CONFIRMING = 'confirming',
  CONFIRMED = 'confirmed',
  FAILED = 'failed'
}

export class BlockchainTransactionEntity implements BlockchainTransaction {
  constructor(
    public readonly id: string,
    public readonly txHash: string,
    public readonly from: string,
    public readonly to: string,
    public readonly amount: string,
    public readonly currency: string,
    public readonly network: BlockchainNetwork,
    public status: BlockchainTransactionStatus,
    public confirmations: number = 0,
    public readonly gasUsed: string = '0',
    public readonly gasPrice: string = '0',
    public readonly blockNumber?: number,
    public readonly createdAt: Date = new Date(),
    public confirmedAt?: Date
  ) {}

  public updateConfirmations(confirmations: number): void {
    this.confirmations = confirmations;
    if (confirmations >= this.getRequiredConfirmations()) {
      this.status = BlockchainTransactionStatus.CONFIRMED;
      this.confirmedAt = new Date();
    }
  }

  public markAsFailed(): void {
    this.status = BlockchainTransactionStatus.FAILED;
  }

  private getRequiredConfirmations(): number {
    switch (this.network) {
      case BlockchainNetwork.ETHEREUM:
        return 12;
      case BlockchainNetwork.POLYGON:
        return 20;
      case BlockchainNetwork.BSC:
        return 15;
      case BlockchainNetwork.ARBITRUM:
        return 1;
      default:
        return 12;
    }
  }

  public isConfirmed(): boolean {
    return this.status === BlockchainTransactionStatus.CONFIRMED;
  }
}