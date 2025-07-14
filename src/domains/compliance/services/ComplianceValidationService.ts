import { injectable, inject } from 'inversify';
import { ILogger } from '../../../shared/interfaces/ILogger';
import { TYPES } from '../../../infrastructure/ioc/types';

export interface KYCData {
  userId: string;
  personalInfo: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    ssn?: string;
    phoneNumber?: string;
    email: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
  };
  identityDocuments: Array<{
    type: 'passport' | 'driver_license' | 'state_id' | 'other';
    number: string;
    issuingCountry: string;
    expirationDate: Date;
    documentUrl?: string;
  }>;
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'requires_documents';
  riskScore: number; // 0-100, higher = more risk
  verifiedAt?: Date;
  rejectionReason?: string;
}

export interface AMLCheck {
  userId: string;
  checkType: 'sanctions' | 'pep' | 'adverse_media' | 'transaction_monitoring';
  status: 'pending' | 'clear' | 'flagged' | 'requires_review';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  checkResults: {
    matches: Array<{
      type: string;
      confidence: number;
      details: string;
      source: string;
    }>;
    score: number;
    reasoning: string;
  };
  checkedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
}

export interface TransactionRiskAssessment {
  transactionId: string;
  userId: string;
  amount: bigint;
  currency: string;
  transactionType: 'deposit' | 'withdrawal' | 'transfer' | 'payment';
  riskScore: number;
  riskFactors: Array<{
    factor: string;
    weight: number;
    description: string;
  }>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: 'approve' | 'review' | 'reject' | 'additional_verification';
  complianceFlags: string[];
  assessedAt: Date;
}

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  ruleType: 'kyc' | 'aml' | 'transaction_limit' | 'velocity' | 'geographic' | 'behavioral';
  isActive: boolean;
  parameters: {
    [key: string]: any;
  };
  severity: 'info' | 'warning' | 'critical';
  actions: Array<'flag' | 'block' | 'review' | 'report'>;
}

export interface ComplianceValidationResult {
  isCompliant: boolean;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: 'approve' | 'review' | 'reject' | 'additional_verification';
  violations: Array<{
    ruleId: string;
    ruleName: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    data: any;
  }>;
  flags: string[];
  requiresManualReview: boolean;
}

@injectable()
export class ComplianceValidationService {
  private kycData: Map<string, KYCData> = new Map();
  private amlChecks: Map<string, AMLCheck[]> = new Map();
  private complianceRules: Map<string, ComplianceRule> = new Map();
  private riskAssessments: Map<string, TransactionRiskAssessment> = new Map();

  constructor(
    @inject(TYPES.Logger) private logger: ILogger
  ) {
    this.initializeDefaultRules();
  }

  // ========== KYC Management ==========

  public async submitKYC(kycData: Omit<KYCData, 'verificationStatus' | 'riskScore'>): Promise<KYCData> {
    const fullKycData: KYCData = {
      ...kycData,
      verificationStatus: 'pending',
      riskScore: 0
    };

    // Calculate initial risk score
    fullKycData.riskScore = this.calculateKYCRiskScore(fullKycData);

    this.kycData.set(kycData.userId, fullKycData);

    this.logger.info('KYC data submitted', {
      userId: kycData.userId,
      riskScore: fullKycData.riskScore,
      documentCount: kycData.identityDocuments.length
    });

    // Trigger automatic verification for low-risk profiles
    if (fullKycData.riskScore < 30) {
      await this.processKYCVerification(kycData.userId);
    }

    return fullKycData;
  }

  public async getKYCStatus(userId: string): Promise<KYCData | null> {
    return this.kycData.get(userId) || null;
  }

  public async verifyKYC(userId: string, approved: boolean, rejectionReason?: string): Promise<KYCData> {
    const kycData = this.kycData.get(userId);
    if (!kycData) {
      throw new Error('KYC data not found for user');
    }

    kycData.verificationStatus = approved ? 'verified' : 'rejected';
    kycData.verifiedAt = new Date();
    
    if (!approved) {
      kycData.rejectionReason = rejectionReason || 'Verification failed';
    }

    this.logger.info('KYC verification completed', {
      userId,
      approved,
      riskScore: kycData.riskScore,
      rejectionReason
    });

    return kycData;
  }

