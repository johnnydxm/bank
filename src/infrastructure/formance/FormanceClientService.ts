import { injectable, inject } from 'inversify';
import { SDK } from '@formance/formance-sdk';
import { ILogger } from '../../shared/interfaces/ILogger';
import { TYPES } from '../ioc/types';
import { ConfigManager } from '../config/AppConfig';
import { 
  IFormanceClientRepository, 
  FormanceConfig, 
  FormanceError, 
  FormanceOperationResult 
} from '../../domains/formance/repositories/IFormanceRepository';

@injectable()
export class FormanceClientService implements IFormanceClientRepository {
  private sdk: SDK | null = null;
  private config: FormanceConfig | null = null;
  private isInitialized = false;
  private connectionRetryCount = 0;
  private readonly maxRetries = 3;

  constructor(
    @inject(TYPES.Logger) private logger: ILogger,
    @inject(TYPES.ConfigManager) private configManager: ConfigManager
  ) {}

  public async initialize(config?: FormanceConfig): Promise<void> {
    try {
      // Use provided config or load from environment
      this.config = config || this.loadConfigFromEnvironment();
      
      this.logger.info('Initializing Formance SDK client...', {
        apiUrl: this.config.apiUrl,
        defaultLedger: this.config.defaultLedger
      });

      // Initialize SDK with OAuth credentials
      this.sdk = new SDK({
        security: {
          clientID: this.config.clientId,
          clientSecret: this.config.clientSecret,
        },
        serverURL: this.config.apiUrl,
        timeoutMs: this.config.timeout || 30000,
      });

      // Test connection
      await this.validateConnection();
      
      this.isInitialized = true;
      this.connectionRetryCount = 0;
      
      this.logger.info('Formance SDK client initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Formance SDK', error as Error);
      throw this.createFormanceError(
        'INITIALIZATION_FAILED',
        'Failed to initialize Formance client',
        { error: (error as Error).message },
        false
      );
    }
  }

  public async isConnected(): Promise<boolean> {
    if (!this.sdk || !this.isInitialized) {
      return false;
    }

    try {
      const health = await this.getHealthStatus();
      return health.status === 'healthy';
    } catch {
      return false;
    }
  }

  public async getHealthStatus(): Promise<{status: 'healthy' | 'unhealthy'; details: Record<string, any>}> {
    if (!this.sdk) {
      return {
        status: 'unhealthy',
        details: { error: 'SDK not initialized' }
      };
    }

    try {
      // Try to list ledgers as a health check
      const ledgersResponse = await this.sdk.ledger.v2.listLedgers({});
      
      return {
        status: 'healthy',
        details: {
          ledgers_count: ledgersResponse.cursor?.data?.length || 0,
          api_url: this.config?.apiUrl,
          default_ledger: this.config?.defaultLedger,
          last_check: new Date().toISOString()
        }
      };
    } catch (error) {
      this.logger.warn('Formance health check failed', error as Error);
      return {
        status: 'unhealthy',
        details: {
          error: (error as Error).message,
          last_check: new Date().toISOString()
        }
      };
    }
  }

  public async disconnect(): Promise<void> {
    if (this.sdk) {
      this.logger.info('Disconnecting Formance SDK client');
      this.sdk = null;
      this.isInitialized = false;
      this.config = null;
    }
  }

  public getConfig(): FormanceConfig {
    if (!this.config) {
      throw this.createFormanceError(
        'CONFIG_NOT_FOUND',
        'Formance configuration not loaded',
        {},
        false
      );
    }
    return { ...this.config };
  }

  public async updateConfig(configUpdates: Partial<FormanceConfig>): Promise<void> {
    if (!this.config) {
      throw this.createFormanceError(
        'CONFIG_NOT_FOUND',
        'Cannot update config before initialization',
        {},
        false
      );
    }

    const newConfig = { ...this.config, ...configUpdates };
    
    // If critical config changed, reinitialize
    const criticalFields = ['apiUrl', 'clientId', 'clientSecret'];
    const needsReinit = criticalFields.some(field => 
      configUpdates[field as keyof FormanceConfig] !== undefined
    );

    if (needsReinit) {
      await this.disconnect();
      await this.initialize(newConfig);
    } else {
      this.config = newConfig;
    }
  }

  public async refreshToken(): Promise<void> {
    if (!this.sdk) {
      throw this.createFormanceError(
        'SDK_NOT_INITIALIZED',
        'Cannot refresh token before SDK initialization',
        {},
        false
      );
    }

    // Formance SDK handles token refresh automatically with OAuth
    // We can test the token by making a simple API call
    try {
      await this.sdk.ledger.v2.listLedgers({});
      this.logger.debug('Token refresh validated successfully');
    } catch (error) {
      this.logger.error('Token refresh failed', error as Error);
      throw this.createFormanceError(
        'TOKEN_REFRESH_FAILED',
        'Failed to refresh authentication token',
        { error: (error as Error).message },
        true
      );
    }
  }

