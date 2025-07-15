import { Entity } from '../../../shared/domain/Entity';
import { AMLRiskScore } from '../value-objects/AMLRiskScore';

export interface SanctionsScreeningResult {
  isMatch: boolean;
  matchDetails?: string[] | undefined;
  confidence: number;
  source: string;
  checkedAt: Date;
}

export interface PEPScreeningResult {
  isMatch: boolean;
  matchDetails?: string[] | undefined;
  confidence: number;
  source: string;
  checkedAt: Date;
}

export interface BehaviorAnalysisResult {
  hasUnusualPatterns: boolean;
  highVelocityTransactions: boolean;
  geographicRiskFactors: string[];
  anomalyScore: number;
  analysisDetails: Record<string, any>;
  analyzedAt: Date;
}

export interface RiskAssessmentProps {
  readonly riskScore: AMLRiskScore;
  readonly riskFactors: string[];
  readonly sanctionsResult: SanctionsScreeningResult;
  readonly pepResult: PEPScreeningResult;
  readonly behaviorAnalysis: BehaviorAnalysisResult;
  readonly assessedAt: Date;
  readonly validUntil: Date;
  readonly assessedBy?: string | undefined;
  readonly reviewRequired: boolean;
  readonly notes?: string | undefined;
}

export class RiskAssessment extends Entity {
  private _props: RiskAssessmentProps;

  constructor(id: string, props: RiskAssessmentProps) {
    super(id);
    this._props = { ...props };
  }

  get riskScore(): AMLRiskScore {
    return this._props.riskScore;
  }

  get riskFactors(): string[] {
    return this._props.riskFactors;
  }

  get sanctionsResult(): SanctionsScreeningResult {
    return this._props.sanctionsResult;
  }

  get pepResult(): PEPScreeningResult {
    return this._props.pepResult;
  }

  get behaviorAnalysis(): BehaviorAnalysisResult {
    return this._props.behaviorAnalysis;
  }

  get assessedAt(): Date {
    return this._props.assessedAt;
  }

  get validUntil(): Date {
    return this._props.validUntil;
  }

  get assessedBy(): string | undefined {
    return this._props.assessedBy;
  }

  get reviewRequired(): boolean {
    return this._props.reviewRequired;
  }

  get notes(): string | undefined {
    return this._props.notes;
  }

  public static create(
    riskScore: AMLRiskScore,
    riskFactors: string[],
    sanctionsResult: SanctionsScreeningResult,
    pepResult: PEPScreeningResult,
    behaviorAnalysis: BehaviorAnalysisResult,
    assessedAt: Date
  ): RiskAssessment {
    const id = RiskAssessment.generateId();
    
    // Determine if review is required
    const reviewRequired = riskScore.isHigh() || 
                          sanctionsResult.isMatch || 
                          pepResult.isMatch || 
                          behaviorAnalysis.hasUnusualPatterns ||
                          riskScore.requiresManualReview();

    // Set validity period based on risk level
    const validUntil = new Date(assessedAt);
    if (riskScore.isHigh()) {
      validUntil.setDate(validUntil.getDate() + 30); // 30 days for high risk
    } else {
      validUntil.setDate(validUntil.getDate() + 90); // 90 days for normal risk
    }

    return new RiskAssessment(id, {
      riskScore,
      riskFactors,
      sanctionsResult,
      pepResult,
      behaviorAnalysis,
      assessedAt,
      validUntil,
      reviewRequired
    });
  }

