import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { injectable, inject } from 'inversify';
import { TYPES } from '../ioc/types';
import { ILogger } from '../../shared/interfaces/ILogger';

export interface UserPayload {
  userId: string;
  email: string;
  accountAddress: string;
  firstName: string;
  lastName: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@injectable()
export class JWTAuthenticationService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly accessTokenExpiry = '15m';
  private readonly refreshTokenExpiry = '7d';

  constructor(@inject(TYPES.Logger) private logger: ILogger) {
    this.jwtSecret = process.env.JWT_SECRET || 'dway-jwt-secret-key-development';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'dway-refresh-secret-key-development';
    
    if (process.env.NODE_ENV === 'production' && 
        (this.jwtSecret === 'dway-jwt-secret-key-development' || 
         this.jwtRefreshSecret === 'dway-refresh-secret-key-development')) {
      throw new Error('Production JWT secrets must be configured');
    }
  }

  /**
   * Hash a password using bcrypt
   */
  public async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify a password against its hash
   */
  public async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate access and refresh tokens for a user
   */
  public generateTokens(userPayload: UserPayload): AuthTokens {
    const accessToken = jwt.sign(
      {
        userId: userPayload.userId,
        email: userPayload.email,
        accountAddress: userPayload.accountAddress,
        type: 'access'
      },
      this.jwtSecret,
      { 
        expiresIn: this.accessTokenExpiry,
        issuer: 'dway-banking-platform',
        subject: userPayload.userId
      }
    );

    const refreshToken = jwt.sign(
      {
        userId: userPayload.userId,
        email: userPayload.email,
        type: 'refresh'
      },
      this.jwtRefreshSecret,
      { 
        expiresIn: this.refreshTokenExpiry,
        issuer: 'dway-banking-platform',
        subject: userPayload.userId
      }
    );

    // Return expiry in seconds
    const expiresIn = 15 * 60; // 15 minutes in seconds

    this.logger.info('Tokens generated successfully', {
      userId: userPayload.userId,
      email: userPayload.email,
      expiresIn
    });

    return {
      accessToken,
      refreshToken,
      expiresIn
    };
  }

  /**
   * Verify and decode an access token
   */
  public verifyAccessToken(token: string): UserPayload | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      if (decoded.type !== 'access') {
        this.logger.warn('Invalid token type for access verification', { type: decoded.type });
        return null;
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
        accountAddress: decoded.accountAddress,
        firstName: '', // Not stored in JWT for security
        lastName: ''   // Not stored in JWT for security
      };
    } catch (error) {
      this.logger.warn('Access token verification failed', error as Error);
      return null;
    }
  }

  /**
   * Verify and decode a refresh token
   */
  public verifyRefreshToken(token: string): { userId: string; email: string } | null {
    try {
      const decoded = jwt.verify(token, this.jwtRefreshSecret) as any;
      
      if (decoded.type !== 'refresh') {
        this.logger.warn('Invalid token type for refresh verification', { type: decoded.type });
        return null;
      }

      return {
        userId: decoded.userId,
        email: decoded.email
      };
    } catch (error) {
      this.logger.warn('Refresh token verification failed', error as Error);
      return null;
    }
  }

  /**
   * Extract bearer token from Authorization header
   */
  public extractBearerToken(authHeader: string | undefined): string | null {
    if (!authHeader) return null;
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
    
    return parts[1] || null;
  }

  /**
   * Create account address from email (consistent with enterprise patterns)
   */
  public createAccountAddress(email: string): string {
    return `users:${email.replace('@', '_').replace('.', '_')}:main`;
  }

  /**
   * Extract email from account address
   */
  public extractEmailFromAddress(address: string): string | null {
    const match = address.match(/^users:(.+)_(.+)_(.+):main$/);
    if (!match) return null;
    
    return `${match[1]}@${match[2]}.${match[3]}`;
  }

  /**
   * Generate a secure session ID
   */
  public generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}