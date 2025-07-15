import { ValueObject } from '../../../shared/domain/ValueObject';

export enum TransferStatusEnum {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

export class TransferStatus extends ValueObject<TransferStatusEnum> {
  constructor(value: TransferStatusEnum) {
    super(value);
  }

  protected validate(): void {
    if (!Object.values(TransferStatusEnum).includes(this._value)) {
      throw new Error(`Invalid transfer status: ${this._value}`);
    }
  }

  public get value(): TransferStatusEnum {
    return this._value;
  }

  public equals(other: TransferStatus): boolean {
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }

  // Status check methods
  public isPending(): boolean {
    return this._value === TransferStatusEnum.PENDING;
  }

  public isAccepted(): boolean {
    return this._value === TransferStatusEnum.ACCEPTED;
  }

  public isDeclined(): boolean {
    return this._value === TransferStatusEnum.DECLINED;
  }

  public isCompleted(): boolean {
    return this._value === TransferStatusEnum.COMPLETED;
  }

  public isExpired(): boolean {
    return this._value === TransferStatusEnum.EXPIRED;
  }

  public isCancelled(): boolean {
    return this._value === TransferStatusEnum.CANCELLED;
  }

  public isFailed(): boolean {
    return this._value === TransferStatusEnum.FAILED;
  }

  public isFinal(): boolean {
    return this.isCompleted() || this.isDeclined() || this.isExpired() || this.isCancelled() || this.isFailed();
  }

  public isActive(): boolean {
    return this.isPending() || this.isAccepted();
  }

  public canTransitionTo(newStatus: TransferStatus): boolean {
    const currentStatus = this._value;
    const targetStatus = newStatus.value;

    // Define valid state transitions
    const validTransitions: Record<TransferStatusEnum, TransferStatusEnum[]> = {
      [TransferStatusEnum.PENDING]: [
        TransferStatusEnum.ACCEPTED,
        TransferStatusEnum.DECLINED,
        TransferStatusEnum.EXPIRED,
        TransferStatusEnum.CANCELLED,
        TransferStatusEnum.FAILED
      ],
      [TransferStatusEnum.ACCEPTED]: [
        TransferStatusEnum.COMPLETED,
        TransferStatusEnum.FAILED
      ],
      [TransferStatusEnum.DECLINED]: [], // Final state
      [TransferStatusEnum.COMPLETED]: [], // Final state
      [TransferStatusEnum.EXPIRED]: [], // Final state
      [TransferStatusEnum.CANCELLED]: [], // Final state
      [TransferStatusEnum.FAILED]: [] // Final state
    };

    return validTransitions[currentStatus]?.includes(targetStatus) || false;
  }

  // Factory methods for each status
  public static pending(): TransferStatus {
    return new TransferStatus(TransferStatusEnum.PENDING);
  }

  public static accepted(): TransferStatus {
    return new TransferStatus(TransferStatusEnum.ACCEPTED);
  }

  public static declined(): TransferStatus {
    return new TransferStatus(TransferStatusEnum.DECLINED);
  }

  public static completed(): TransferStatus {
    return new TransferStatus(TransferStatusEnum.COMPLETED);
  }

  public static expired(): TransferStatus {
    return new TransferStatus(TransferStatusEnum.EXPIRED);
  }

  public static cancelled(): TransferStatus {
    return new TransferStatus(TransferStatusEnum.CANCELLED);
  }

  public static failed(): TransferStatus {
    return new TransferStatus(TransferStatusEnum.FAILED);
  }

  // Create from string
  public static from(value: string): TransferStatus {
    const enumValue = Object.values(TransferStatusEnum).find(
      status => status === value.toLowerCase()
    );
    
    if (!enumValue) {
      throw new Error(`Invalid transfer status: ${value}`);
    }
    
    return new TransferStatus(enumValue);
  }
}

// For backward compatibility, export the enum constants
export const TransferStatusConstants = {
  PENDING: TransferStatusEnum.PENDING,
  ACCEPTED: TransferStatusEnum.ACCEPTED,
  DECLINED: TransferStatusEnum.DECLINED,
  COMPLETED: TransferStatusEnum.COMPLETED,
  EXPIRED: TransferStatusEnum.EXPIRED,
  CANCELLED: TransferStatusEnum.CANCELLED,
  FAILED: TransferStatusEnum.FAILED
} as const;