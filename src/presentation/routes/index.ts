/**
 * @fileoverview Main API Routes Configuration
 * @description Central routing configuration for the DWAY Financial Platform API
 * @version 1.0.0
 * @author DWAY Financial Platform Team
 * @since 2024-01-01
 * 
 * @module ApiRoutes
 * @category Routes
 * @subcategory Configuration
 * 
 * This module configures all API routes for the platform including:
 * - Authentication and user management
 * - Account operations and balance queries
 * - Transaction processing and history
 * - Compliance and KYC workflows
 * - Real-time WebSocket connections
 * - Health checks and monitoring
 */

import { Router } from 'express';
import { DIContainer } from '../../infrastructure/ioc/Container';
import { TYPES } from '../../infrastructure/ioc/types';
import { ILogger } from '../../shared/interfaces/ILogger';

// Import route modules
import { createAuthRoutes } from './authRoutes';
import { createAccountRoutes } from './accountRoutes';
import { createTransactionRoutes } from './transactionRoutes';
import { createComplianceRoutes } from './complianceRoutes';
import { createHealthRoutes } from './healthRoutes';

// Import middleware
import { authMiddleware } from '../middleware/authMiddleware';
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware';
import { validationMiddleware } from '../middleware/validationMiddleware';
import { corsMiddleware } from '../middleware/corsMiddleware';
import { loggingMiddleware } from '../middleware/loggingMiddleware';

/**
 * @interface ApiRouteConfig
 * @description Configuration options for API route setup
 */
export interface ApiRouteConfig {
  enableRateLimit: boolean;
  enableCors: boolean;
  enableLogging: boolean;
  enableAuth: boolean;
  version: string;
}

/**
 * @interface RouteInfo
 * @description Information about registered routes
 */
export interface RouteInfo {
  path: string;
  method: string;
  description: string;
  authRequired: boolean;
  rateLimit?: number;
}

/**
 * @class ApiRouteManager
 * @description Manages API route configuration and registration
 * 
 * This class provides centralized route management with comprehensive
 * middleware configuration, dependency injection integration, and
 * detailed route documentation for the financial platform API.
 * 
 * @example
 * ```typescript
 * const routeManager = new ApiRouteManager(container);
 * const router = routeManager.createRoutes({
 *   enableRateLimit: true,
 *   enableCors: true,
 *   enableLogging: true,
 *   enableAuth: true,
 *   version: 'v1'
 * });
 * app.use('/api', router);
 * ```
 */
export class ApiRouteManager {
  private logger: ILogger;
  private registeredRoutes: RouteInfo[] = [];

