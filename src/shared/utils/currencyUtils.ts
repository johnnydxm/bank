import { SupportedCurrencies, SupportedCurrencyCode } from '../../domains/currency/entities/Currency';

/**
 * Currency formatting and utility functions
 */

export interface CurrencyFormatOptions {
  showSymbol?: boolean | undefined;
  showCode?: boolean | undefined;
  minimumFractionDigits?: number | undefined;
  maximumFractionDigits?: number | undefined;
  locale?: string | undefined;
}

export class CurrencyFormatter {
  /**
   * Format a bigint amount to a human-readable string
   */
  public static formatAmount(
    amount: bigint,
    currency: string,
    options: CurrencyFormatOptions = {}
  ): string {
    const currencyEntity = SupportedCurrencies[currency as SupportedCurrencyCode];
    if (!currencyEntity) {
      throw new Error(`Unsupported currency: ${currency}`);
    }

    const {
      showSymbol = true,
      showCode = false,
      minimumFractionDigits,
      maximumFractionDigits,
      locale = 'en-US'
    } = options;

    // Convert bigint to number with proper decimal places
    const divisor = BigInt(Math.pow(10, currencyEntity.metadata.decimal_places));
    const whole = amount / divisor;
    const fraction = amount % divisor;

    let formattedNumber: string;

    if (fraction === BigInt(0) && !minimumFractionDigits) {
      formattedNumber = whole.toString();
    } else {
      const fractionStr = fraction.toString().padStart(currencyEntity.metadata.decimal_places, '0');
      const decimalPlaces = maximumFractionDigits !== undefined 
        ? Math.min(maximumFractionDigits, currencyEntity.metadata.decimal_places)
        : currencyEntity.metadata.decimal_places;
      
      const trimmedFraction = fractionStr.slice(0, decimalPlaces);
      formattedNumber = `${whole.toString()}.${trimmedFraction}`;
    }

    // Apply locale formatting if supported
    try {
      const num = parseFloat(formattedNumber);
      const formatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: minimumFractionDigits || 0,
        maximumFractionDigits: maximumFractionDigits || currencyEntity.metadata.decimal_places
      });
      formattedNumber = formatter.format(num);
    } catch (error) {
      // Fallback to basic formatting if Intl is not available
    }

    // Add currency symbol/code
    let result = formattedNumber;
    
    if (showSymbol && currencyEntity.metadata.symbol) {
      // For symbols like $, €, £, show before the number
      if (['$', '€', '£', '¥'].includes(currencyEntity.metadata.symbol)) {
        result = `${currencyEntity.metadata.symbol}${formattedNumber}`;
      } else {
        result = `${formattedNumber} ${currencyEntity.metadata.symbol}`;
      }
    }
    
    if (showCode) {
      result = showSymbol 
        ? `${result} (${currency})`
        : `${formattedNumber} ${currency}`;
    }

    return result;
  }

  /**
   * Parse a formatted currency string to bigint
   */
  public static parseAmount(amountStr: string, currency: string): bigint {
    const currencyEntity = SupportedCurrencies[currency as SupportedCurrencyCode];
    if (!currencyEntity) {
      throw new Error(`Unsupported currency: ${currency}`);
    }

    return currencyEntity.parseAmount(amountStr);
  }

  /**
   * Format an exchange rate with proper precision
   */
  public static formatExchangeRate(
    rate: number,
    baseCurrency: string,
    quoteCurrency: string,
    precision: number = 6
  ): string {
    const formattedRate = rate.toFixed(precision);
    return `1 ${baseCurrency} = ${formattedRate} ${quoteCurrency}`;
  }

  /**
   * Get currency display information
   */
  public static getCurrencyInfo(currency: string): {
    name: string;
    symbol: string;
    type: 'fiat' | 'crypto';
    decimalPlaces: number;
    isStableCoin?: boolean | undefined;
  } | null {
    const currencyEntity = SupportedCurrencies[currency as SupportedCurrencyCode];
    if (!currencyEntity) {
      return null;
    }

    return {
      name: currencyEntity.metadata.name,
      symbol: currencyEntity.metadata.symbol,
      type: currencyEntity.metadata.type,
      decimalPlaces: currencyEntity.metadata.decimal_places,
      isStableCoin: currencyEntity.metadata.is_stable_coin
    };
  }
}