  public static generateId(): string {
    return `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public addNote(note: string, assessedBy?: string): void {
    const currentNotes = this._props.notes || '';
    const timestamp = new Date().toISOString();
    const author = assessedBy || 'system';
    const newNote = `[${timestamp}] ${author}: ${note}`;
    
    this._props = {
      ...this._props,
      notes: currentNotes ? `${currentNotes}\n${newNote}` : newNote,
      assessedBy: assessedBy || this._props.assessedBy
    };
    this.updateTimestamp();
  }

  public markAsReviewed(reviewedBy: string, reviewNotes?: string): void {
    this._props = {
      ...this._props,
      reviewRequired: false,
      assessedBy: reviewedBy
    };
    
    if (reviewNotes) {
      this.addNote(`Review completed: ${reviewNotes}`, reviewedBy);
    }
    
    this.updateTimestamp();
  }

  public isExpired(): boolean {
    return new Date() > this._props.validUntil;
  }

  public isHighRisk(): boolean {
    return this._props.riskScore.isHigh();
  }

  public hasSanctionsMatch(): boolean {
    return this._props.sanctionsResult.isMatch;
  }

  public hasPEPMatch(): boolean {
    return this._props.pepResult.isMatch;
  }

  public hasUnusualBehavior(): boolean {
    return this._props.behaviorAnalysis.hasUnusualPatterns;
  }

  public hasAnyRedFlags(): boolean {
    return this.hasSanctionsMatch() || 
           this.hasPEPMatch() || 
           this.hasUnusualBehavior() || 
           this.isHighRisk();
  }

  public getDaysUntilExpiry(): number {
    const now = new Date();
    const diffTime = this._props.validUntil.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  public getOverallRiskLevel(): 'low' | 'medium' | 'high' | 'critical' {
    if (this.hasSanctionsMatch() || this.hasPEPMatch()) {
      return 'critical';
    }
    
    return this._props.riskScore.level;
  }

  public generateSummary(): string {
    const riskLevel = this.getOverallRiskLevel();
    const score = this._props.riskScore.score;
    const factors = this._props.riskFactors.length;
    
    let summary = `Risk Assessment Summary:\n`;
    summary += `- Overall Risk: ${riskLevel.toUpperCase()} (Score: ${score}/100)\n`;
    summary += `- Risk Factors: ${factors} identified\n`;
    
    if (this.hasSanctionsMatch()) {
      summary += `- ⚠️ SANCTIONS MATCH DETECTED\n`;
    }
    
    if (this.hasPEPMatch()) {
      summary += `- ⚠️ PEP MATCH DETECTED\n`;
    }
    
    if (this.hasUnusualBehavior()) {
      summary += `- ⚠️ Unusual behavior patterns detected\n`;
    }
    
    if (this._props.reviewRequired) {
      summary += `- 📋 Manual review required\n`;
    }
    
    summary += `- Valid until: ${this._props.validUntil.toDateString()}`;
    
    return summary;
  }

  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this._props.riskScore) {
      errors.push('Risk score is required');
    }

    if (!this._props.riskFactors || !Array.isArray(this._props.riskFactors)) {
      errors.push('Risk factors must be an array');
    }

    if (!this._props.sanctionsResult) {
      errors.push('Sanctions screening result is required');
    }

    if (!this._props.pepResult) {
      errors.push('PEP screening result is required');
    }

    if (!this._props.behaviorAnalysis) {
      errors.push('Behavior analysis result is required');
    }

    if (!this._props.assessedAt) {
      errors.push('Assessment date is required');
    }

    if (!this._props.validUntil) {
      errors.push('Validity date is required');
    }

    if (this._props.validUntil <= this._props.assessedAt) {
      errors.push('Validity date must be after assessment date');
    }

    // Validate sanctions result
    if (this._props.sanctionsResult) {
      if (typeof this._props.sanctionsResult.confidence !== 'number' || 
          this._props.sanctionsResult.confidence < 0 || 
          this._props.sanctionsResult.confidence > 1) {
        errors.push('Sanctions result confidence must be between 0 and 1');
      }
    }

    // Validate PEP result
    if (this._props.pepResult) {
      if (typeof this._props.pepResult.confidence !== 'number' || 
          this._props.pepResult.confidence < 0 || 
          this._props.pepResult.confidence > 1) {
        errors.push('PEP result confidence must be between 0 and 1');
      }
    }

    // Validate behavior analysis
    if (this._props.behaviorAnalysis) {
      if (typeof this._props.behaviorAnalysis.anomalyScore !== 'number' || 
          this._props.behaviorAnalysis.anomalyScore < 0 || 
          this._props.behaviorAnalysis.anomalyScore > 100) {
        errors.push('Behavior analysis anomaly score must be between 0 and 100');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}