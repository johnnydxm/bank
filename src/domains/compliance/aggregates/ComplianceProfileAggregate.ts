import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { UserId } from '../value-objects/UserId';
import { KYCStatus } from '../value-objects/KYCStatus';
import { AMLRiskScore } from '../value-objects/AMLRiskScore';
import { ComplianceDocument } from '../entities/ComplianceDocument';
import { ComplianceCheck } from '../entities/ComplianceCheck';
import { IdentityVerification } from '../entities/IdentityVerification';
import { RiskAssessment } from '../entities/RiskAssessment';
import { ComplianceEvent } from '../events/ComplianceEvent';
import { KYCStatusUpdatedEvent } from '../events/KYCStatusUpdatedEvent';
import { RiskScoreUpdatedEvent } from '../events/RiskScoreUpdatedEvent';
import { ComplianceAlertTriggeredEvent } from '../events/ComplianceAlertTriggeredEvent';

/**
 * Compliance Profile Aggregate
 * Manages KYC/AML compliance for users in the DWAY Financial Freedom Platform
 * Ensures regulatory compliance across all financial operations
 */
export class ComplianceProfileAggregate extends AggregateRoot {
  private kycStatus: KYCStatus;
  private amlRiskScore: AMLRiskScore;
  private identityVerification: IdentityVerification | null = null;
  private documents: Map<string, ComplianceDocument> = new Map();
  private complianceChecks: Map<string, ComplianceCheck> = new Map();
  private riskAssessments: RiskAssessment[] = [];
  private sanctionsChecked: boolean = false;
  private pepChecked: boolean = false;
  private lastComplianceReview: Date | null = null;

  constructor(
    private userId: UserId,
    private accountType: AccountType,
    private jurisdiction: string,
    kycStatus: KYCStatus = KYCStatus.PENDING,
    amlRiskScore: AMLRiskScore = AMLRiskScore.UNKNOWN
  ) {
    super(`compliance:${userId.value}`);
    this.kycStatus = kycStatus;
    this.amlRiskScore = amlRiskScore;
  }

  /**
   * Initiate KYC verification process
   */
  public async initiateKYCVerification(
    personalInfo: PersonalInformation,
    identityDocument: IdentityDocumentData,
    kycService: KYCVerificationService
  ): Promise<void> {
    // Business Rule: KYC can only be initiated for pending or failed statuses
    if (this.kycStatus.isCompleted()) {
      throw new Error('KYC verification already completed');
    }

    // Create identity verification request
    this.identityVerification = new IdentityVerification(
      IdentityVerification.generateId(),
      personalInfo,
      identityDocument,
      new Date()
    );

    // Update status to in progress
    this.updateKYCStatus(KYCStatus.IN_PROGRESS);

    // Initiate verification with external KYC provider
    const verificationResult = await kycService.verifyIdentity(
      this.userId,
      personalInfo,
      identityDocument
    );

    // Create compliance check record
    const complianceCheck = new ComplianceCheck(
      ComplianceCheck.generateId(),
      ComplianceCheckType.IDENTITY_VERIFICATION,
      verificationResult.provider,
      verificationResult.status,
      verificationResult.confidence,
      verificationResult.details,
      new Date()
    );

    this.complianceChecks.set(complianceCheck.id, complianceCheck);

    // Update identity verification with results
    this.identityVerification.updateWithResults(verificationResult);

    // Update KYC status based on verification results
    if (verificationResult.status === VerificationStatus.PASSED) {
      this.updateKYCStatus(KYCStatus.VERIFIED);
    } else if (verificationResult.status === VerificationStatus.FAILED) {
      this.updateKYCStatus(KYCStatus.FAILED);
    }
  }

