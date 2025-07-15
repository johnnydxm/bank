import { ValueObject } from '../../../shared/domain/ValueObject';

export interface CardDetailsProps {
  holderName: string;
  maskedNumber: string;
  expiryDate: string;
  expiryMonth: string;
  expiryYear: string;
  cardType: string;
  brand: string;
  issuerCountry: string;
  // Bank account fields (optional)
  accountNumber?: string | undefined;
  routingNumber?: string | undefined;
  accountType?: string | undefined;
  maskedAccountNumber?: string | undefined;
  // Additional metadata
  lastFourDigits: string;
  binRange: string;
  isDebit: boolean;
  isCredit: boolean;
  isVirtual: boolean;
  issuingBank?: string | undefined;
}

export class CardDetails extends ValueObject<CardDetailsProps> {
  constructor(props: CardDetailsProps) {
    super(props);
  }

  protected validate(): void {
    if (!this._value.holderName || this._value.holderName.trim().length === 0) {
      throw new Error('Card holder name is required');
    }

    if (!this._value.maskedNumber || this._value.maskedNumber.trim().length === 0) {
      throw new Error('Masked card number is required');
    }

    if (!this._value.expiryDate || this._value.expiryDate.trim().length === 0) {
      throw new Error('Expiry date is required');
    }

    if (!this._value.expiryMonth || !this._value.expiryYear) {
      throw new Error('Expiry month and year are required');
    }

    if (!this._value.cardType || this._value.cardType.trim().length === 0) {
      throw new Error('Card type is required');
    }

    if (!this._value.brand || this._value.brand.trim().length === 0) {
      throw new Error('Card brand is required');
    }

    if (!this._value.issuerCountry || this._value.issuerCountry.length !== 2) {
      throw new Error('Issuer country must be a valid 2-character country code');
    }

    if (!this._value.lastFourDigits || !/^\d{4}$/.test(this._value.lastFourDigits)) {
      throw new Error('Last four digits must be exactly 4 digits');
    }

    if (!this._value.binRange || !/^\d{6}$/.test(this._value.binRange)) {
      throw new Error('BIN range must be exactly 6 digits');
    }

    // Validate expiry date format
    if (!/^\d{2}\/\d{2,4}$/.test(this._value.expiryDate)) {
      throw new Error('Expiry date must be in MM/YY or MM/YYYY format');
    }

    // Validate expiry month
    const month = parseInt(this._value.expiryMonth, 10);
    if (month < 1 || month > 12) {
      throw new Error('Expiry month must be between 1 and 12');
    }

    // Validate expiry year
    const year = parseInt(this._value.expiryYear, 10);
    const currentYear = new Date().getFullYear();
    if (year < currentYear || year > currentYear + 20) {
      throw new Error('Expiry year must be between current year and 20 years from now');
    }

    // Validate masked number format
    if (!/^[\*\d\-\s]+$/.test(this._value.maskedNumber)) {
      throw new Error('Masked number must contain only digits, asterisks, hyphens, and spaces');
    }

    // Validate card type combinations
    if (this._value.isDebit && this._value.isCredit) {
      throw new Error('Card cannot be both debit and credit');
    }

    if (!this._value.isDebit && !this._value.isCredit && !this._value.isVirtual) {
      throw new Error('Card must be either debit, credit, or virtual');
    }

    // Validate bank account fields if provided
    if (this._value.accountNumber && !this._value.routingNumber) {
      throw new Error('Routing number is required when account number is provided');
    }

    if (this._value.routingNumber && !this._value.accountNumber) {
      throw new Error('Account number is required when routing number is provided');
    }

    if (this._value.accountNumber && !/^\d{4,17}$/.test(this._value.accountNumber)) {
      throw new Error('Account number must be between 4 and 17 digits');
    }

    if (this._value.routingNumber && !/^\d{9}$/.test(this._value.routingNumber)) {
      throw new Error('Routing number must be exactly 9 digits');
    }

    if (this._value.accountType && !['checking', 'savings', 'business'].includes(this._value.accountType)) {
      throw new Error('Account type must be checking, savings, or business');
    }
  }