  private async processKYCVerification(userId: string): Promise<void> {
    const kycData = this.kycData.get(userId);
    if (!kycData) return;

    try {
      // Simulate automated verification logic
      const verificationResult = await this.performAutomatedKYCVerification(kycData);
      
      if (verificationResult.approved) {
        kycData.verificationStatus = 'verified';
        kycData.verifiedAt = new Date();
      } else {
        kycData.verificationStatus = 'requires_documents';
        kycData.rejectionReason = verificationResult.reason || 'Automated verification failed';
      }

      this.logger.info('Automated KYC verification completed', {
        userId,
        approved: verificationResult.approved,
        reason: verificationResult.reason
      });
    } catch (error) {
      this.logger.error('KYC verification failed', error as Error, {
        userId
      });
    }
  }

  private async performAutomatedKYCVerification(kycData: KYCData): Promise<{ approved: boolean; reason?: string }> {
    // Simulate verification logic
    const hasValidDocuments = kycData.identityDocuments.length > 0;
    const hasCompletePersonalInfo = !!(
      kycData.personalInfo.firstName &&
      kycData.personalInfo.lastName &&
      kycData.personalInfo.email &&
      kycData.personalInfo.address.street
    );

    if (!hasValidDocuments) {
      return { approved: false, reason: 'Missing identity documents' };
    }

    if (!hasCompletePersonalInfo) {
      return { approved: false, reason: 'Incomplete personal information' };
    }

    if (kycData.riskScore > 70) {
      return { approved: false, reason: 'High risk score requires manual review' };
    }

    return { approved: true };
  }

  private calculateKYCRiskScore(kycData: KYCData): number {
    let score = 0;

    // Age factor
    const age = new Date().getFullYear() - kycData.personalInfo.dateOfBirth.getFullYear();
    if (age < 18) score += 50;
    else if (age < 21) score += 20;
    else if (age > 80) score += 10;

    // Document factor
    if (kycData.identityDocuments.length === 0) score += 30;
    else if (kycData.identityDocuments.length === 1) score += 10;

    // Address factor (simplified)
    const highRiskCountries = ['AF', 'IR', 'KP', 'SY'];
    if (highRiskCountries.includes(kycData.personalInfo.address.country)) {
      score += 40;
    }

    // Contact info completeness
    if (!kycData.personalInfo.phoneNumber) score += 5;
    if (!kycData.personalInfo.ssn) score += 10;

    return Math.min(100, Math.max(0, score));
  }

  // ========== AML Screening ==========

  public async performAMLCheck(userId: string, checkType: AMLCheck['checkType']): Promise<AMLCheck> {
    try {
      this.logger.info('Performing AML check', { userId, checkType });

      const result = await this.executeAMLCheck(userId, checkType);
      
      if (!this.amlChecks.has(userId)) {
        this.amlChecks.set(userId, []);
      }
      
      this.amlChecks.get(userId)!.push(result);

      this.logger.info('AML check completed', {
        userId,
        checkType,
        status: result.status,
        riskLevel: result.riskLevel,
        matchCount: result.checkResults.matches.length
      });

      return result;
    } catch (error) {
      this.logger.error('AML check failed', error as Error, {
        userId,
        checkType
      });
      throw error;
    }
  }

  public async getAMLChecks(userId: string): Promise<AMLCheck[]> {
    return this.amlChecks.get(userId) || [];
  }

  private async executeAMLCheck(userId: string, checkType: AMLCheck['checkType']): Promise<AMLCheck> {
    // Simulate AML screening logic
    const kycData = this.kycData.get(userId);
    const userName = kycData ? `${kycData.personalInfo.firstName} ${kycData.personalInfo.lastName}` : 'Unknown User';

    // Simulate screening results based on name and type
    const riskFactors = this.calculateAMLRiskFactors(userName, checkType);
    const matches = this.simulateScreeningMatches(userName, checkType);

    const amlCheck: AMLCheck = {
      userId,
      checkType,
      status: matches.length > 0 ? 'flagged' : 'clear',
      riskLevel: this.calculateRiskLevel(riskFactors.score),
      checkResults: {
        matches,
        score: riskFactors.score,
        reasoning: riskFactors.reasoning
      },
      checkedAt: new Date()
    };

    // High-risk matches require manual review
    if (matches.some(match => match.confidence > 0.8)) {
      amlCheck.status = 'requires_review';
    }

    return amlCheck;
  }

  private calculateAMLRiskFactors(userName: string, checkType: AMLCheck['checkType']): { score: number; reasoning: string } {
    let score = 0;
    const reasons: string[] = [];

    // Simulate risk scoring based on name patterns and check type
    if (checkType === 'sanctions') {
      // Higher base risk for sanctions screening
      score += 20;
      reasons.push('Sanctions screening baseline risk');
    }

    if (checkType === 'pep') {
      // Check for common PEP name patterns (simplified)
      const pepKeywords = ['minister', 'president', 'ambassador', 'senator'];
      if (pepKeywords.some(keyword => userName.toLowerCase().includes(keyword))) {
        score += 40;
        reasons.push('Name contains political keywords');
      }
    }

    // Random variation for demonstration
    const randomFactor = Math.random() * 30;
    score += randomFactor;
    reasons.push(`Random risk factor: ${randomFactor.toFixed(1)}`);

    return {
      score: Math.min(100, score),
      reasoning: reasons.join('; ')
    };
  }

