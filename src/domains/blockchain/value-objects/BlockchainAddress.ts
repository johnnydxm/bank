import { ValueObject } from '../../../shared/domain/ValueObject';

export interface BlockchainAddressProps {
  address: string;
  network: string;
  type: 'evm' | 'bitcoin' | 'solana' | 'other';
}

export class BlockchainAddress extends ValueObject<BlockchainAddressProps> {
  constructor(address: string, network: string, type: BlockchainAddressProps['type']) {
    super({ address, network, type });
  }

  public get address(): string {
    return this._value.address;
  }

  public getValue(): string {
    return this._value.address;
  }

  public get network(): string {
    return this._value.network;
  }

  public get type(): BlockchainAddressProps['type'] {
    return this._value.type;
  }

  protected validate(): void {
    if (!this._value.address || this._value.address.trim().length === 0) {
      throw new Error('Blockchain address cannot be empty');
    }

    if (!this._value.network || this._value.network.trim().length === 0) {
      throw new Error('Network cannot be empty');
    }

    // Basic validation based on address type
    switch (this._value.type) {
      case 'evm':
        this.validateEvmAddress();
        break;
      case 'bitcoin':
        this.validateBitcoinAddress();
        break;
      case 'solana':
        this.validateSolanaAddress();
        break;
    }
  }

  private validateEvmAddress(): void {
    if (!/^0x[a-fA-F0-9]{40}$/.test(this._value.address)) {
      throw new Error('Invalid EVM address format');
    }
  }

  private validateBitcoinAddress(): void {
    if (!/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(this._value.address) && 
        !/^bc1[a-z0-9]{39,59}$/.test(this._value.address)) {
      throw new Error('Invalid Bitcoin address format');
    }
  }

  private validateSolanaAddress(): void {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(this._value.address)) {
      throw new Error('Invalid Solana address format');
    }
  }

  public isSameNetwork(other: BlockchainAddress): boolean {
    return this._value.network === other._value.network;
  }

  public isEvm(): boolean {
    return this._value.type === 'evm';
  }

  public isBitcoin(): boolean {
    return this._value.type === 'bitcoin';
  }

  public isSolana(): boolean {
    return this._value.type === 'solana';
  }
}