export class CurrencyConverter {
  /**
   * Convert between different decimal precisions
   */
  public static convertPrecision(
    amount: bigint,
    fromDecimals: number,
    toDecimals: number
  ): bigint {
    if (fromDecimals === toDecimals) {
      return amount;
    }

    if (fromDecimals > toDecimals) {
      // Reduce precision
      const divisor = BigInt(Math.pow(10, fromDecimals - toDecimals));
      return amount / divisor;
    } else {
      // Increase precision
      const multiplier = BigInt(Math.pow(10, toDecimals - fromDecimals));
      return amount * multiplier;
    }
  }

  /**
   * Calculate percentage of total
   */
  public static calculatePercentage(
    amount: bigint,
    total: bigint,
    decimalPlaces: number = 2
  ): number {
    if (total === BigInt(0)) return 0;
    
    const percentage = Number(amount * BigInt(100)) / Number(total);
    return Math.round(percentage * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces);
  }

  /**
   * Apply percentage to amount
   */
  public static applyPercentage(
    amount: bigint,
    percentage: number
  ): bigint {
    const factor = BigInt(Math.round(percentage * 100));
    return (amount * factor) / BigInt(10000);
  }
}

export class CurrencyValidator {
  /**
   * Validate amount against currency constraints
   */
  public static validateAmount(
    amount: bigint,
    currency: string
  ): { valid: boolean; errors: string[] } {
    const currencyEntity = SupportedCurrencies[currency as SupportedCurrencyCode];
    if (!currencyEntity) {
      return { valid: false, errors: [`Unsupported currency: ${currency}`] };
    }

    return currencyEntity.validateAmount(amount);
  }

  /**
   * Check if amount has valid precision for currency
   */
  public static hasValidPrecision(
    amount: bigint,
    currency: string
  ): boolean {
    const currencyEntity = SupportedCurrencies[currency as SupportedCurrencyCode];
    if (!currencyEntity) return false;

    // Check if the amount can be represented with the currency's decimal places
    const divisor = BigInt(Math.pow(10, currencyEntity.metadata.decimal_places));
    const remainder = amount % divisor;
    
    // If there's no remainder when dividing by the smallest unit, precision is valid
    return remainder === BigInt(0);
  }

  /**
   * Round amount to currency precision
   */
  public static roundToPrecision(
    amount: bigint,
    currency: string
  ): bigint {
    const currencyEntity = SupportedCurrencies[currency as SupportedCurrencyCode];
    if (!currencyEntity) return amount;

    const divisor = BigInt(Math.pow(10, currencyEntity.metadata.decimal_places));
    return (amount / divisor) * divisor;
  }
}

export class PortfolioCalculator {
  /**
   * Calculate total portfolio value in target currency
   */
  public static calculateTotalValue(
    balances: Array<{ currency: string; amount: bigint; usdEquivalent?: bigint | undefined }>,
    targetCurrency: string = 'USD'
  ): bigint {
    if (targetCurrency === 'USD') {
      return balances.reduce(
        (total, balance) => total + (balance.usdEquivalent || BigInt(0)),
        BigInt(0)
      );
    }

    // For non-USD target currencies, would need exchange rates
    throw new Error('Non-USD target currencies not yet supported');
  }

  /**
   * Calculate portfolio diversification score (0-100)
   */
  public static calculateDiversificationScore(
    balances: Array<{ currency: string; amount: bigint; usdEquivalent?: bigint | undefined }>
  ): number {
    if (balances.length === 0) return 0;
    if (balances.length === 1) return 20; // Single asset is not diversified

    const totalValue = this.calculateTotalValue(balances);
    if (totalValue === BigInt(0)) return 0;

    // Calculate Herfindahl-Hirschman Index (HHI) for concentration
    let hhi = 0;
    for (const balance of balances) {
      const weight = Number((balance.usdEquivalent || BigInt(0)) * BigInt(10000) / totalValue) / 10000;
      hhi += weight * weight;
    }

    // Convert HHI to diversification score (lower HHI = higher diversification)
    // HHI ranges from 1/n (perfect diversification) to 1 (complete concentration)
    const maxDiversificationHHI = 1 / balances.length;
    const diversificationRatio = (1 - hhi) / (1 - maxDiversificationHHI);
    
    return Math.max(0, Math.min(100, diversificationRatio * 100));
  }