  private simulateScreeningMatches(userName: string, checkType: AMLCheck['checkType']): Array<{
    type: string;
    confidence: number;
    details: string;
    source: string;
  }> {
    const matches: Array<{
      type: string;
      confidence: number;
      details: string;
      source: string;
    }> = [];

    // Simulate potential matches based on name
    if (Math.random() < 0.1) { // 10% chance of a match
      const confidence = Math.random() * 0.7 + 0.3; // 0.3 - 1.0
      
      matches.push({
        type: checkType,
        confidence,
        details: `Potential match found for "${userName}" in ${checkType} database`,
        source: `${checkType}_database_v2024`
      });
    }

    return matches;
  }

  private calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  // ========== Transaction Risk Assessment ==========

  public async assessTransactionRisk(
    transactionId: string,
    userId: string,
    amount: bigint,
    currency: string,
    transactionType: 'deposit' | 'withdrawal' | 'transfer' | 'payment'
  ): Promise<TransactionRiskAssessment> {
    try {
      this.logger.info('Assessing transaction risk', {
        transactionId,
        userId,
        amount: amount.toString(),
        currency,
        transactionType
      });

      const riskFactors = await this.calculateTransactionRiskFactors(
        userId,
        amount,
        currency,
        transactionType
      );

      const assessment: TransactionRiskAssessment = {
        transactionId,
        userId,
        amount,
        currency,
        transactionType,
        riskScore: riskFactors.totalScore,
        riskFactors: riskFactors.factors,
        riskLevel: this.calculateRiskLevel(riskFactors.totalScore),
        recommendedAction: this.getRecommendedAction(riskFactors.totalScore, riskFactors.factors),
        complianceFlags: riskFactors.flags,
        assessedAt: new Date()
      };

      this.riskAssessments.set(transactionId, assessment);

      this.logger.info('Transaction risk assessment completed', {
        transactionId,
        riskScore: assessment.riskScore,
        riskLevel: assessment.riskLevel,
        recommendedAction: assessment.recommendedAction,
        flagCount: assessment.complianceFlags.length
      });

      return assessment;
    } catch (error) {
      this.logger.error('Transaction risk assessment failed', error as Error, {
        transactionId,
        userId
      });
      throw error;
    }
  }

  private async calculateTransactionRiskFactors(
    userId: string,
    amount: bigint,
    currency: string,
    transactionType: string
  ): Promise<{
    totalScore: number;
    factors: Array<{ factor: string; weight: number; description: string }>;
    flags: string[];
  }> {
    const factors: Array<{ factor: string; weight: number; description: string }> = [];
    const flags: string[] = [];
    let totalScore = 0;

    // Amount-based risk
    const amountUSD = Number(amount) / 100; // Assuming cents to dollars
    if (amountUSD > 50000) {
      const factor = { factor: 'high_amount', weight: 30, description: 'Transaction amount exceeds $50,000' };
      factors.push(factor);
      totalScore += factor.weight;
      flags.push('HIGH_AMOUNT');
    } else if (amountUSD > 10000) {
      const factor = { factor: 'elevated_amount', weight: 15, description: 'Transaction amount exceeds $10,000' };
      factors.push(factor);
      totalScore += factor.weight;
      flags.push('ELEVATED_AMOUNT');
    }

    // Currency risk
    const highRiskCurrencies = ['BTC', 'ETH', 'XMR', 'ZEC'];
    if (highRiskCurrencies.includes(currency)) {
      const factor = { factor: 'high_risk_currency', weight: 20, description: `${currency} is a high-risk cryptocurrency` };
      factors.push(factor);
      totalScore += factor.weight;
      flags.push('CRYPTO_CURRENCY');
    }

    // User KYC status
    const kycData = this.kycData.get(userId);
    if (!kycData || kycData.verificationStatus !== 'verified') {
      const factor = { factor: 'unverified_user', weight: 40, description: 'User KYC not verified' };
      factors.push(factor);
      totalScore += factor.weight;
      flags.push('UNVERIFIED_KYC');
    } else if (kycData.riskScore > 50) {
      const factor = { factor: 'high_risk_user', weight: 25, description: 'User has high KYC risk score' };
      factors.push(factor);
      totalScore += factor.weight;
      flags.push('HIGH_RISK_USER');
    }

    // Transaction type risk
    if (transactionType === 'withdrawal') {
      const factor = { factor: 'withdrawal_risk', weight: 10, description: 'Withdrawals carry inherent risk' };
      factors.push(factor);
      totalScore += factor.weight;
    }

    // Velocity checks (simplified)
    const recentTransactions = Array.from(this.riskAssessments.values())
      .filter(assessment => 
        assessment.userId === userId && 
        Date.now() - assessment.assessedAt.getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
      );

    if (recentTransactions.length > 10) {
      const factor = { factor: 'high_velocity', weight: 25, description: 'High transaction velocity in last 24 hours' };
      factors.push(factor);
      totalScore += factor.weight;
      flags.push('HIGH_VELOCITY');
    }

    // AML screening results
    const amlChecks = this.amlChecks.get(userId) || [];
    const recentAMLFlags = amlChecks.filter(check => 
      check.status === 'flagged' && 
      Date.now() - check.checkedAt.getTime() < 30 * 24 * 60 * 60 * 1000 // Last 30 days
    );

    if (recentAMLFlags.length > 0) {
      const factor = { factor: 'aml_flags', weight: 35, description: 'Recent AML screening flags found' };
      factors.push(factor);
      totalScore += factor.weight;
      flags.push('AML_FLAG');
    }

    return {
      totalScore: Math.min(100, totalScore),
      factors,
      flags
    };
  }

