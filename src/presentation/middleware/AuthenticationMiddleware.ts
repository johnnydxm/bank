import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'inversify';
import { TYPES } from '../../infrastructure/ioc/types';
import { JWTAuthenticationService } from '../../infrastructure/auth/JWTAuthenticationService';
import { ILogger } from '../../shared/interfaces/ILogger';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        accountAddress: string;
        firstName: string;
        lastName: string;
      };
    }
  }
}

@injectable()
export class AuthenticationMiddleware {
  constructor(
    @inject(TYPES.JWTAuthenticationService) private authService: JWTAuthenticationService,
    @inject(TYPES.Logger) private logger: ILogger
  ) {}

  /**
   * Middleware to verify JWT access token
   */
  public verifyToken = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;
      const token = this.authService.extractBearerToken(authHeader);

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Access token required',
          code: 'TOKEN_MISSING'
        });
        return;
      }

      const userPayload = this.authService.verifyAccessToken(token);
      if (!userPayload) {
        res.status(401).json({
          success: false,
          error: 'Invalid or expired access token',
          code: 'TOKEN_INVALID'
        });
        return;
      }

      // Attach user to request
      req.user = userPayload;
      
      this.logger.info('Authentication successful', {
        userId: userPayload.userId,
        email: userPayload.email,
        path: req.path,
        method: req.method
      });

      next();
    } catch (error) {
      this.logger.error('Authentication middleware error', error as Error, {
        path: req.path,
        method: req.method
      });

      res.status(500).json({
        success: false,
        error: 'Authentication service error',
        code: 'AUTH_SERVICE_ERROR'
      });
    }
  };

  /**
   * Optional authentication - attach user if token is valid, but don't require it
   */
  public optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;
      const token = this.authService.extractBearerToken(authHeader);

      if (token) {
        const userPayload = this.authService.verifyAccessToken(token);
        if (userPayload) {
          req.user = userPayload;
          this.logger.info('Optional authentication successful', {
            userId: userPayload.userId,
            email: userPayload.email,
            path: req.path
          });
        }
      }

      next();
    } catch (error) {
      this.logger.warn('Optional authentication failed', error as Error);
      // Continue without authentication for optional routes
      next();
    }
  };

  /**
   * Rate limiting by user
   */
  public rateLimitByUser = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
    const userRequestCounts = new Map<string, { count: number; resetTime: number }>();

    return (req: Request, res: Response, next: NextFunction): void => {
      const userId = req.user?.userId || req.ip || 'unknown';
      const now = Date.now();
      
      const userStats = userRequestCounts.get(userId);
      
      if (!userStats || now > userStats.resetTime) {
        // Reset or initialize counter
        userRequestCounts.set(userId, {
          count: 1,
          resetTime: now + windowMs
        });
        next();
        return;
      }

      if (userStats.count >= maxRequests) {
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((userStats.resetTime - now) / 1000)
        });
        return;
      }

      userStats.count++;
      next();
    };
  };

  /**
   * Require specific account access
   */
  public requireAccountAccess = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const requestedAddress = req.params.address;
    if (!requestedAddress) {
      next();
      return;
    }

    // Check if user owns this account
    const userEmailPattern = req.user.email.replace('@', '_').replace('.', '_');
    if (requestedAddress.startsWith(`users:${userEmailPattern}`)) {
      next();
      return;
    }

    this.logger.warn('Unauthorized account access attempt', {
      userId: req.user.userId,
      requestedAddress,
      userAccountPattern: `users:${userEmailPattern}`
    });

    res.status(403).json({
      success: false,
      error: 'Access denied to this account',
      code: 'ACCOUNT_ACCESS_DENIED'
    });
  };
}