  /**
   * @constructor
   * @param container - Dependency injection container
   */
  constructor(private container: DIContainer) {
    this.logger = container.get<ILogger>(TYPES.Logger);
    this.logger.info('ApiRouteManager initialized', {
      component: 'ApiRouteManager',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * @method createRoutes
   * @description Creates and configures all API routes with middleware
   * 
   * @param config - Route configuration options
   * @returns Router - Configured Express router with all routes
   * 
   * @example
   * ```typescript
   * const router = routeManager.createRoutes({
   *   enableRateLimit: true,
   *   enableCors: true,
   *   enableLogging: true,
   *   enableAuth: true,
   *   version: 'v1'
   * });
   * ```
   */
  public createRoutes(config: ApiRouteConfig): Router {
    const router = Router();

    this.logger.info('Creating API routes', {
      config,
      timestamp: new Date().toISOString()
    });

    // Apply global middleware in correct order
    this.applyGlobalMiddleware(router, config);

    // Register route modules
    this.registerRouteModules(router, config);

    // Add route documentation endpoint
    this.addDocumentationRoutes(router);

    this.logger.info('API routes created successfully', {
      routeCount: this.registeredRoutes.length,
      config,
      timestamp: new Date().toISOString()
    });

    return router;
  }

  /**
   * @private
   * @method applyGlobalMiddleware
   * @description Applies global middleware to the router
   * 
   * @param router - Express router instance
   * @param config - Route configuration
   */
  private applyGlobalMiddleware(router: Router, config: ApiRouteConfig): void {
    // CORS middleware (applied first)
    if (config.enableCors) {
      router.use(corsMiddleware());
      this.logger.info('CORS middleware enabled');
    }

    // Request logging middleware
    if (config.enableLogging) {
      router.use(loggingMiddleware());
      this.logger.info('Logging middleware enabled');
    }

    // Rate limiting middleware
    if (config.enableRateLimit) {
      router.use(rateLimitMiddleware({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // limit each IP to 1000 requests per windowMs
        message: 'Too many requests from this IP, please try again later',
        skipSuccessfulRequests: false
      }));
      this.logger.info('Rate limiting middleware enabled');
    }

    // Request validation middleware
    router.use(validationMiddleware());
    this.logger.info('Validation middleware enabled');
  }

  /**
   * @private
   * @method registerRouteModules
   * @description Registers all route modules with their specific configurations
   * 
   * @param router - Express router instance
   * @param config - Route configuration
   */
  private registerRouteModules(router: Router, config: ApiRouteConfig): void {
    // Health check routes (no auth required)
    const healthRoutes = createHealthRoutes(this.container);
    router.use('/health', healthRoutes);
    this.addRouteInfo('/health', 'GET', 'Health check endpoints', false);

    // Authentication routes (no auth required for login/register)
    const authRoutes = createAuthRoutes(this.container);
    router.use('/auth', authRoutes);
    this.addRouteInfo('/auth/signin', 'POST', 'User authentication', false);
    this.addRouteInfo('/auth/signup', 'POST', 'User registration', false);
    this.addRouteInfo('/auth/signout', 'POST', 'User sign out', true);
    this.addRouteInfo('/auth/refresh', 'POST', 'Token refresh', false);

    // Protected routes requiring authentication
    if (config.enableAuth) {
      router.use(authMiddleware());
      this.logger.info('Authentication middleware enabled for protected routes');
    }

    // Account management routes
    const accountRoutes = createAccountRoutes(this.container);
    router.use('/accounts', accountRoutes);
    this.addRouteInfo('/accounts', 'GET', 'Get user accounts', true);
    this.addRouteInfo('/accounts', 'POST', 'Create new account', true);
    this.addRouteInfo('/accounts/:id', 'GET', 'Get account details', true);
    this.addRouteInfo('/accounts/:id/history', 'GET', 'Get account history', true);

    // Transaction processing routes
    const transactionRoutes = createTransactionRoutes(this.container);
    router.use('/transactions', transactionRoutes);
    this.addRouteInfo('/transactions', 'GET', 'Get user transactions', true);
    this.addRouteInfo('/transactions', 'POST', 'Create new transaction', true);
    this.addRouteInfo('/transactions/:id', 'GET', 'Get transaction details', true);
    this.addRouteInfo('/transactions/:id/cancel', 'POST', 'Cancel transaction', true);

    // Compliance and KYC routes
    const complianceRoutes = createComplianceRoutes(this.container);
    router.use('/compliance', complianceRoutes);
    this.addRouteInfo('/compliance/kyc', 'POST', 'Submit KYC data', true);
    this.addRouteInfo('/compliance/kyc/status', 'GET', 'Get KYC status', true);
    this.addRouteInfo('/compliance/aml/:transactionId', 'GET', 'Get AML check results', true);

    this.logger.info('All route modules registered successfully', {
      moduleCount: 5,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * @private
   * @method addDocumentationRoutes
   * @description Adds API documentation and introspection endpoints
   * 
   * @param router - Express router instance
   */
  private addDocumentationRoutes(router: Router): void {
    // API documentation endpoint
    router.get('/docs', (req, res) => {
      const documentation = {
        name: 'DWAY Financial Platform API',
        version: '1.0.0',
        description: 'Comprehensive financial platform with multi-currency support',
        baseUrl: `${req.protocol}://${req.get('host')}/api`,
        timestamp: new Date().toISOString(),
        routes: this.registeredRoutes.map(route => ({
          ...route,
          fullPath: `/api${route.path}`
        })),
        authentication: {
          type: 'Bearer JWT',
          description: 'Include JWT token in Authorization header',
          example: 'Authorization: Bearer <your-jwt-token>'
        },
        rateLimit: {
          window: '15 minutes',
          maxRequests: 1000,
          description: 'Rate limiting applied per IP address'
        },
        supportedCurrencies: [
          'USD', 'EUR', 'GBP', 'JPY', 'BTC', 'ETH', 'USDC', 'USDT'
        ],
        features: [
          'Multi-currency account management',
          'Real-time transaction processing',
          'KYC/AML compliance integration',
          'Formance ledger integration',
          'WebSocket real-time updates',
          'Comprehensive audit logging'
        ]
      };

      res.status(200).json({
        success: true,
        data: documentation
      });
    });

    // Health summary endpoint
    router.get('/status', (req, res) => {
      res.status(200).json({
        success: true,
        data: {
          service: 'DWAY Financial Platform API',
          version: '1.0.0',
          status: 'operational',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development',
          registeredRoutes: this.registeredRoutes.length,
          memoryUsage: process.memoryUsage(),
          nodeVersion: process.version
        }
      });
    });

    this.addRouteInfo('/docs', 'GET', 'API documentation', false);
    this.addRouteInfo('/status', 'GET', 'Service status', false);
  }

  /**
   * @private
   * @method addRouteInfo
   * @description Adds route information to the registry
   * 
   * @param path - Route path
   * @param method - HTTP method
   * @param description - Route description
   * @param authRequired - Whether authentication is required
   * @param rateLimit - Optional rate limit override
   */
  private addRouteInfo(
    path: string,
    method: string,
    description: string,
    authRequired: boolean,
    rateLimit?: number
  ): void {
    this.registeredRoutes.push({
      path,
      method,
      description,
      authRequired,
      ...(rateLimit && { rateLimit })
    });
  }

  /**
   * @method getRegisteredRoutes
   * @description Gets all registered route information
   * 
   * @returns RouteInfo[] - Array of route information
   */
  public getRegisteredRoutes(): RouteInfo[] {
    return [...this.registeredRoutes];
  }

  /**
   * @method getRouteStats
   * @description Gets statistics about registered routes
   * 
   * @returns Object - Route statistics
   */
  public getRouteStats(): {
    total: number;
    protected: number;
    public: number;
    byMethod: Record<string, number>;
  } {
    const total = this.registeredRoutes.length;
    const protected_ = this.registeredRoutes.filter(route => route.authRequired).length;
    const public_ = total - protected_;

    const byMethod = this.registeredRoutes.reduce((acc, route) => {
      acc[route.method] = (acc[route.method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      protected: protected_,
      public: public_,
      byMethod
    };
  }
}

/**
 * @function createApiRoutes
 * @description Factory function to create API routes with default configuration
 * 
 * @param container - Dependency injection container
 * @param config - Optional route configuration (uses defaults if not provided)
 * @returns Router - Configured Express router
 * 
 * @example
 * ```typescript
 * import { createApiRoutes } from './routes';
 * import { DIContainer } from '../infrastructure/ioc/Container';
 * 
 * const container = DIContainer.getInstance();
 * const apiRouter = createApiRoutes(container);
 * app.use('/api', apiRouter);
 * ```
 */
export function createApiRoutes(
  container: DIContainer,
  config: Partial<ApiRouteConfig> = {}
): Router {
  const defaultConfig: ApiRouteConfig = {
    enableRateLimit: true,
    enableCors: true,
    enableLogging: true,
    enableAuth: true,
    version: 'v1'
  };

  const finalConfig = { ...defaultConfig, ...config };
  const routeManager = new ApiRouteManager(container);
  
  return routeManager.createRoutes(finalConfig);
}

// Export route manager for advanced usage
export { ApiRouteManager };