  public async validateToken(): Promise<boolean> {
    try {
      await this.refreshToken();
      return true;
    } catch {
      return false;
    }
  }

  // SDK Access for other services
  public getSDK(): SDK {
    if (!this.sdk || !this.isInitialized) {
      throw this.createFormanceError(
        'SDK_NOT_INITIALIZED',
        'Formance SDK not initialized. Call initialize() first.',
        {},
        false
      );
    }
    return this.sdk;
  }

  // Retry wrapper for operations
  public async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    retryable: boolean = true
  ): Promise<FormanceOperationResult<T>> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    const maxAttempts = retryable ? (this.config?.retryAttempts || 3) : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();
        const duration = Date.now() - startTime;
        
        this.logger.debug(`Formance operation ${operationName} succeeded`, {
          attempt,
          duration_ms: duration
        });

        return {
          success: true,
          data: result,
          metadata: {
            request_id: this.generateRequestId(),
            duration_ms: duration,
            retry_count: attempt - 1
          }
        };

      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts || !this.isRetryableError(lastError)) {
          break;
        }

        const delayMs = this.calculateBackoffDelay(attempt);
        this.logger.warn(`Formance operation ${operationName} failed, retrying in ${delayMs}ms`, {
          attempt,
          error: lastError.message,
          next_retry_in_ms: delayMs
        });

        await this.delay(delayMs);
      }
    }

    const duration = Date.now() - startTime;
    const formanceError = this.convertToFormanceError(lastError!, operationName);
    
    this.logger.error(`Formance operation ${operationName} failed after ${maxAttempts} attempts`, {
      message: `Formance operation ${operationName} failed after ${maxAttempts} attempts: ${formanceError.message}`,
      duration_ms: duration
    });

    return {
      success: false,
      error: formanceError,
      metadata: {
        request_id: this.generateRequestId(),
        duration_ms: duration,
        retry_count: maxAttempts - 1
      }
    };
  }

  // Private helper methods
  private loadConfigFromEnvironment(): FormanceConfig {
    const appConfig = this.configManager.getConfig();
    
    return {
      apiUrl: appConfig.formance.apiUrl,
      clientId: appConfig.formance.clientId,
      clientSecret: appConfig.formance.clientSecret,
      defaultLedger: appConfig.formance.defaultLedger,
      timeout: 30000,
      retryAttempts: 3,
      retryDelayMs: 1000
    };
  }

  private async validateConnection(): Promise<void> {
    if (!this.sdk) {
      throw new Error('SDK not initialized');
    }

    try {
      // Test connection by listing ledgers
      await this.sdk.ledger.v2.listLedgers({});
    } catch (error) {
      throw new Error(`Connection validation failed: ${(error as Error).message}`);
    }
  }

  private isRetryableError(error: Error): boolean {
    const retryableConditions = [
      // Network errors
      error.message.includes('ECONNRESET'),
      error.message.includes('ECONNREFUSED'),
      error.message.includes('ETIMEDOUT'),
      
      // HTTP 5xx errors (server errors)
      error.message.includes('500'),
      error.message.includes('502'),
      error.message.includes('503'),
      error.message.includes('504'),
      
      // Rate limiting
      error.message.includes('429'),
      
      // Temporary failures
      error.message.includes('timeout'),
      error.message.includes('temporary')
    ];

    return retryableConditions.some(condition => condition);
  }

  private calculateBackoffDelay(attempt: number): number {
    const baseDelay = this.config?.retryDelayMs || 1000;
    return baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createFormanceError(
    code: string,
    message: string,
    details: Record<string, any> = {},
    retryable: boolean = false
  ): FormanceError {
    return {
      code,
      message,
      details,
      retryable
    };
  }

  private convertToFormanceError(error: Error, operation: string): FormanceError {
    // Convert SDK errors to standardized FormanceError format
    const isRetryable = this.isRetryableError(error);
    
    return {
      code: this.extractErrorCode(error),
      message: `${operation} failed: ${error.message}`,
      details: {
        original_error: error.message,
        operation,
        timestamp: new Date().toISOString()
      },
      retryable: isRetryable
    };
  }

  private extractErrorCode(error: Error): string {
    // Extract error codes from different error types
    if (error.message.includes('401')) return 'UNAUTHORIZED';
    if (error.message.includes('403')) return 'FORBIDDEN';
    if (error.message.includes('404')) return 'NOT_FOUND';
    if (error.message.includes('409')) return 'CONFLICT';
    if (error.message.includes('429')) return 'RATE_LIMITED';
    if (error.message.includes('500')) return 'INTERNAL_SERVER_ERROR';
    if (error.message.includes('timeout')) return 'TIMEOUT';
    if (error.message.includes('network')) return 'NETWORK_ERROR';
    
    return 'UNKNOWN_ERROR';
  }
}