  /**
   * Perform AML screening and risk assessment
   */
  public async performAMLScreening(
    transactionHistory: TransactionData[],
    amlService: AMLScreeningService
  ): Promise<void> {
    // Business Rule: AML screening requires completed KYC
    if (!this.kycStatus.isCompleted()) {
      throw new Error('KYC verification must be completed before AML screening');
    }

    // Perform sanctions screening
    const sanctionsResult = await amlService.checkSanctionsList(
      this.identityVerification!.personalInfo
    );

    // Perform PEP (Politically Exposed Person) screening
    const pepResult = await amlService.checkPEPList(
      this.identityVerification!.personalInfo
    );

    // Analyze transaction patterns for suspicious activity
    const behaviorAnalysis = await amlService.analyzeBehaviorPatterns(
      this.userId,
      transactionHistory
    );

    // Calculate comprehensive risk score
    const riskCalculation = this.calculateRiskScore(
      sanctionsResult,
      pepResult,
      behaviorAnalysis
    );

    // Create risk assessment record
    const riskAssessment = new RiskAssessment(
      RiskAssessment.generateId(),
      riskCalculation.score,
      riskCalculation.factors,
      sanctionsResult,
      pepResult,
      behaviorAnalysis,
      new Date()
    );

    this.riskAssessments.push(riskAssessment);
    this.sanctionsChecked = true;
    this.pepChecked = true;

    // Update AML risk score
    this.updateAMLRiskScore(riskCalculation.score);

    // Trigger alerts if necessary
    if (riskCalculation.score.isHigh()) {
      this.addDomainEvent(new ComplianceAlertTriggeredEvent(
        this.userId,
        AlertType.HIGH_RISK_SCORE,
        riskCalculation.score,
        riskCalculation.factors,
        new Date()
      ));
    }

    if (sanctionsResult.isMatch || pepResult.isMatch) {
      this.addDomainEvent(new ComplianceAlertTriggeredEvent(
        this.userId,
        AlertType.SANCTIONS_PEP_MATCH,
        riskCalculation.score,
        ['Sanctions or PEP list match detected'],
        new Date()
      ));
    }
  }

  /**
   * Upload and verify compliance documents
   */
  public async uploadComplianceDocument(
    documentType: DocumentType,
    documentData: DocumentData,
    documentService: DocumentVerificationService
  ): Promise<ComplianceDocument> {
    // Verify document authenticity
    const verificationResult = await documentService.verifyDocument(
      documentType,
      documentData
    );

    // Create compliance document record
    const document = new ComplianceDocument(
      ComplianceDocument.generateId(),
      documentType,
      documentData.filename,
      documentData.hash,
      verificationResult.status,
      verificationResult.confidence,
      verificationResult.extractedData,
      new Date()
    );

    this.documents.set(document.id, document);

    // Create compliance check for document verification
    const complianceCheck = new ComplianceCheck(
      ComplianceCheck.generateId(),
      ComplianceCheckType.DOCUMENT_VERIFICATION,
      documentService.providerName,
      verificationResult.status,
      verificationResult.confidence,
      verificationResult.details,
      new Date()
    );

    this.complianceChecks.set(complianceCheck.id, complianceCheck);

    return document;
  }

  /**
   * Validate transaction compliance
   */
  public validateTransactionCompliance(
    transaction: TransactionComplianceData,
    rules: ComplianceRules
  ): TransactionComplianceResult {
    const violations: ComplianceViolation[] = [];

    // Check transaction limits
    if (transaction.amount > rules.dailyTransactionLimit) {
      violations.push(new ComplianceViolation(
        ViolationType.DAILY_LIMIT_EXCEEDED,
        `Transaction amount ${transaction.amount} exceeds daily limit ${rules.dailyTransactionLimit}`
      ));
    }

    // Check counterparty screening
    if (rules.requireCounterpartyScreening && !this.isCounterpartyScreened(transaction.counterparty)) {
      violations.push(new ComplianceViolation(
        ViolationType.UNSCREENED_COUNTERPARTY,
        'Counterparty has not been screened for sanctions/PEP'
      ));
    }

    // Check geographic restrictions
    if (rules.geographicRestrictions.includes(transaction.originCountry)) {
      violations.push(new ComplianceViolation(
        ViolationType.GEOGRAPHIC_RESTRICTION,
        `Transactions from ${transaction.originCountry} are restricted`
      ));
    }

    // Check velocity rules
    const velocityViolation = this.checkVelocityRules(transaction, rules);
    if (velocityViolation) {
      violations.push(velocityViolation);
    }

    // Determine overall compliance status
    const isCompliant = violations.length === 0;
    const requiresManualReview = violations.some(v => v.severity === ViolationSeverity.HIGH) ||
                                 this.amlRiskScore.isHigh();

    return new TransactionComplianceResult(
      isCompliant,
      requiresManualReview,
      violations,
      this.amlRiskScore,
      new Date()
    );
  }

