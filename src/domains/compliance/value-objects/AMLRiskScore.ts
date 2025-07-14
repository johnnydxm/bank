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
    return this.props.score;
  }

  get level(): RiskLevel {
    return this.props.level;
  }

  get factors(): string[] {
    return this.props.factors;
  }

  get calculatedAt(): Date {
    return this.props.calculatedAt;
  }

  get validUntil(): Date {
    return this.props.validUntil;
  }

  get confidence(): number {
    return this.props.confidence;
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
      ...this.props,
      factors: [...this.factors, factor]
    });
  }
}