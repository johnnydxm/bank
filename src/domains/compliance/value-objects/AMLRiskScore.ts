import { ValueObject } from '../../../shared/domain/ValueObject';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AMLRiskScoreProps {
  readonly score: number; // 0-100
  readonly level: RiskLevel;
  readonly factors: string[];
  readonly calculatedAt: Date;
  readonly validUntil: Date;
  readonly confidence: number; // 0-1
}

export class AMLRiskScore extends ValueObject<AMLRiskScoreProps> {
  get score(): number {
    return this._value.score;
  }

  get level(): RiskLevel {
    return this._value.level;
  }

  get factors(): string[] {
    return this._value.factors;
  }

  get calculatedAt(): Date {
    return this._value.calculatedAt;
  }

  get validUntil(): Date {
    return this._value.validUntil;
  }

  get confidence(): number {
    return this._value.confidence;
  }

  protected validate(): void {
    if (this._value.score < 0 || this._value.score > 100) {
      throw new Error('AML risk score must be between 0 and 100');
    }

    if (this._value.confidence < 0 || this._value.confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }

    if (!this._value.level) {
      throw new Error('Risk level is required');
    }

    if (!this._value.calculatedAt) {
      throw new Error('Calculated date is required');
    }

    if (!this._value.validUntil) {
      throw new Error('Valid until date is required');
    }

    const validLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
    if (!validLevels.includes(this._value.level)) {
      throw new Error(`Invalid risk level: ${this._value.level}`);
    }
  }

  public static create(score: number, factors: string[], confidence: number = 0.8): AMLRiskScore {
    if (score < 0 || score > 100) {
      throw new Error('AML risk score must be between 0 and 100');
    }

    if (confidence < 0 || confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }

    const level = AMLRiskScore.calculateRiskLevel(score);
    const calculatedAt = new Date();
    const validUntil = new Date(calculatedAt.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days

    return new AMLRiskScore({
      score,
      level,
      factors,
      calculatedAt,
      validUntil,
      confidence
    });
  }

  public static low(factors: string[] = []): AMLRiskScore {
    return AMLRiskScore.create(15, factors, 0.9);
  }

  public static medium(factors: string[]): AMLRiskScore {
    return AMLRiskScore.create(45, factors, 0.8);
  }

  public static high(factors: string[]): AMLRiskScore {
    return AMLRiskScore.create(75, factors, 0.7);
  }

  public static critical(factors: string[]): AMLRiskScore {
    return AMLRiskScore.create(95, factors, 0.9);
  }

  private static calculateRiskLevel(score: number): RiskLevel {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  public isExpired(): boolean {
    return new Date() > this.validUntil;
  }

  public requiresManualReview(): boolean {
    return this.level === 'high' || this.level === 'critical' || this.confidence < 0.7;
  }

  public isActionRequired(): boolean {
    return this.level === 'critical' || (this.level === 'high' && this.confidence > 0.8);
  }

  public getValidityDays(): number {
    const now = new Date();
    const diffTime = this.validUntil.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  public addFactor(factor: string): AMLRiskScore {
    if (this.factors.includes(factor)) {
      return this;
    }

    return new AMLRiskScore({
      ...this._value,
      factors: [...this.factors, factor]
    });
  }

  public isHigh(): boolean {
    return this.level === 'high' || this.level === 'critical';
  }

  public equals(other: AMLRiskScore): boolean {
    return super.equals(other);
  }

  // Static factory methods for enum-like access
  public static get UNKNOWN(): AMLRiskScore {
    return AMLRiskScore.create(0, ['Unknown risk profile'], 0.5);
  }

  public static fromNumeric(score: number): AMLRiskScore {
    return AMLRiskScore.create(score, [`Score: ${score}`]);
  }
}