  /**
   * Update compliance profile based on ongoing monitoring
   */
  public async updateOngoingMonitoring(
    monitoringData: OngoingMonitoringData,
    monitoringService: OngoingMonitoringService
  ): Promise<void> {
    // Check for changes in risk profile
    const updatedRiskScore = await monitoringService.assessCurrentRisk(
      this.userId,
      monitoringData
    );

    // Check for new sanctions/PEP matches
    const latestScreeningResults = await monitoringService.performLatestScreening(
      this.identityVerification!.personalInfo
    );

    // Update risk score if changed
    if (!updatedRiskScore.equals(this.amlRiskScore)) {
      this.updateAMLRiskScore(updatedRiskScore);
    }

    // Update last compliance review
    this.lastComplianceReview = new Date();

    // Trigger periodic review if necessary
    if (this.isPeriodicReviewDue()) {
      this.addDomainEvent(new ComplianceEvent(
        this.userId,
        ComplianceEventType.PERIODIC_REVIEW_DUE,
        'Periodic compliance review is due',
        new Date()
      ));
    }
  }

  /**
   * Generate compliance report
   */
  public generateComplianceReport(): ComplianceReport {
    return new ComplianceReport(
      this.userId,
      this.kycStatus,
      this.amlRiskScore,
      this.identityVerification,
      Array.from(this.documents.values()),
      Array.from(this.complianceChecks.values()),
      this.riskAssessments,
      this.sanctionsChecked,
      this.pepChecked,
      this.lastComplianceReview,
      new Date()
    );
  }

  // Private helper methods
  private updateKYCStatus(newStatus: KYCStatus): void {
    const oldStatus = this.kycStatus;
    this.kycStatus = newStatus;

    this.addDomainEvent(new KYCStatusUpdatedEvent(
      this.userId,
      oldStatus,
      newStatus,
      new Date()
    ));
  }

  private updateAMLRiskScore(newScore: AMLRiskScore): void {
    const oldScore = this.amlRiskScore;
    this.amlRiskScore = newScore;

    this.addDomainEvent(new RiskScoreUpdatedEvent(
      this.userId,
      oldScore,
      newScore,
      new Date()
    ));
  }

  private calculateRiskScore(
    sanctionsResult: SanctionsScreeningResult,
    pepResult: PEPScreeningResult,
    behaviorAnalysis: BehaviorAnalysisResult
  ): RiskCalculationResult {
    let score = 0;
    const factors: string[] = [];

    // Sanctions/PEP matches are high risk
    if (sanctionsResult.isMatch) {
      score += 80;
      factors.push('Sanctions list match');
    }

    if (pepResult.isMatch) {
      score += 60;
      factors.push('PEP list match');
    }

    // Behavior analysis factors
    if (behaviorAnalysis.hasUnusualPatterns) {
      score += 30;
      factors.push('Unusual transaction patterns detected');
    }

    if (behaviorAnalysis.highVelocityTransactions) {
      score += 20;
      factors.push('High transaction velocity');
    }

    if (behaviorAnalysis.geographicRiskFactors.length > 0) {
      score += 15;
      factors.push('Geographic risk factors');
    }

    // Account type adjustments
    if (this.accountType === AccountType.BUSINESS) {
      score += 10; // Business accounts have slightly higher base risk
    }

    // Cap score at 100
    score = Math.min(100, score);

    return {
      score: AMLRiskScore.fromNumeric(score),
      factors
    };
  }