  private getRecommendedAction(
    riskScore: number,
    riskFactors: Array<{ factor: string; weight: number; description: string }>
  ): 'approve' | 'review' | 'reject' | 'additional_verification' {
    // Critical factors that require immediate review
    const criticalFactors = ['unverified_user', 'aml_flags'];
    if (riskFactors.some(factor => criticalFactors.includes(factor.factor))) {
      return 'additional_verification';
    }

    if (riskScore >= 80) return 'reject';
    if (riskScore >= 60) return 'review';
    if (riskScore >= 30) return 'additional_verification';
    
    return 'approve';
  }

  // ========== Compliance Validation ==========

  public async validateCompliance(
    userId: string,
    transactionData: {
      amount: bigint;
      currency: string;
      type: string;
      destination?: string;
    }
  ): Promise<ComplianceValidationResult> {
    const violations: Array<{
      ruleId: string;
      ruleName: string;
      severity: 'info' | 'warning' | 'critical';
      message: string;
      data: any;
    }> = [];

    const flags: string[] = [];
    let maxRiskScore = 0;

    // Check all active compliance rules
    for (const rule of this.complianceRules.values()) {
      if (!rule.isActive) continue;

      const violation = await this.checkComplianceRule(rule, userId, transactionData);
      if (violation) {
        violations.push(violation);
        flags.push(...rule.actions);
        
        // Calculate risk impact
        const riskImpact = rule.severity === 'critical' ? 40 : rule.severity === 'warning' ? 20 : 10;
        maxRiskScore = Math.max(maxRiskScore, riskImpact);
      }
    }

    const riskLevel = this.calculateRiskLevel(maxRiskScore);
    const hasкритicalViolations = violations.some(v => v.severity === 'critical');
    const hasWarningViolations = violations.some(v => v.severity === 'warning');

    let recommendedAction: 'approve' | 'review' | 'reject' | 'additional_verification';
    if (hasкритicalViolations) {
      recommendedAction = 'reject';
    } else if (hasWarningViolations || maxRiskScore >= 60) {
      recommendedAction = 'review';
    } else if (maxRiskScore >= 30) {
      recommendedAction = 'additional_verification';
    } else {
      recommendedAction = 'approve';
    }

    return {
      isCompliant: violations.length === 0 || !hasкритicalViolations,
      riskScore: maxRiskScore,
      riskLevel,
      recommendedAction,
      violations,
      flags: [...new Set(flags)],
      requiresManualReview: hasкритicalViolations || hasWarningViolations
    };
  }

  private async checkComplianceRule(
    rule: ComplianceRule,
    userId: string,
    transactionData: any
  ): Promise<{ ruleId: string; ruleName: string; severity: 'info' | 'warning' | 'critical'; message: string; data: any } | null> {
    switch (rule.ruleType) {
      case 'transaction_limit':
        return this.checkTransactionLimit(rule, transactionData);
      
      case 'kyc':
        return await this.checkKYCRule(rule, userId);
      
      case 'velocity':
        return this.checkVelocityRule(rule, userId, transactionData);
      
      default:
        return null;
    }
  }

