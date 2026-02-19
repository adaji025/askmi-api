import type { Request, Response, NextFunction } from 'express';
import { jwtService } from '../services/jwtService.js';
import { Permission, roleHasPermission, isAdmin } from '../types/permissions.js';
import { canAccessResource, hasRole } from '../utils/permissions.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Authentication middleware to verify JWT token
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: 'No token provided. Authorization header is required.',
      });
      return;
    }

    // Extract token from "Bearer <token>"
    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        success: false,
        message: 'Invalid token format. Use: Bearer <token>',
      });
      return;
    }

    const token = parts[1];

    // Verify token
    const decoded = jwtService.verifyToken(token);

    if (!decoded) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
      return;
    }

    // Get full user data to check approval status
    const { prisma } = await import('../index.js');
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isApproved: true,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Check if influencer is approved
    if (user.role === 'influencer' && !user.isApproved) {
      res.status(403).json({
        success: false,
        message: 'Your account is pending approval. Please wait for an admin to approve your account.',
      });
      return;
    }

    // Attach user info to request
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1];
        const decoded = jwtService.verifyToken(token);
        if (decoded) {
          req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
          };
        }
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

/**
 * Role-based authorization middleware
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions. Required roles: ' + roles.join(', '),
      });
      return;
    }

    next();
  };
};

/**
 * Require specific permission
 */
export const requirePermission = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Admin bypasses all permission checks
    if (isAdmin(req.user.role)) {
      return next();
    }

    if (!roleHasPermission(req.user.role, permission)) {
      res.status(403).json({
        success: false,
        message: `Insufficient permissions. Required permission: ${permission}`,
      });
      return;
    }

    next();
  };
};

/**
 * Require ownership of resource or specific role
 * @param resourceIdParam - Parameter name in route that contains resource ID (default: 'id')
 * @param allowedRoles - Roles that can bypass ownership check
 * @param getResourceOwner - Function to get resource owner ID (optional, for async lookups)
 */
export const requireOwnershipOrRole = (
  resourceIdParam: string = 'id',
  ...allowedRoles: string[]
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Admin always has access
    if (isAdmin(req.user.role)) {
      return next();
    }

    // Check if user has one of the allowed roles
    if (allowedRoles.length > 0 && allowedRoles.includes(req.user.role)) {
      return next();
    }

    // Check ownership
    const paramValue = req.params[resourceIdParam] || req.body[resourceIdParam];
    const resourceId = Array.isArray(paramValue) ? paramValue[0] : paramValue;
    
    if (!resourceId || typeof resourceId !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Resource ID is required',
      });
      return;
    }

    // If resourceId matches userId, user owns the resource
    if (resourceId === req.user.userId) {
      return next();
    }

    res.status(403).json({
      success: false,
      message: 'You do not have permission to access this resource',
    });
  };
};

/**
 * Require any of the specified roles (OR condition)
 */
export const requireAnyRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Admin always has access
    if (isAdmin(req.user.role)) {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Insufficient permissions. Required one of: ${roles.join(', ')}`,
      });
      return;
    }

    next();
  };
};

/**
 * Require all of the specified roles (AND condition)
 * Note: A user can only have one role, so this is mainly for future extensibility
 */
export const requireAllRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Admin always has access
    if (isAdmin(req.user.role)) {
      return next();
    }

    // Since a user can only have one role, check if user's role is in the required list
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Insufficient permissions. Required all of: ${roles.join(', ')}`,
      });
      return;
    }

    next();
  };
};
