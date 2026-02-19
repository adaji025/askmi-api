import { Permission, roleHasPermission, isAdmin, UserRole } from '../types/permissions.js';

export interface User {
  userId: string;
  email: string;
  role: string;
}

export interface Resource {
  ownerId?: string;
  [key: string]: any;
}

/**
 * Check if user can perform an action on a resource
 */
export function canAccessResource(
  user: User,
  resource: Resource | null,
  action: Permission
): boolean {
  // Admin bypasses all checks
  if (isAdmin(user.role)) {
    return true;
  }

  // Check if user has the permission
  if (!roleHasPermission(user.role, action)) {
    return false;
  }

  // For own resource actions, verify ownership
  if (action.includes(':own')) {
    if (!resource || !resource.ownerId) {
      return false;
    }
    return resource.ownerId === user.userId;
  }

  // For all resource actions, permission check is sufficient
  return true;
}

/**
 * Check if user is the owner of a resource
 */
export function isResourceOwner(userId: string, resourceOwnerId: string | undefined): boolean {
  if (!resourceOwnerId) {
    return false;
  }
  return userId === resourceOwnerId;
}

/**
 * Check if user has any of the specified roles
 */
export function hasRole(user: User, ...roles: string[]): boolean {
  return roles.includes(user.role);
}

/**
 * Check if user can access resource (own or has permission for all)
 */
export function canAccessResourceOrOwn(
  user: User,
  resource: Resource | null,
  ownAction: Permission,
  allAction: Permission
): boolean {
  // Admin bypasses all checks
  if (isAdmin(user.role)) {
    return true;
  }

  // Check if user owns the resource
  if (resource && resource.ownerId && isResourceOwner(user.userId, resource.ownerId)) {
    return roleHasPermission(user.role, ownAction);
  }

  // Check if user has permission for all resources
  return roleHasPermission(user.role, allAction);
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: string): Permission[] {
  const userRole = role as UserRole;
  const permissions = {
    [UserRole.ADMIN]: [
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
      Permission.USERS_READ_OWN,
      Permission.USERS_WRITE_OWN,
      Permission.CONTENT_CREATE_OWN,
      Permission.CONTENT_WRITE_OWN,
      Permission.CONTENT_DELETE_OWN,
      Permission.CONTENT_READ_ALL,
    ],
    [UserRole.USER]: [
      Permission.USERS_READ_OWN,
      Permission.USERS_WRITE_OWN,
      Permission.CONTENT_CREATE_OWN,
      Permission.CONTENT_WRITE_OWN,
      Permission.CONTENT_DELETE_OWN,
      Permission.CONTENT_READ_ALL,
    ],
  };

  return permissions[userRole] || [];
}
