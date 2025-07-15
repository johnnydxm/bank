import { BaseDomainEvent } from '../../../shared/domain/DomainEvent';
import { UserId } from '../value-objects/UserId';
import { AMLRiskScore } from '../value-objects/AMLRiskScore';

export type AlertType = 
  | 'high_risk_score'
  | 'sanctions_pep_match'
  | 'unusual_behavior'
  | 'velocity_violation'
  | 'document_fraud_suspected'
  | 'geographic_risk'
  | 'transaction_pattern_anomaly'
  | 'compliance_rule_violation';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ComplianceAlertTriggeredEventData {
  userId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  riskScore: {
    score: number;
    level: string;
    factors: string[];
    calculatedAt: string;
    confidence: number;
  };
  alertFactors: string[];
  triggeredAt: string;
  description: string;
  requiresImmediateAction: boolean;
  relatedEntityId?: string | undefined;
  relatedEntityType?: string | undefined;
  additionalContext?: Record<string, any> | undefined;
}

export class ComplianceAlertTriggeredEvent extends BaseDomainEvent {
  constructor(
    userId: UserId,
    alertType: AlertType,
    riskScore: AMLRiskScore,
    alertFactors: string[],
    triggeredAt: Date,
    description?: string | undefined,
    relatedEntityId?: string | undefined,
    relatedEntityType?: string | undefined,
    additionalContext?: Record<string, any> | undefined,
    metadata?: Record<string, any> | undefined
  ) {
    const severity = ComplianceAlertTriggeredEvent.calculateSeverity(alertType, riskScore);
    const requiresImmediateAction = ComplianceAlertTriggeredEvent.requiresImmediateAction(alertType, severity);
    
    super(
      'ComplianceAlertTriggered',
      `compliance:${userId.stringValue}`,
      'ComplianceProfileAggregate',
      {
        userId: userId.stringValue,
        alertType,
        severity,
        riskScore: {
          score: riskScore.score,
          level: riskScore.level,
          factors: [...riskScore.factors],
          calculatedAt: riskScore.calculatedAt.toISOString(),
          confidence: riskScore.confidence
        },
        alertFactors: [...alertFactors],
        triggeredAt: triggeredAt.toISOString(),
        description: description || ComplianceAlertTriggeredEvent.getDefaultDescription(alertType),
        requiresImmediateAction,
        relatedEntityId,
        relatedEntityType,
        additionalContext
      },
      metadata,
      '1.0.0'
    );
  }

  public get userId(): string {
    return this.eventData.userId;
  }

  public get alertType(): AlertType {
    return this.eventData.alertType;
  }

  public get severity(): AlertSeverity {
    return this.eventData.severity;
  }

  public get riskScore(): ComplianceAlertTriggeredEventData['riskScore'] {
    return this.eventData.riskScore;
  }

  public get alertFactors(): string[] {
    return this.eventData.alertFactors;
  }

  public get triggeredAtDate(): Date {
    return new Date(this.eventData.triggeredAt);
  }

  public get description(): string {
    return this.eventData.description;
  }

  public get requiresImmediateAction(): boolean {
    return this.eventData.requiresImmediateAction;
  }

  public get relatedEntityId(): string | undefined {
    return this.eventData.relatedEntityId;
  }

  public get relatedEntityType(): string | undefined {
    return this.eventData.relatedEntityType;
  }

  public get additionalContext(): Record<string, any> | undefined {
    return this.eventData.additionalContext;
  }

  public get isCriticalAlert(): boolean {
    return this.severity === 'critical';
  }

  public get isHighPriorityAlert(): boolean {
    return this.severity === 'critical' || this.severity === 'high';
  }

  public get alertSummary(): string {
    const urgency = this.requiresImmediateAction ? '🚨 URGENT' : '⚠️ Alert';
    return `${urgency} - ${this.alertType.toUpperCase()} (${this.severity.toUpperCase()})`;
  }

  private static calculateSeverity(alertType: AlertType, riskScore: AMLRiskScore): AlertSeverity {
    // Critical alerts
    if (alertType === 'sanctions_pep_match' || alertType === 'document_fraud_suspected') {
      return 'critical';
    }

    // High severity based on risk score
    if (riskScore.level === 'critical') {
      return 'critical';
    }
    
    if (riskScore.level === 'high') {
      return 'high';
    }

    // Medium severity for behavioral anomalies
    if (alertType === 'unusual_behavior' || 
        alertType === 'transaction_pattern_anomaly' || 
        alertType === 'velocity_violation') {
      return riskScore.level === 'medium' ? 'medium' : 'high';
    }

    // Default to medium for other alerts
    return 'medium';
  }

  private static requiresImmediateAction(alertType: AlertType, severity: AlertSeverity): boolean {
    // Critical severity always requires immediate action
    if (severity === 'critical') {
      return true;
    }

    // Specific alert types that always require immediate action
    const immediateActionAlerts: AlertType[] = [
      'sanctions_pep_match',
      'document_fraud_suspected',
      'compliance_rule_violation'
    ];

    return immediateActionAlerts.includes(alertType);
  }

  private static getDefaultDescription(alertType: AlertType): string {
    const descriptions: Record<AlertType, string> = {
      'high_risk_score': 'User risk score has exceeded acceptable thresholds',
      'sanctions_pep_match': 'Potential match found in sanctions or PEP screening',
      'unusual_behavior': 'Unusual behavioral patterns detected in user activity',
      'velocity_violation': 'Transaction velocity limits have been exceeded',
      'document_fraud_suspected': 'Suspicious activity detected in document verification',
      'geographic_risk': 'High-risk geographic activity patterns identified',
      'transaction_pattern_anomaly': 'Anomalous transaction patterns detected',
      'compliance_rule_violation': 'Compliance rule violation has been detected'
    };

    return descriptions[alertType] || 'Compliance alert triggered';
  }
}