  private isCounterpartyScreened(counterparty: string): boolean {
    // Check if counterparty has been screened
    // In real implementation, this would query the counterparty database
    return false; // Placeholder
  }

  private checkVelocityRules(
    transaction: TransactionComplianceData,
    rules: ComplianceRules
  ): ComplianceViolation | null {
    // Implement velocity rule checking
    // This would analyze recent transaction patterns
    return null; // Placeholder
  }

  private isPeriodicReviewDue(): boolean {
    if (!this.lastComplianceReview) {
      return true; // Never reviewed
    }

    const daysSinceReview = (Date.now() - this.lastComplianceReview.getTime()) / (1000 * 60 * 60 * 24);
    
    // High-risk profiles need review every 90 days, others every 365 days
    const reviewInterval = this.amlRiskScore.isHigh() ? 90 : 365;
    
    return daysSinceReview >= reviewInterval;
  }

  // Factory method
  public static create(
    userId: UserId,
    accountType: AccountType,
    jurisdiction: string
  ): ComplianceProfileAggregate {
    const aggregate = new ComplianceProfileAggregate(
      userId,
      accountType,
      jurisdiction
    );

    aggregate.addDomainEvent(new ComplianceEvent(
      userId,
      ComplianceEventType.PROFILE_CREATED,
      'Compliance profile created',
      new Date()
    ));

    return aggregate;
  }
}

// Supporting enums and types
export enum AccountType {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business',
  INSTITUTIONAL = 'institutional'
}

export enum ComplianceCheckType {
  IDENTITY_VERIFICATION = 'identity_verification',
  DOCUMENT_VERIFICATION = 'document_verification',
  SANCTIONS_SCREENING = 'sanctions_screening',
  PEP_SCREENING = 'pep_screening',
  BEHAVIOR_ANALYSIS = 'behavior_analysis'
}

export enum DocumentType {
  PASSPORT = 'passport',
  DRIVERS_LICENSE = 'drivers_license',
  NATIONAL_ID = 'national_id',
  PROOF_OF_ADDRESS = 'proof_of_address',
  BUSINESS_REGISTRATION = 'business_registration',
  TAX_CERTIFICATE = 'tax_certificate'
}

export enum VerificationStatus {
  PASSED = 'passed',
  FAILED = 'failed',
  PENDING = 'pending',
  REQUIRES_REVIEW = 'requires_review'
}

export enum ViolationType {
  DAILY_LIMIT_EXCEEDED = 'daily_limit_exceeded',
  UNSCREENED_COUNTERPARTY = 'unscreened_counterparty',
  GEOGRAPHIC_RESTRICTION = 'geographic_restriction',
  VELOCITY_VIOLATION = 'velocity_violation',
  SANCTIONS_MATCH = 'sanctions_match',
  HIGH_RISK_TRANSACTION = 'high_risk_transaction'
}

export enum ViolationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AlertType {
  HIGH_RISK_SCORE = 'high_risk_score',
  SANCTIONS_PEP_MATCH = 'sanctions_pep_match',
  UNUSUAL_BEHAVIOR = 'unusual_behavior',
  VELOCITY_VIOLATION = 'velocity_violation'
}

export enum ComplianceEventType {
  PROFILE_CREATED = 'profile_created',
  KYC_INITIATED = 'kyc_initiated',
  KYC_COMPLETED = 'kyc_completed',
  AML_SCREENING_COMPLETED = 'aml_screening_completed',
  RISK_SCORE_UPDATED = 'risk_score_updated',
  PERIODIC_REVIEW_DUE = 'periodic_review_due',
  COMPLIANCE_ALERT = 'compliance_alert'
}

