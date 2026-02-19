/**
 * Permission types for different resources and actions
 */
export enum Permission {
  // User permissions
  USERS_READ_OWN = 'users:read:own',
  USERS_WRITE_OWN = 'users:write:own',
  USERS_READ_ALL = 'users:read:all',
  USERS_WRITE_ALL = 'users:write:all',
  USERS_DELETE_ALL = 'users:delete:all',

  // Content permissions
  CONTENT_CREATE_OWN = 'content:create:own',
  CONTENT_WRITE_OWN = 'content:write:own',
  CONTENT_DELETE_OWN = 'content:delete:own',
  CONTENT_READ_ALL = 'content:read:all',
  CONTENT_WRITE_ALL = 'content:write:all',
  CONTENT_DELETE_ALL = 'content:delete:all',

  // System permissions
  SETTINGS_MANAGE = 'settings:manage',
  ANALYTICS_VIEW = 'analytics:view',
}

/**
 * User roles
 */
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  INFLUENCER = 'influencer',
}

/**
 * Role to permissions mapping
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    // Admin has all permissions
    Permission.USERS_READ_OWN,
    Permission.USERS_WRITE_OWN,
    Permission.USERS_READ_ALL,
    Permission.USERS_WRITE_ALL,
    Permission.USERS_DELETE_ALL,
    Permission.CONTENT_CREATE_OWN,
    Permission.CONTENT_WRITE_OWN,
    Permission.CONTENT_DELETE_OWN,
    Permission.CONTENT_READ_ALL,
    Permission.CONTENT_WRITE_ALL,
    Permission.CONTENT_DELETE_ALL,
    Permission.SETTINGS_MANAGE,
    Permission.ANALYTICS_VIEW,
  ],
  [UserRole.INFLUENCER]: [
    // Influencer permissions
    Permission.USERS_READ_OWN,
    Permission.USERS_WRITE_OWN,
    Permission.CONTENT_CREATE_OWN,
    Permission.CONTENT_WRITE_OWN,
    Permission.CONTENT_DELETE_OWN,
    Permission.CONTENT_READ_ALL,
  ],
  [UserRole.USER]: [
    // Regular user permissions
    Permission.USERS_READ_OWN,
    Permission.USERS_WRITE_OWN,
    Permission.CONTENT_CREATE_OWN,
    Permission.CONTENT_WRITE_OWN,
    Permission.CONTENT_DELETE_OWN,
    Permission.CONTENT_READ_ALL, // Can view others' content (read-only)
  ],
};

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: string, permission: Permission): boolean {
  const userRole = role as UserRole;
  if (!ROLE_PERMISSIONS[userRole]) {
    return false;
  }
  return ROLE_PERMISSIONS[userRole].includes(permission);
}

/**
 * Check if admin role (admins bypass all checks)
 */
export function isAdmin(role: string): boolean {
  return role === UserRole.ADMIN;
}
