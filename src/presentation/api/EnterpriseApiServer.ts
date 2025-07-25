import express, { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'inversify';
import { DIContainer } from '../../infrastructure/ioc/Container';
import { TYPES } from '../../infrastructure/ioc/types';
import { ILogger } from '../../shared/interfaces/ILogger';
import { FormanceClientService } from '../../infrastructure/formance/FormanceClientService';
import { FormanceLedgerService } from '../../infrastructure/formance/FormanceLedgerService';
import { JWTAuthenticationService } from '../../infrastructure/auth/JWTAuthenticationService';
import { AuthenticationMiddleware } from '../middleware/AuthenticationMiddleware';
import path from 'path';

@injectable()
export class EnterpriseApiServer {
  private app: express.Application;
  private container: DIContainer;

  constructor(
    @inject(TYPES.Logger) private logger: ILogger,
    @inject(TYPES.FormanceClientService) private formanceClient: FormanceClientService,
    @inject(TYPES.FormanceLedgerService) private formanceLedger: FormanceLedgerService,
    @inject(TYPES.JWTAuthenticationService) private authService: JWTAuthenticationService,
    @inject(TYPES.AuthenticationMiddleware) private authMiddleware: AuthenticationMiddleware
  ) {
    this.app = express();
    this.container = DIContainer.getInstance();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Parse JSON bodies
    this.app.use(express.json());
    
    // Serve static files
    this.app.use(express.static(path.join(process.cwd(), 'public')));
    
    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      next();
    });

    // Error handling middleware
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('API Error', err, {
        method: req.method,
        path: req.path,
        body: req.body
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
      });
    });
  }

  private setupRoutes(): void {
    // Serve React app
    this.app.get('/', (req: Request, res: Response): void => {
      res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
    });

    // Health check
    this.app.get('/api/health', async (req: Request, res: Response): Promise<void> => {
      try {
        const formanceHealth = await this.formanceClient.getHealthStatus();
        
        res.json({
          status: 'healthy',
          message: 'DWAY Financial Freedom Platform - Enterprise API',
          timestamp: new Date().toISOString(),
          formance: formanceHealth,
          version: '2.0.0'
        });
      } catch (error) {
        this.logger.error('Health check failed', error as Error);
        res.status(503).json({
          status: 'unhealthy',
          message: 'Service dependencies unavailable',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Authentication endpoints - Enterprise OAuth2
    this.setupAuthenticationRoutes();
    
    // Account management - FormanceLedgerService integration
    this.setupAccountRoutes();
    
    // Transaction processing - Enterprise validation
    this.setupTransactionRoutes();
    
    // Multi-currency support - Enterprise exchange rates
    this.setupCurrencyRoutes();
    
    // DeFi integration - Enterprise crypto services
    this.setupCryptoRoutes();
  }

  private setupAuthenticationRoutes(): void {
    // Enterprise JWT Authentication
    this.app.post('/api/auth/signup', async (req: Request, res: Response): Promise<void> => {
      try {
        this.logger.info('Enterprise signup attempt', { email: req.body.email });
        
        // Validate input
        const { email, password, firstName, lastName } = req.body;
        if (!email || !password || !firstName || !lastName) {
          res.status(400).json({
            success: false,
            error: 'All fields are required',
            code: 'VALIDATION_ERROR'
          });
          return;
        }

        // Validate password strength
        if (password.length < 8) {
          res.status(400).json({
            success: false,
            error: 'Password must be at least 8 characters long',
            code: 'WEAK_PASSWORD'
          });
          return;
        }

        // Create Formance account structure for individual user
        const userAccountAddress = this.authService.createAccountAddress(email);
        
        // Hash password
        const hashedPassword = await this.authService.hashPassword(password);
        
        const account = await this.formanceLedger.createAccount({
          address: userAccountAddress,
          type: 'user',
          metadata: {
            email,
            firstName,
            lastName,
            passwordHash: hashedPassword,
            account_type: 'individual',
            accountType: 'individual',
            created_at: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            status: 'active'
          }
        });

        // Generate JWT tokens
        const tokens = this.authService.generateTokens({
          userId: account.address,
          email,
          accountAddress: userAccountAddress,
          firstName,
          lastName
        });

        this.logger.info('Enterprise account created with JWT authentication', { 
          address: userAccountAddress,
          email 
        });

        // Return user data with tokens (enterprise pattern)
        res.status(201).json({
          success: true,
          message: 'Account created successfully',
          user: {
            id: account.address,
            email,
            firstName,
            lastName,
            accountAddress: userAccountAddress
          },
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn
          }
        });

      } catch (error) {
        this.logger.error('Enterprise signup failed', error as Error, { email: req.body.email });
        res.status(500).json({
          success: false,
          error: 'Account creation failed',
          message: (error as Error).message
        });
      }
    });

    this.app.post('/api/auth/signin', async (req: Request, res: Response): Promise<void> => {
      try {
        this.logger.info('Enterprise signin attempt', { email: req.body.email });
        
        const { email, password } = req.body;
        if (!email || !password) {
          res.status(400).json({
            success: false,
            error: 'Email and password are required',
            code: 'VALIDATION_ERROR'
          });
          return;
        }

        // Check if user account exists in Formance
        const userAccountAddress = this.authService.createAccountAddress(email);
        const account = await this.formanceLedger.getAccount(userAccountAddress);
        
        if (!account || !account.metadata.passwordHash) {
          res.status(401).json({
            success: false,
            error: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS'
          });
          return;
        }

        // Verify password
        const isValidPassword = await this.authService.verifyPassword(password, account.metadata.passwordHash);
        if (!isValidPassword) {
          res.status(401).json({
            success: false,
            error: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS'
          });
          return;
        }

        // Generate JWT tokens
        const tokens = this.authService.generateTokens({
          userId: account.address,
          email: account.metadata.email || email,
          accountAddress: userAccountAddress,
          firstName: account.metadata.firstName || 'User',
          lastName: account.metadata.lastName || 'Account'
        });

        this.logger.info('Enterprise signin successful with JWT', { 
          address: userAccountAddress,
          email 
        });

        res.json({
          success: true,
          message: 'Sign in successful',
          user: {
            id: account.address,
            email: account.metadata.email,
            firstName: account.metadata.firstName,
            lastName: account.metadata.lastName,
            accountAddress: userAccountAddress
          },
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn
          }
        });

      } catch (error) {
        this.logger.error('Enterprise signin failed', error as Error, { email: req.body.email });
        res.status(500).json({
          success: false,
          error: 'Authentication failed',
          message: (error as Error).message
        });
      }
    });

    // Token refresh endpoint
    this.app.post('/api/auth/refresh', async (req: Request, res: Response): Promise<void> => {
      try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
          res.status(400).json({
            success: false,
            error: 'Refresh token required',
            code: 'TOKEN_MISSING'
          });
          return;
        }

        const tokenPayload = this.authService.verifyRefreshToken(refreshToken);
        if (!tokenPayload) {
          res.status(401).json({
            success: false,
            error: 'Invalid or expired refresh token',
            code: 'TOKEN_INVALID'
          });
          return;
        }

        // Get fresh user data from Formance
        const userAccountAddress = this.authService.createAccountAddress(tokenPayload.email);
        const account = await this.formanceLedger.getAccount(userAccountAddress);
        
        if (!account) {
          res.status(401).json({
            success: false,
            error: 'User account not found',
            code: 'USER_NOT_FOUND'
          });
          return;
        }

        // Generate new tokens
        const newTokens = this.authService.generateTokens({
          userId: account.address,
          email: account.metadata.email || tokenPayload.email,
          accountAddress: userAccountAddress,
          firstName: account.metadata.firstName || 'Unknown',
          lastName: account.metadata.lastName || 'User'
        });

        res.json({
          success: true,
          message: 'Tokens refreshed successfully',
          tokens: {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            expiresIn: newTokens.expiresIn
          }
        });

      } catch (error) {
        this.logger.error('Token refresh failed', error as Error);
        res.status(500).json({
          success: false,
          error: 'Token refresh failed',
          message: (error as Error).message
        });
      }
    });
  }

  private setupAccountRoutes(): void {
    // Account listing with FormanceLedgerService - JWT Protected
    this.app.get('/api/accounts', this.authMiddleware.verifyToken, async (req: Request, res: Response): Promise<void> => {
      try {
        // Extract user from JWT token
        const userEmail = req.user!.email;
        const userAccountPattern = `users:${userEmail.replace('@', '_').replace('.', '_')}:*`;
        
        const accounts = await this.formanceLedger.listAccounts({
          address_pattern: userAccountPattern
        });

        const formattedAccounts = accounts.map(account => ({
          id: account.address,
          name: this.getAccountDisplayName(account.address),
          balance: this.calculateDisplayBalance(account.balances || {}),
          currency: this.extractPrimaryCurrency(account.balances || {}),
          type: account.type,
          metadata: account.metadata
        }));

        res.json(formattedAccounts);

      } catch (error) {
        this.logger.error('Failed to list accounts', error as Error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve accounts'
        });
      }
    });

    // Account balance - enterprise precision - JWT Protected
    this.app.get('/api/accounts/:address/balance', this.authMiddleware.verifyToken, this.authMiddleware.requireAccountAccess, async (req: Request, res: Response): Promise<void> => {
      try {
        const { address } = req.params;
        const balances = await this.formanceLedger.getAccountBalance(address!);

        const formattedBalances = balances.map(balance => ({
          asset: balance.asset,
          amount: balance.amount.toString(), // Preserve BigInt precision
          displayAmount: this.formatCurrencyAmount(balance.amount, balance.asset)
        }));

        res.json({
          address,
          balances: formattedBalances,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        this.logger.error('Failed to get account balance', error as Error, { address: req.params.address });
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve balance'
        });
      }
    });
  }

  private setupTransactionRoutes(): void {
    // Enterprise transaction creation - JWT Protected
    this.app.post('/api/transfers', this.authMiddleware.verifyToken, this.authMiddleware.rateLimitByUser(50, 15 * 60 * 1000), async (req: Request, res: Response): Promise<void> => {
      try {
        const { recipient, amount, currency, description } = req.body;
        
        // Validate input
        if (!recipient || !amount || !currency) {
          res.status(400).json({
            success: false,
            error: 'Recipient, amount, and currency are required'
          });
          return;
        }

        // Create enterprise transaction request
        const senderAddress = req.user!.accountAddress;
        const recipientAddress = `users:${recipient.replace('@', '_').replace('.', '_')}:main`;
        
        const transactionRequest = {
          postings: [{
            amount: BigInt(Math.round(parseFloat(amount) * 100)), // Convert to cents
            asset: currency,
            source: senderAddress,
            destination: recipientAddress
          }],
          metadata: {
            type: 'p2p_transfer' as const,
            description: description || 'P2P Transfer',
            recipient,
            timestamp: new Date().toISOString()
          },
          reference: `p2p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        // Validate transaction with enterprise service
        const validation = await this.formanceLedger.validateTransaction(transactionRequest);
        if (!validation.valid) {
          res.status(400).json({
            success: false,
            error: 'Transaction validation failed',
            details: validation.errors
          });
          return;
        }

        // Create transaction via FormanceLedgerService
        const transaction = await this.formanceLedger.createTransaction(transactionRequest);

        this.logger.info('Enterprise transaction created', {
          id: transaction.id,
          reference: transaction.reference,
          amount,
          currency,
          recipient
        });

        res.json({
          success: true,
          message: 'Transfer initiated successfully',
          transfer: {
            id: transaction.reference,
            recipient,
            amount: parseFloat(amount),
            currency,
            description: description || 'P2P Transfer',
            status: 'completed',
            transactionId: transaction.id,
            createdAt: transaction.timestamp,
            formanceReference: transaction.reference
          }
        });

      } catch (error) {
        this.logger.error('Enterprise transfer failed', error as Error, req.body);
        res.status(500).json({
          success: false,
          error: 'Transfer failed',
          message: (error as Error).message
        });
      }
    });

    // Transaction history with enterprise data - JWT Protected
    this.app.get('/api/transactions', this.authMiddleware.verifyToken, async (req: Request, res: Response): Promise<void> => {
      try {
        const userEmail = req.user!.email;
        const userAccountPattern = `users:${userEmail.replace('@', '_').replace('.', '_')}:*`;
        
        const transactions = await this.formanceLedger.listTransactions({
          account: userAccountPattern,
          limit: parseInt(req.query.limit as string) || 50
        });

        const formattedTransactions = transactions.map(tx => ({
          id: tx.reference || tx.id,
          description: tx.metadata.description || tx.metadata.type,
          amount: this.calculateTransactionAmount(tx, userAccountPattern),
          date: tx.timestamp,
          type: this.calculateTransactionAmount(tx, userAccountPattern) > 0 ? 'credit' : 'debit',
          metadata: tx.metadata
        }));

        res.json(formattedTransactions);

      } catch (error) {
        this.logger.error('Failed to list transactions', error as Error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve transactions'
        });
      }
    });
  }

  private setupCurrencyRoutes(): void {
    // Enterprise exchange rates
    this.app.get('/api/exchange-rates', async (req: Request, res: Response): Promise<void> => {
      try {
        // TODO: Integrate with enterprise exchange rate service
        res.json({
          base: 'USD',
          rates: {
            EUR: 0.85,
            GBP: 0.73,
            JPY: 110.0,
            BTC: 0.000015,
            ETH: 0.0005,
            USDC: 1.0,
            USDT: 1.0
          },
          lastUpdated: new Date().toISOString(),
          source: 'enterprise_exchange_service'
        });
      } catch (error) {
        this.logger.error('Failed to get exchange rates', error as Error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve exchange rates'
        });
      }
    });
  }

  private setupCryptoRoutes(): void {
    // Enterprise crypto portfolio
    this.app.get('/api/crypto/portfolio', async (req: Request, res: Response): Promise<void> => {
      try {
        // TODO: Integrate with enterprise crypto services
        res.json({
          totalValue: 12450.75,
          totalValueUSD: 12450.75,
          assets: [
            { symbol: 'BTC', amount: 0.15, valueUSD: 6750.00, change24h: 2.5 },
            { symbol: 'ETH', amount: 2.3, valueUSD: 4600.00, change24h: -1.2 },
            { symbol: 'USDC', amount: 1100.75, valueUSD: 1100.75, change24h: 0.0 }
          ],
          staking: [
            { protocol: 'Ethereum 2.0', amount: 1.0, apy: 4.2, rewards: 0.042 },
            { protocol: 'Polygon', amount: 500, apy: 8.5, rewards: 42.5 }
          ],
          source: 'enterprise_crypto_service'
        });
      } catch (error) {
        this.logger.error('Failed to get crypto portfolio', error as Error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve crypto portfolio'
        });
      }
    });
  }

  // Helper methods
  private getAccountDisplayName(address: string): string {
    if (address.includes(':main')) return 'Main Account';
    if (address.includes(':savings')) return 'Savings';
    if (address.includes(':crypto:')) return 'Crypto Wallet';
    return 'Account';
  }

  private calculateDisplayBalance(balances: Record<string, bigint>): number {
    // Simple implementation - sum USD equivalent
    let total = 0;
    for (const [asset, amount] of Object.entries(balances)) {
      if (asset === 'USD') {
        total += Number(amount) / 100; // Convert from cents
      }
      // TODO: Add conversion for other currencies
    }
    return total;
  }

  private extractPrimaryCurrency(balances: Record<string, bigint>): string {
    if (balances.USD) return 'USD';
    if (balances.EUR) return 'EUR';
    return Object.keys(balances)[0] || 'USD';
  }

  private formatCurrencyAmount(amount: bigint, currency: string): string {
    const value = Number(amount) / 100; // Convert from cents
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency === 'BTC' ? 'USD' : currency
    }).format(value);
  }

  private calculateTransactionAmount(transaction: any, userAccountPattern: string): number {
    // Calculate net amount for user accounts
    let amount = 0;
    for (const posting of transaction.postings) {
      if (posting.destination.includes(userAccountPattern.replace('*', ''))) {
        amount += Number(posting.amount) / 100;
      }
      if (posting.source.includes(userAccountPattern.replace('*', ''))) {
        amount -= Number(posting.amount) / 100;
      }
    }
    return amount;
  }

  public async start(port: number = 3001): Promise<void> {
    try {
      // Initialize Formance connection
      await this.formanceClient.initialize();
      
      this.app.listen(port, () => {
        this.logger.info(`🚀 Enterprise DWAY API Server running on port ${port}`, {
          environment: process.env.NODE_ENV || 'development',
          version: '2.0.0',
          features: [
            'FormanceLedgerService Integration',
            'Enterprise OAuth2 Authentication',
            'Multi-Currency Support',
            'Real-time Transaction Processing',
            'Individual Client Focus'
          ]
        });
      });
    } catch (error) {
      this.logger.error('Failed to start enterprise API server', error as Error);
      throw error;
    }
  }

  public getApp(): express.Application {
    return this.app;
  }
}