  /**
   * Calculate portfolio risk score based on asset types
   */
  public static calculateRiskScore(
    balances: Array<{ currency: string; amount: bigint; usdEquivalent?: bigint | undefined }>
  ): number {
    const totalValue = this.calculateTotalValue(balances);
    if (totalValue === BigInt(0)) return 0;

    let riskScore = 0;

    for (const balance of balances) {
      const currencyEntity = SupportedCurrencies[balance.currency as SupportedCurrencyCode];
      if (!currencyEntity) continue;

      const weight = Number((balance.usdEquivalent || BigInt(0)) * BigInt(100) / totalValue);
      
      let assetRisk = 0;
      if (currencyEntity.isFiat()) {
        assetRisk = 10; // Low risk for fiat
      } else if (currencyEntity.isStableCoin()) {
        assetRisk = 20; // Low-medium risk for stablecoins
      } else if (currencyEntity.isCrypto()) {
        // Higher risk for cryptocurrencies
        if (balance.currency === 'BTC' || balance.currency === 'ETH') {
          assetRisk = 60; // Medium-high risk for major cryptos
        } else {
          assetRisk = 80; // High risk for other cryptos
        }
      }

      riskScore += (assetRisk * weight) / 100;
    }

    return Math.max(0, Math.min(100, riskScore));
  }

  /**
   * Get largest holdings
   */
  public static getLargestHoldings(
    balances: Array<{ currency: string; amount: bigint; usdEquivalent?: bigint | undefined }>,
    count: number = 5
  ): Array<{ currency: string; amount: bigint; usdEquivalent: bigint; percentage: number }> {
    const totalValue = this.calculateTotalValue(balances);
    
    return balances
      .filter(b => (b.usdEquivalent || BigInt(0)) > BigInt(0))
      .map(b => ({
        currency: b.currency,
        amount: b.amount,
        usdEquivalent: b.usdEquivalent || BigInt(0),
        percentage: this.calculatePercentage(b.usdEquivalent || BigInt(0), totalValue, 2)
      }))
      .sort((a, b) => Number(b.usdEquivalent - a.usdEquivalent))
      .slice(0, count);
  }

  private static calculatePercentage(amount: bigint, total: bigint, decimals: number): number {
    return CurrencyConverter.calculatePercentage(amount, total, decimals);
  }
}

// Constants for common operations
export const CURRENCY_CONSTANTS = {
  USD_DECIMALS: 2,
  BTC_DECIMALS: 8,
  ETH_DECIMALS: 18,
  DEFAULT_FIAT_DECIMALS: 2,
  DEFAULT_CRYPTO_DECIMALS: 8,
  MAX_DECIMALS: 18,
  
  // Common amounts in smallest units
  ONE_DOLLAR: BigInt(100), // $1.00 in cents
  ONE_BITCOIN: BigInt(100000000), // 1 BTC in satoshis
  ONE_ETHER: BigInt('1000000000000000000'), // 1 ETH in wei
  
  // Fee constants
  DEFAULT_CONVERSION_FEE_BPS: 10, // 0.1% in basis points
  DEFAULT_TRANSFER_FEE_BPS: 5, // 0.05% in basis points
  MAX_FEE_BPS: 100, // 1% maximum fee
  
  // Validation constants
  MIN_TRANSACTION_USD: BigInt(1), // $0.01 minimum
  MAX_TRANSACTION_USD: BigInt(100000000000), // $1B maximum
  DUST_THRESHOLD_BTC: BigInt(546), // 546 satoshis
  DUST_THRESHOLD_ETH: BigInt('1000000000000000') // 0.001 ETH
} as const;