  // Getters
  public get holderName(): string {
    return this._value.holderName;
  }

  public get maskedNumber(): string {
    return this._value.maskedNumber;
  }

  public get expiryDate(): string {
    return this._value.expiryDate;
  }

  public get expiryMonth(): string {
    return this._value.expiryMonth;
  }

  public get expiryYear(): string {
    return this._value.expiryYear;
  }

  public get cardType(): string {
    return this._value.cardType;
  }

  public get brand(): string {
    return this._value.brand;
  }

  public get issuerCountry(): string {
    return this._value.issuerCountry;
  }

  public get accountNumber(): string | undefined {
    return this._value.accountNumber;
  }

  public get routingNumber(): string | undefined {
    return this._value.routingNumber;
  }

  public get accountType(): string | undefined {
    return this._value.accountType;
  }

  public get maskedAccountNumber(): string | undefined {
    return this._value.maskedAccountNumber;
  }

  public get lastFourDigits(): string {
    return this._value.lastFourDigits;
  }

  public get binRange(): string {
    return this._value.binRange;
  }

  public get isDebit(): boolean {
    return this._value.isDebit;
  }

  public get isCredit(): boolean {
    return this._value.isCredit;
  }

  public get isVirtual(): boolean {
    return this._value.isVirtual;
  }

  public get issuingBank(): string | undefined {
    return this._value.issuingBank;
  }

  // Utility methods
  public getCardType(): string {
    if (this._value.isVirtual) {
      return 'VIRTUAL';
    }
    if (this._value.isDebit) {
      return 'DEBIT';
    }
    if (this._value.isCredit) {
      return 'CREDIT';
    }
    return 'UNKNOWN';
  }

  public getBrandDisplayName(): string {
    const brandNames: Record<string, string> = {
      'VISA': 'Visa',
      'MASTERCARD': 'Mastercard',
      'AMEX': 'American Express',
      'DISCOVER': 'Discover',
      'DINERS': 'Diners Club',
      'JCB': 'JCB',
      'UNIONPAY': 'UnionPay'
    };
    return brandNames[this._value.brand.toUpperCase()] || this._value.brand;
  }

  public isExpired(): boolean {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-based
    
    const expiryYear = parseInt(this._value.expiryYear, 10);
    const expiryMonth = parseInt(this._value.expiryMonth, 10);
    
    // If expiry year is in the past, it's expired
    if (expiryYear < currentYear) {
      return true;
    }
    
    // If expiry year is current year, check month
    if (expiryYear === currentYear && expiryMonth < currentMonth) {
      return true;
    }
    
    return false;
  }

  public isExpiringWithinMonths(months: number): boolean {
    const now = new Date();
    const futureDate = new Date(now.getFullYear(), now.getMonth() + months, 1);
    
    const expiryYear = parseInt(this._value.expiryYear, 10);
    const expiryMonth = parseInt(this._value.expiryMonth, 10);
    const expiryDate = new Date(expiryYear, expiryMonth - 1, 1);
    
    return expiryDate <= futureDate;
  }

  public isDomestic(countryCode: string): boolean {
    return this._value.issuerCountry.toLowerCase() === countryCode.toLowerCase();
  }

  public isBankAccount(): boolean {
    return !!(this._value.accountNumber && this._value.routingNumber);
  }

  public getFormattedAccountNumber(): string | undefined {
    if (!this._value.maskedAccountNumber) {
      return undefined;
    }
    
    // Format like: ****1234
    return this._value.maskedAccountNumber;
  }

  public getDisplayName(): string {
    if (this.isBankAccount()) {
      return `${this._value.holderName} - ${this.getFormattedAccountNumber()}`;
    }
    return `${this._value.holderName} - ${this._value.maskedNumber}`;
  }