  private checkTransactionLimit(rule: ComplianceRule, transactionData: any): any {
    const { maxAmount, currency } = rule.parameters;
    
    if (transactionData.currency === currency && transactionData.amount > BigInt(maxAmount * 100)) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        message: `Transaction amount ${Number(transactionData.amount) / 100} ${currency} exceeds limit of ${maxAmount} ${currency}`,
        data: { amount: transactionData.amount, limit: maxAmount, currency }
      };
    }
    
    return null;
  }

  private async checkKYCRule(rule: ComplianceRule, userId: string): Promise<any> {
    const kycData = this.kycData.get(userId);
    
    if (!kycData || kycData.verificationStatus !== 'verified') {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        message: 'KYC verification required for this transaction',
        data: { userId, kycStatus: kycData?.verificationStatus || 'missing' }
      };
    }
    
    return null;
  }

  private checkVelocityRule(rule: ComplianceRule, userId: string, transactionData: any): any {
    const { maxTransactions, timeWindowHours } = rule.parameters;
    const timeWindow = timeWindowHours * 60 * 60 * 1000; // Convert to milliseconds
    
    const recentTransactions = Array.from(this.riskAssessments.values())
      .filter(assessment => 
        assessment.userId === userId && 
        Date.now() - assessment.assessedAt.getTime() < timeWindow
      );
    
    if (recentTransactions.length >= maxTransactions) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        message: `Transaction velocity limit exceeded: ${recentTransactions.length} transactions in ${timeWindowHours} hours`,
        data: { userId, count: recentTransactions.length, limit: maxTransactions, timeWindow: timeWindowHours }
      };
    }
    
    return null;
  }

  // ========== Rule Management ==========

  private initializeDefaultRules(): void {
    const defaultRules: ComplianceRule[] = [
      {
        id: 'kyc_required',
        name: 'KYC Verification Required',
        description: 'All users must complete KYC verification',
        ruleType: 'kyc',
        isActive: true,
        parameters: {},
        severity: 'critical',
        actions: ['block']
      },
      {
        id: 'usd_transaction_limit',
        name: 'USD Transaction Limit',
        description: 'Single USD transaction limit of $50,000',
        ruleType: 'transaction_limit',
        isActive: true,
        parameters: { maxAmount: 50000, currency: 'USD' },
        severity: 'warning',
        actions: ['review']
      },
      {
        id: 'crypto_transaction_limit',
        name: 'Cryptocurrency Transaction Limit',
        description: 'Single cryptocurrency transaction limit of $25,000',
        ruleType: 'transaction_limit',
        isActive: true,
        parameters: { maxAmount: 25000, currency: 'BTC' },
        severity: 'warning',
        actions: ['review']
      },
      {
        id: 'velocity_limit',
        name: 'Transaction Velocity Limit',
        description: 'Maximum 20 transactions per 24 hours',
        ruleType: 'velocity',
        isActive: true,
        parameters: { maxTransactions: 20, timeWindowHours: 24 },
        severity: 'warning',
        actions: ['flag', 'review']
      }
    ];

    defaultRules.forEach(rule => this.complianceRules.set(rule.id, rule));

    this.logger.info('Default compliance rules initialized', {
      ruleCount: defaultRules.length
    });
  }

  public addComplianceRule(rule: ComplianceRule): void {
    this.complianceRules.set(rule.id, rule);
    this.logger.info('Compliance rule added', { ruleId: rule.id, ruleName: rule.name });
  }

  public getComplianceRules(): ComplianceRule[] {
    return Array.from(this.complianceRules.values());
  }

  // ========== Metrics and Reporting ==========

  public getComplianceMetrics(): {
    totalUsers: number;
    verifiedUsers: number;
    pendingKYC: number;
    amlChecks: number;
    flaggedUsers: number;
    riskAssessments: number;
    highRiskTransactions: number;
  } {
    const kycEntries = Array.from(this.kycData.values());
    const allAMLChecks = Array.from(this.amlChecks.values()).flat();
    const assessments = Array.from(this.riskAssessments.values());

    return {
      totalUsers: kycEntries.length,
      verifiedUsers: kycEntries.filter(kyc => kyc.verificationStatus === 'verified').length,
      pendingKYC: kycEntries.filter(kyc => kyc.verificationStatus === 'pending').length,
      amlChecks: allAMLChecks.length,
      flaggedUsers: Array.from(this.amlChecks.keys()).filter(userId => 
        this.amlChecks.get(userId)!.some(check => check.status === 'flagged')
      ).length,
      riskAssessments: assessments.length,
      highRiskTransactions: assessments.filter(assessment => 
        assessment.riskLevel === 'high' || assessment.riskLevel === 'critical'
      ).length
    };
  }
}