import jwt from 'jsonwebtoken';
import type { UserWithoutPassword } from './userService.js';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export class JWTService {
  private readonly secret: string;
  private readonly expiresIn: string | number;

  constructor() {
    this.secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.expiresIn = process.env.JWT_EXPIRES_IN || '7d';

    if (!process.env.JWT_SECRET) {
      console.warn('⚠️  JWT_SECRET not set in environment variables. Using default (not secure for production!)');
    }
  }

  /**
   * Generate JWT token for user
   */
  generateToken(user: UserWithoutPassword): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
    } as jwt.SignOptions);
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.secret) as JWTPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch (error) {
      return null;
    }
  }
}

export const jwtService = new JWTService();