  public getSecurityLevel(): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (this._value.isVirtual) {
      return 'HIGH';
    }
    if (this._value.isCredit) {
      return 'MEDIUM';
    }
    if (this._value.isDebit) {
      return 'MEDIUM';
    }
    if (this.isBankAccount()) {
      return 'LOW';
    }
    return 'LOW';
  }

  public equals(other: CardDetails): boolean {
    return (
      this._value.maskedNumber === other.maskedNumber &&
      this._value.expiryDate === other.expiryDate &&
      this._value.holderName === other.holderName
    );
  }

  public toString(): string {
    return this.getDisplayName();
  }

  // Factory methods
  public static createCreditCard(
    holderName: string,
    maskedNumber: string,
    expiryDate: string,
    brand: string,
    issuerCountry: string,
    issuingBank?: string | undefined
  ): CardDetails {
    const [expiryMonth, expiryYear] = expiryDate.split('/');
    const lastFourDigits = maskedNumber.slice(-4);
    const binRange = maskedNumber.replace(/\D/g, '').substring(0, 6);

    return new CardDetails({
      holderName,
      maskedNumber,
      expiryDate,
      expiryMonth: expiryMonth?.padStart(2, '0') || '12',
      expiryYear: expiryYear?.length === 2 ? `20${expiryYear}` : expiryYear || '2099',
      cardType: 'CREDIT',
      brand: brand.toUpperCase(),
      issuerCountry: issuerCountry.toUpperCase(),
      lastFourDigits,
      binRange,
      isDebit: false,
      isCredit: true,
      isVirtual: false,
      issuingBank
    });
  }

  public static createDebitCard(
    holderName: string,
    maskedNumber: string,
    expiryDate: string,
    brand: string,
    issuerCountry: string,
    issuingBank?: string | undefined
  ): CardDetails {
    const [expiryMonth, expiryYear] = expiryDate.split('/');
    const lastFourDigits = maskedNumber.slice(-4);
    const binRange = maskedNumber.replace(/\D/g, '').substring(0, 6);

    return new CardDetails({
      holderName,
      maskedNumber,
      expiryDate,
      expiryMonth: expiryMonth?.padStart(2, '0') || '12',
      expiryYear: expiryYear?.length === 2 ? `20${expiryYear}` : expiryYear || '2099',
      cardType: 'DEBIT',
      brand: brand.toUpperCase(),
      issuerCountry: issuerCountry.toUpperCase(),
      lastFourDigits,
      binRange,
      isDebit: true,
      isCredit: false,
      isVirtual: false,
      issuingBank
    });
  }

  public static createVirtualCard(
    holderName: string,
    maskedNumber: string,
    expiryDate: string,
    issuerCountry: string = 'US'
  ): CardDetails {
    const [expiryMonth, expiryYear] = expiryDate.split('/');
    const lastFourDigits = maskedNumber.slice(-4);
    const binRange = maskedNumber.replace(/\D/g, '').substring(0, 6);

    return new CardDetails({
      holderName,
      maskedNumber,
      expiryDate,
      expiryMonth: expiryMonth?.padStart(2, '0') || '12',
      expiryYear: expiryYear?.length === 2 ? `20${expiryYear}` : expiryYear || '2099',
      cardType: 'VIRTUAL',
      brand: 'VIRTUAL',
      issuerCountry: issuerCountry.toUpperCase(),
      lastFourDigits,
      binRange,
      isDebit: false,
      isCredit: false,
      isVirtual: true
    });
  }

  public static createBankAccount(
    holderName: string,
    accountNumber: string,
    routingNumber: string,
    accountType: string,
    maskedAccountNumber: string,
    issuerCountry: string = 'US'
  ): CardDetails {
    const lastFourDigits = accountNumber.slice(-4);
    const binRange = routingNumber.substring(0, 6);

    return new CardDetails({
      holderName,
      maskedNumber: maskedAccountNumber,
      expiryDate: '12/99', // Bank accounts don't expire
      expiryMonth: '12',
      expiryYear: '2099',
      cardType: 'BANK_ACCOUNT',
      brand: 'BANK',
      issuerCountry: issuerCountry.toUpperCase(),
      accountNumber,
      routingNumber,
      accountType,
      maskedAccountNumber,
      lastFourDigits,
      binRange,
      isDebit: false,
      isCredit: false,
      isVirtual: false
    });
  }

  public toJSON(): CardDetailsProps {
    return { ...this._value };
  }
}