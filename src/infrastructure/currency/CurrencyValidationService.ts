import { injectable, inject } from 'inversify';
import { ILogger } from '../../shared/interfaces/ILogger';
import { TYPES } from '../ioc/types';
import { ICurrencyValidationService } from '../../domains/currency/repositories/ICurrencyRepository';
import { SupportedCurrencies, CurrencyEntity, SupportedCurrencyCode } from '../../domains/currency/entities/Currency';
import { ExchangeRateService } from './ExchangeRateService';

@injectable()
export class CurrencyValidationService implements ICurrencyValidationService {
  constructor(
    @inject(TYPES.Logger) private logger: ILogger,
    @inject(TYPES.ExchangeRateService) private exchangeRateService: ExchangeRateService
  ) {}

  public async validateAmount(
    amount: bigint,
    currency: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    this.logger.debug('Validating currency amount', {
      amount: amount.toString(),
      currency
    });

    const errors: string[] = [];

    // Check if currency is supported
    const currencyEntity = SupportedCurrencies[currency as SupportedCurrencyCode];
    if (!currencyEntity) {
      errors.push(`Unsupported currency: ${currency}`);
      return { valid: false, errors };
    }

    // Validate using currency entity
    const validation = currencyEntity.validateAmount(amount);
    errors.push(...validation.errors);

    // Additional business rules
    if (amount === BigInt(0)) {
      errors.push('Amount cannot be zero');
    }

    // Check for reasonable limits based on currency type
    if (currencyEntity.isFiat()) {
      // For fiat currencies, check for extremely large amounts that might indicate errors
      const maxReasonableFiat = BigInt(1000000000000); // 10 billion in smallest units
      if (amount > maxReasonableFiat) {
        errors.push('Amount exceeds reasonable transaction limit for fiat currency');
      }
    }

    if (currencyEntity.isCrypto()) {
      // For crypto, check for dust amounts
      const minReasonableCrypto = BigInt(1000); // Minimum reasonable amount in smallest units
      if (amount < minReasonableCrypto && currency !== 'BTC') {
        errors.push('Amount below reasonable minimum for cryptocurrency transactions');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public async validateCurrencyPair(
    base: string,
    quote: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    this.logger.debug('Validating currency pair', { base, quote });

    const errors: string[] = [];

    // Check if both currencies are supported
    const baseCurrency = SupportedCurrencies[base as SupportedCurrencyCode];
    const quoteCurrency = SupportedCurrencies[quote as SupportedCurrencyCode];

    if (!baseCurrency) {
      errors.push(`Unsupported base currency: ${base}`);
    }

    if (!quoteCurrency) {
      errors.push(`Unsupported quote currency: ${quote}`);
    }

    if (base === quote) {
      errors.push('Base and quote currencies cannot be the same');
    }

    // Check if both currencies are active
    if (baseCurrency && !baseCurrency.is_active) {
      errors.push(`Base currency ${base} is not active`);
    }

    if (quoteCurrency && !quoteCurrency.is_active) {
      errors.push(`Quote currency ${quote} is not active`);
    }

    // Check regulatory restrictions
    if (baseCurrency && baseCurrency.metadata.regulatory_status === 'restricted') {
      errors.push(`Base currency ${base} is restricted`);
    }

    if (quoteCurrency && quoteCurrency.metadata.regulatory_status === 'restricted') {
      errors.push(`Quote currency ${quote} is restricted`);
    }

    // Business rules for currency pairs
    if (baseCurrency && quoteCurrency) {
      // Validate cross-currency rules
      if (baseCurrency.isCrypto() && quoteCurrency.isCrypto()) {
        // Crypto-to-crypto pairs should typically go through a stablecoin or fiat
        if (!baseCurrency.isStableCoin() && !quoteCurrency.isStableCoin()) {
          // Allow direct crypto pairs for major currencies
          const majorCryptos = ['BTC', 'ETH'];
          if (!majorCryptos.includes(base) && !majorCryptos.includes(quote)) {
            errors.push('Direct crypto-to-crypto conversion not supported for this pair. Consider using a stablecoin as intermediate.');
          }
        }
      }

      // Check decimal precision compatibility
      const decimalDifference = Math.abs(
        baseCurrency.metadata.decimal_places - quoteCurrency.metadata.decimal_places
      );
      if (decimalDifference > 10) {
        // This is a warning, not an error
        this.logger.warn('Large decimal precision difference in currency pair', {
          base,
          quote,
          basePrecision: baseCurrency.metadata.decimal_places,
          quotePrecision: quoteCurrency.metadata.decimal_places
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public async validateCurrencyTransaction(
    fromCurrency: string,
    toCurrency: string,
    amount: bigint
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    this.logger.debug('Validating currency transaction', {
      fromCurrency,
      toCurrency,
      amount: amount.toString()
    });

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate amount
    const amountValidation = await this.validateAmount(amount, fromCurrency);
    errors.push(...amountValidation.errors);

    // Validate currency pair
    const pairValidation = await this.validateCurrencyPair(fromCurrency, toCurrency);
    errors.push(...pairValidation.errors);

    // Additional transaction-specific validations
    const fromCurrencyEntity = SupportedCurrencies[fromCurrency as SupportedCurrencyCode];
    const toCurrencyEntity = SupportedCurrencies[toCurrency as SupportedCurrencyCode];

    if (fromCurrencyEntity && toCurrencyEntity) {
      // Check for potential precision loss
      if (fromCurrencyEntity.metadata.decimal_places > toCurrencyEntity.metadata.decimal_places) {
        const precisionLoss = fromCurrencyEntity.metadata.decimal_places - toCurrencyEntity.metadata.decimal_places;
        const smallestUnit = BigInt(Math.pow(10, precisionLoss));
        
        if (amount % smallestUnit !== BigInt(0)) {
          warnings.push(`Conversion may result in precision loss. Amount has more decimal places than target currency supports.`);
        }
      }

      // Check for unusual conversions
      if (fromCurrencyEntity.isFiat() && toCurrencyEntity.isCrypto()) {
        warnings.push('Converting from fiat to cryptocurrency. Ensure compliance with local regulations.');
      }

      if (fromCurrencyEntity.isCrypto() && toCurrencyEntity.isFiat()) {
        warnings.push('Converting from cryptocurrency to fiat. Tax implications may apply.');
      }

      // Large amount warnings
      const usdEquivalent = await this.estimateUSDEquivalent(amount, fromCurrency);
      if (usdEquivalent && usdEquivalent > 10000) {
        warnings.push('Large transaction amount detected. Additional compliance checks may be required.');
      }

      // Stablecoin specific validations
      if (fromCurrencyEntity.isStableCoin() && !toCurrencyEntity.isStableCoin()) {
        // Check if the stablecoin is pegged to the target currency
        if (fromCurrency === 'USDC' || fromCurrency === 'USDT') {
          if (toCurrency !== 'USD') {
            warnings.push('Converting from USD-pegged stablecoin to non-USD currency may incur additional exchange rate risks.');
          }
        }
      }

      // Network compatibility for crypto currencies
      if (fromCurrencyEntity.isCrypto() && toCurrencyEntity.isCrypto()) {
        const fromNetwork = fromCurrencyEntity.metadata.blockchain_network;
        const toNetwork = toCurrencyEntity.metadata.blockchain_network;
        
        if (fromNetwork && toNetwork && fromNetwork !== toNetwork) {
          warnings.push(`Cross-network conversion from ${fromNetwork} to ${toNetwork}. Bridge fees may apply.`);
        }
      }
    }

    // Check if exchange rate is available
    try {
      if (fromCurrency !== toCurrency) {
        const rate = await this.exchangeRateService.calculateCrossRate(fromCurrency, toCurrency);
        if (!rate) {
          errors.push(`No exchange rate available for ${fromCurrency}/${toCurrency}`);
        } else if (rate <= 0) {
          errors.push(`Invalid exchange rate for ${fromCurrency}/${toCurrency}`);
        }
      }
    } catch (error) {
      errors.push(`Failed to verify exchange rate: ${(error as Error).message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  public async parseAndValidateAmount(
    amountStr: string,
    currency: string
  ): Promise<{ amount: bigint; valid: boolean; errors: string[] }> {
    this.logger.debug('Parsing and validating amount string', {
      amountStr,
      currency
    });

    const errors: string[] = [];

    // Get currency entity
    const currencyEntity = SupportedCurrencies[currency as SupportedCurrencyCode];
    if (!currencyEntity) {
      errors.push(`Unsupported currency: ${currency}`);
      return { amount: BigInt(0), valid: false, errors };
    }

    try {
      // Parse the amount using currency entity
      const amount = currencyEntity.parseAmount(amountStr);
      
      // Validate the parsed amount
      const validation = await this.validateAmount(amount, currency);
      errors.push(...validation.errors);

      return {
        amount,
        valid: errors.length === 0,
        errors
      };

    } catch (error) {
      errors.push(`Invalid amount format: ${(error as Error).message}`);
      return {
        amount: BigInt(0),
        valid: false,
        errors
      };
    }
  }

  // Additional validation utilities

  public validateCurrencyCode(code: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!code || typeof code !== 'string') {
      errors.push('Currency code is required and must be a string');
      return { valid: false, errors };
    }

    if (code.length < 2 || code.length > 10) {
      errors.push('Currency code must be between 2-10 characters');
    }

    if (code !== code.toUpperCase()) {
      errors.push('Currency code must be uppercase');
    }

    if (!/^[A-Z0-9]+$/.test(code)) {
      errors.push('Currency code must contain only uppercase letters and numbers');
    }

    // Check if it's a known supported currency
    const isSupported = Object.keys(SupportedCurrencies).includes(code);
    if (!isSupported) {
      errors.push(`Currency code ${code} is not in the list of supported currencies`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public validateTransactionLimits(
    amount: bigint,
    currency: string,
    transactionType: 'deposit' | 'withdrawal' | 'transfer' | 'conversion'
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const currencyEntity = SupportedCurrencies[currency as SupportedCurrencyCode];
    if (!currencyEntity) {
      errors.push(`Unsupported currency: ${currency}`);
      return { valid: false, errors, warnings };
    }

    // Define transaction limits (these would typically come from configuration)
    const limits = {
      deposit: {
        min: currencyEntity.metadata.minimum_amount,
        max: currencyEntity.metadata.maximum_amount / BigInt(10), // 10% of max for deposits
        dailyMax: currencyEntity.metadata.maximum_amount / BigInt(100) // 1% of max per day
      },
      withdrawal: {
        min: currencyEntity.metadata.minimum_amount * BigInt(10), // Higher min for withdrawals
        max: currencyEntity.metadata.maximum_amount / BigInt(20), // 5% of max for withdrawals
        dailyMax: currencyEntity.metadata.maximum_amount / BigInt(200) // 0.5% of max per day
      },
      transfer: {
        min: currencyEntity.metadata.minimum_amount,
        max: currencyEntity.metadata.maximum_amount / BigInt(5), // 20% of max for transfers
        dailyMax: currencyEntity.metadata.maximum_amount / BigInt(50) // 2% of max per day
      },
      conversion: {
        min: currencyEntity.metadata.minimum_amount * BigInt(100), // Higher min for conversions
        max: currencyEntity.metadata.maximum_amount / BigInt(2), // 50% of max for conversions
        dailyMax: currencyEntity.metadata.maximum_amount / BigInt(10) // 10% of max per day
      }
    };

    const limit = limits[transactionType];

    if (amount < limit.min) {
      errors.push(`Amount below minimum limit for ${transactionType}: ${currencyEntity.formatAmount(limit.min)}`);
    }

    if (amount > limit.max) {
      errors.push(`Amount exceeds maximum limit for ${transactionType}: ${currencyEntity.formatAmount(limit.max)}`);
    }

    if (amount > limit.dailyMax) {
      warnings.push(`Amount exceeds recommended daily limit for ${transactionType}: ${currencyEntity.formatAmount(limit.dailyMax)}`);
    }

    // Special validations for crypto
    if (currencyEntity.isCrypto()) {
      // Network fee considerations
      warnings.push('Cryptocurrency transactions incur network fees that will be deducted from the amount.');
      
      if (transactionType === 'withdrawal' && currency === 'BTC' && amount < BigInt(100000)) {
        warnings.push('Small Bitcoin withdrawals may have high fee-to-amount ratios.');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private async estimateUSDEquivalent(amount: bigint, currency: string): Promise<number | null> {
    if (currency === 'USD') {
      const usdEntity = SupportedCurrencies.USD;
      return Number(amount) / Math.pow(10, usdEntity.metadata.decimal_places);
    }

    try {
      const rate = await this.exchangeRateService.calculateCrossRate(currency, 'USD');
      if (rate) {
        const currencyEntity = SupportedCurrencies[currency as SupportedCurrencyCode];
        if (currencyEntity) {
          const normalizedAmount = Number(amount) / Math.pow(10, currencyEntity.metadata.decimal_places);
          return normalizedAmount * rate;
        }
      }
    } catch (error) {
      this.logger.warn('Failed to estimate USD equivalent', {
        currency,
        amount: amount.toString(),
        error: (error as Error).message
      });
    }

    return null;
  }
}