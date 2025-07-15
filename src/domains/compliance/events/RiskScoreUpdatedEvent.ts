import { BaseDomainEvent } from '../../../shared/domain/DomainEvent';
import { UserId } from '../value-objects/UserId';
import { AMLRiskScore } from '../value-objects/AMLRiskScore';

export interface RiskScoreUpdatedEventData {
  userId: string;
  oldScore: {
    score: number;
    level: string;
    factors: string[];
    calculatedAt: string;
    confidence: number;
  };
  newScore: {
    score: number;
    level: string;
    factors: string[];
    calculatedAt: string;
    confidence: number;
  };
  updatedAt: string;
  trigger?: string | undefined;
  assessmentId?: string | undefined;
}

export class RiskScoreUpdatedEvent extends BaseDomainEvent {
  constructor(
    userId: UserId,
    oldScore: AMLRiskScore,
    newScore: AMLRiskScore,
    updatedAt: Date,
    trigger?: string | undefined,
    assessmentId?: string | undefined,
    metadata?: Record<string, any> | undefined
  ) {
    super(
      'RiskScoreUpdated',
      `compliance:${userId.stringValue}`,
      'ComplianceProfileAggregate',
      {
        userId: userId.stringValue,
        oldScore: {
          score: oldScore.score,
          level: oldScore.level,
          factors: [...oldScore.factors],
          calculatedAt: oldScore.calculatedAt.toISOString(),
          confidence: oldScore.confidence
        },
        newScore: {
          score: newScore.score,
          level: newScore.level,
          factors: [...newScore.factors],
          calculatedAt: newScore.calculatedAt.toISOString(),
          confidence: newScore.confidence
        },
        updatedAt: updatedAt.toISOString(),
        trigger,
        assessmentId
      },
      metadata,
      '1.0.0'
    );
  }

  public get userId(): string {
    return this.eventData.userId;
  }

  public get oldScore(): RiskScoreUpdatedEventData['oldScore'] {
    return this.eventData.oldScore;
  }

  public get newScore(): RiskScoreUpdatedEventData['newScore'] {
    return this.eventData.newScore;
  }

  public get updatedAtDate(): Date {
    return new Date(this.eventData.updatedAt);
  }

  public get trigger(): string | undefined {
    return this.eventData.trigger;
  }

  public get assessmentId(): string | undefined {
    return this.eventData.assessmentId;
  }

  public get scoreChange(): number {
    return this.newScore.score - this.oldScore.score;
  }

  public get isRiskIncrease(): boolean {
    return this.scoreChange > 0;
  }

  public get isRiskDecrease(): boolean {
    return this.scoreChange < 0;
  }

  public get isSignificantChange(): boolean {
    return Math.abs(this.scoreChange) >= 10; // 10+ point change is significant
  }

  public get isLevelChange(): boolean {
    return this.oldScore.level !== this.newScore.level;
  }

  public get isEscalation(): boolean {
    const levels = ['low', 'medium', 'high', 'critical'];
    const oldIndex = levels.indexOf(this.oldScore.level);
    const newIndex = levels.indexOf(this.newScore.level);
    return newIndex > oldIndex;
  }

  public get isDeescalation(): boolean {
    const levels = ['low', 'medium', 'high', 'critical'];
    const oldIndex = levels.indexOf(this.oldScore.level);
    const newIndex = levels.indexOf(this.newScore.level);
    return newIndex < oldIndex;
  }

  public get newFactors(): string[] {
    return this.newScore.factors.filter(factor => !this.oldScore.factors.includes(factor));
  }

  public get removedFactors(): string[] {
    return this.oldScore.factors.filter(factor => !this.newScore.factors.includes(factor));
  }
}