// Supporting interfaces
export interface PersonalInformation {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  nationality: string;
  address: Address;
  phoneNumber: string;
  email: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface IdentityDocumentData {
  type: DocumentType;
  number: string;
  issuingCountry: string;
  issueDate: Date;
  expiryDate: Date;
  documentImage: string; // Base64 encoded
}

export interface DocumentData {
  filename: string;
  hash: string;
  content: string; // Base64 encoded
  uploadedAt: Date;
}

export interface TransactionData {
  id: string;
  amount: bigint;
  currency: string;
  timestamp: Date;
  counterparty: string;
  type: string;
}

export interface TransactionComplianceData {
  amount: bigint;
  currency: string;
  counterparty: string;
  originCountry: string;
  destinationCountry: string;
  type: string;
  timestamp: Date;
}

export interface ComplianceRules {
  dailyTransactionLimit: bigint;
  monthlyTransactionLimit: bigint;
  requireCounterpartyScreening: boolean;
  geographicRestrictions: string[];
  velocityRules: VelocityRule[];
}

export interface VelocityRule {
  timeWindow: number; // minutes
  maxTransactions: number;
  maxAmount: bigint;
}

export interface OngoingMonitoringData {
  recentTransactions: TransactionData[];
  behaviorChanges: BehaviorChange[];
  externalAlerts: ExternalAlert[];
}

export interface BehaviorChange {
  type: string;
  description: string;
  severity: string;
  detectedAt: Date;
}

export interface ExternalAlert {
  source: string;
  type: string;
  message: string;
  receivedAt: Date;
}

// Result classes
export class ComplianceViolation {
  constructor(
    public type: ViolationType,
    public message: string,
    public severity: ViolationSeverity = ViolationSeverity.MEDIUM
  ) {}
}

export class TransactionComplianceResult {
  constructor(
    public isCompliant: boolean,
    public requiresManualReview: boolean,
    public violations: ComplianceViolation[],
    public riskScore: AMLRiskScore,
    public assessedAt: Date
  ) {}
}

export class ComplianceReport {
  constructor(
    public userId: UserId,
    public kycStatus: KYCStatus,
    public amlRiskScore: AMLRiskScore,
    public identityVerification: IdentityVerification | null,
    public documents: ComplianceDocument[],
    public complianceChecks: ComplianceCheck[],
    public riskAssessments: RiskAssessment[],
    public sanctionsChecked: boolean,
    public pepChecked: boolean,
    public lastReview: Date | null,
    public generatedAt: Date
  ) {}
}

export interface RiskCalculationResult {
  score: AMLRiskScore;
  factors: string[];
}

// Service interfaces
export interface KYCVerificationService {
  verifyIdentity(
    userId: UserId,
    personalInfo: PersonalInformation,
    identityDocument: IdentityDocumentData
  ): Promise<any>;
}

export interface AMLScreeningService {
  checkSanctionsList(personalInfo: PersonalInformation): Promise<SanctionsScreeningResult>;
  checkPEPList(personalInfo: PersonalInformation): Promise<PEPScreeningResult>;
  analyzeBehaviorPatterns(userId: UserId, transactions: TransactionData[]): Promise<BehaviorAnalysisResult>;
}

export interface DocumentVerificationService {
  verifyDocument(type: DocumentType, data: DocumentData): Promise<any>;
  providerName: string;
}

export interface OngoingMonitoringService {
  assessCurrentRisk(userId: UserId, data: OngoingMonitoringData): Promise<AMLRiskScore>;
  performLatestScreening(personalInfo: PersonalInformation): Promise<any>;
}

// Screening result interfaces
export interface SanctionsScreeningResult {
  isMatch: boolean;
  matchDetails?: string[];
  confidence: number;
}

export interface PEPScreeningResult {
  isMatch: boolean;
  matchDetails?: string[];
  confidence: number;
}

export interface BehaviorAnalysisResult {
  hasUnusualPatterns: boolean;
  highVelocityTransactions: boolean;
  geographicRiskFactors: string[];
  anomalyScore: number;
}