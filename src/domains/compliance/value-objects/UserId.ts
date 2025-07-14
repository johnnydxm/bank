import { ValueObject } from '../../../shared/domain/ValueObject';

export interface UserIdProps {
  readonly value: string;
}

export class UserId extends ValueObject<UserIdProps> {
  get value(): string {
    return this.props.value;
  }

  public static create(value: string): UserId {
    if (!value || value.trim().length === 0) {
      throw new Error('UserId cannot be empty');
    }

    if (value.length < 3 || value.length > 100) {
      throw new Error('UserId must be between 3 and 100 characters');
    }

    return new UserId({ value: value.trim() });
  }

  public static fromEmail(email: string): UserId {
    return UserId.create(email);
  }

  public static generate(): UserId {
    const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return UserId.create(id);
  }

  public toString(): string {
    return this.value;
  }
}